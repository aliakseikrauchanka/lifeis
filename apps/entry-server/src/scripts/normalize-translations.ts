/**
 * One-off migration: normalize original/translation on all rows in the
 * `translations` collection using formatEntry.
 *
 * - Backs up the entire collection to backups/translations-<ISO>.json BEFORE any write.
 *   Aborts if the backup cannot be written.
 * - Dry-run by default: logs what would change + a duplicate report, writes nothing.
 * - Pass --apply to perform the bulk update of changed rows.
 * - Never deletes or merges rows; duplicates are reported only.
 *
 * Run from the repo root (the backups/ dir is created relative to the current working directory).
 * The TS_NODE_COMPILER_OPTIONS override forces CommonJS so ts-node can load this .ts file
 * (the repo's tsconfig uses module: es2020, which otherwise triggers ERR_UNKNOWN_FILE_EXTENSION).
 *
 * Run (dry-run):
 *   TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' DB_URI=... \
 *     npx ts-node apps/entry-server/src/scripts/normalize-translations.ts
 * Run (apply):
 *   TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' DB_URI=... \
 *     npx ts-node apps/entry-server/src/scripts/normalize-translations.ts --apply
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { getMongoDbClient } from '../db';
import { formatEntry } from '../helpers/format-entry';

interface TranslationDoc {
  _id: unknown;
  original: string;
  translation: string;
  originalLanguage: string;
  translationLanguage: string;
  owner_id: string;
  timestamp: number;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const client = getMongoDbClient();

  try {
    // Wait for connection before reading.
    await client.db('admin').command({ ping: 1 });
    const collection = client.db('lifeis').collection<TranslationDoc>('translations');

    const rows = await collection.find({}).toArray();
    console.log(`Loaded ${rows.length} translation rows.`);

    // 1. Backup the full collection to disk before any write. Abort on failure.
    const backupDir = path.resolve(process.cwd(), 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `translations-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await fs.writeFile(backupFile, JSON.stringify(rows, null, 2), 'utf8');
    console.log(`Backup written to ${backupFile}`);

    // 2. Compute normalized values and collect changed rows.
    //    Rows whose original/translation are not strings (legacy/corrupt data) are
    //    skipped and reported — never rewritten — so the migration only normalizes,
    //    never corrupts.
    const changes: Array<{ id: unknown; original: string; translation: string }> = [];
    const skippedNonString: unknown[] = [];
    const normalizedRows: Array<TranslationDoc> = [];
    for (const r of rows) {
      if (typeof r.original !== 'string' || typeof r.translation !== 'string') {
        skippedNonString.push(r._id);
        continue;
      }
      const original = formatEntry(r.original);
      const translation = formatEntry(r.translation);
      if (original !== r.original || translation !== r.translation) {
        changes.push({ id: r._id, original, translation });
      }
      normalizedRows.push({ ...r, original, translation });
    }
    if (skippedNonString.length > 0) {
      console.warn(
        `Skipped ${skippedNonString.length} row(s) with non-string original/translation: ${skippedNonString
          .map(String)
          .join(', ')}`,
      );
    }
    console.log(`${changes.length} rows would change.`);

    // 3. Duplicate report on the normalized values. Key fields are joined with '|';
    //    field values are user-entered words / language codes where '|' is not expected.
    const groups = new Map<string, unknown[]>();
    for (const r of normalizedRows) {
      const key = [r.owner_id, r.original, r.translation, r.originalLanguage, r.translationLanguage].join('|');
      const arr = groups.get(key) ?? [];
      arr.push(r._id);
      groups.set(key, arr);
    }
    const dupes = [...groups.entries()].filter(([, ids]) => ids.length > 1);
    if (dupes.length === 0) {
      console.log('No duplicates after normalization.');
    } else {
      console.log(`\n=== ${dupes.length} duplicate group(s) after normalization (review/delete manually) ===`);
      for (const [key, ids] of dupes) {
        console.log(`  ${key} -> ${ids.length} rows: ${ids.map(String).join(', ')}`);
      }
    }

    // 4. Apply only when --apply is passed.
    if (!apply) {
      console.log('\nDry-run complete. Re-run with --apply to write changes.');
      return;
    }
    if (changes.length === 0) {
      console.log('\nNothing to update.');
      return;
    }
    const result = await collection.bulkWrite(
      changes.map((c) => ({
        updateOne: {
          filter: { _id: c.id as TranslationDoc['_id'] },
          update: { $set: { original: c.original, translation: c.translation } },
        },
      })),
    );
    console.log(`\nApplied. Modified ${result.modifiedCount} rows.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
