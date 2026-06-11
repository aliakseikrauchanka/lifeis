# Normalize Saved Translations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize every saved translation's `original`/`translation` text (trim, strip a single trailing period, capitalize first letter) on all write paths, and backfill existing rows via a one-off backup-first migration.

**Architecture:** A single shared `formatEntry` helper is the source of truth. The three Express write handlers (`POST /`, `PUT /:id`, `POST /import`) call it before validation/dedup/insert. A standalone migration script reuses the same helper, snapshots the `translations` collection to a JSON file before any write, runs dry-run by default, and reports (never merges) duplicates.

**Tech Stack:** TypeScript, Express, MongoDB (native driver), Jest (entry-server), ts-node.

**Reference spec:** `docs/superpowers/specs/2026-06-11-normalize-translations-design.md`

---

### Task 1: `formatEntry` helper (TDD)

**Files:**
- Create: `apps/entry-server/src/helpers/format-entry.ts`
- Test: `apps/entry-server/src/helpers/format-entry.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/entry-server/src/helpers/format-entry.spec.ts`:

```ts
import { formatEntry } from './format-entry';

describe('formatEntry', () => {
  it('trims leading and trailing whitespace', () => {
    expect(formatEntry('  kot  ')).toBe('Kot');
  });

  it('strips a single trailing period and re-trims', () => {
    expect(formatEntry('the dog runs.')).toBe('The dog runs');
    expect(formatEntry('hello . ')).toBe('Hello');
  });

  it('preserves trailing ? and !', () => {
    expect(formatEntry('why?')).toBe('Why?');
    expect(formatEntry('stop!')).toBe('Stop!');
  });

  it('capitalizes the first letter', () => {
    expect(formatEntry('dog')).toBe('Dog');
  });

  it('leaves the rest of the string untouched', () => {
    expect(formatEntry('USB cable')).toBe('USB cable');
    expect(formatEntry('iPhone')).toBe('IPhone');
  });

  it('handles multi-word sentences', () => {
    expect(formatEntry('  a quick brown fox.  ')).toBe('A quick brown fox');
  });

  it('returns empty string when value becomes empty after formatting', () => {
    expect(formatEntry('.')).toBe('');
    expect(formatEntry('   ')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nx test entry-server --testFile=src/helpers/format-entry.spec.ts`
Expected: FAIL — cannot find module `./format-entry`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/entry-server/src/helpers/format-entry.ts`:

```ts
/**
 * Normalizes a saved translation value.
 * Trim -> strip one trailing period (not ? or !) -> capitalize first letter.
 * The rest of the string is left untouched. Idempotent.
 */
export function formatEntry(value: string): string {
  let s = value.trim();
  if (s.endsWith('.')) s = s.slice(0, -1).trimEnd();
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nx test entry-server --testFile=src/helpers/format-entry.spec.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/entry-server/src/helpers/format-entry.ts apps/entry-server/src/helpers/format-entry.spec.ts
git commit -m "feat: add formatEntry translation normalizer"
```

---

### Task 2: Apply `formatEntry` to `POST /` create handler

**Files:**
- Modify: `apps/entry-server/src/routes/translations-routes.ts` (the `router.post('/', ...)` handler, around lines 146-204)

- [ ] **Step 1: Add the import**

At the top of `apps/entry-server/src/routes/translations-routes.ts`, after the existing `getGlosbeTranslation` import (line 9), add:

```ts
import { formatEntry } from '../helpers/format-entry';
```

- [ ] **Step 2: Normalize after the required check, before length checks**

In `router.post('/', ...)`, the current code reads:

```ts
      const { original, translation, originalLanguage, translationLanguage } = req.body;

      if (!original || !translation || !originalLanguage || !translationLanguage) {
        return res.status(400).json({
          message: 'original, translation, originalLanguage, and translationLanguage are required',
        });
      }

      // SECURITY FIX: Enforce maximum field lengths ...
      if (typeof original !== 'string' || original.length > MAX_TEXT_LENGTH) {
```

Replace it with (note: format BEFORE the length checks, and the length checks now operate on the normalized values via reassigned `let` locals):

```ts
      let { original, translation } = req.body;
      const { originalLanguage, translationLanguage } = req.body;

      if (!original || !translation || !originalLanguage || !translationLanguage) {
        return res.status(400).json({
          message: 'original, translation, originalLanguage, and translationLanguage are required',
        });
      }

      // Enforce string type before normalizing.
      if (typeof original !== 'string' || typeof translation !== 'string') {
        return res.status(400).json({ message: 'original and translation must be strings' });
      }

      // Normalize text before length/dedup checks so dedup compares normalized values.
      original = formatEntry(original);
      translation = formatEntry(translation);

      // Reject values that became empty after normalization (e.g. "." or whitespace).
      if (original.length === 0 || translation.length === 0) {
        return res.status(400).json({
          message: 'original, translation, originalLanguage, and translationLanguage are required',
        });
      }

      // SECURITY FIX: Enforce maximum field lengths ...
      if (original.length > MAX_TEXT_LENGTH) {
```

Then update the following `translation` length check (currently `if (typeof translation !== 'string' || translation.length > MAX_TRANSLATION_LENGTH)`) to drop the now-redundant type check:

```ts
      if (translation.length > MAX_TRANSLATION_LENGTH) {
        return res.status(400).json({ message: `translation must be a string of at most ${MAX_TRANSLATION_LENGTH} characters` });
      }
```

The rest of the handler (language allowlist checks, dedup `findOne`, insert) stays unchanged and now uses the normalized `original`/`translation`.

- [ ] **Step 3: Typecheck / build the route**

Run: `nx build entry-server`
Expected: builds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/entry-server/src/routes/translations-routes.ts
git commit -m "feat: normalize text on POST /translations"
```

---

### Task 3: Apply `formatEntry` to `PUT /:id` update handler

**Files:**
- Modify: `apps/entry-server/src/routes/translations-routes.ts` (the `router.put('/:id', ...)` handler, around lines 207-250)

- [ ] **Step 1: Normalize each updated field**

In `router.put('/:id', ...)`, the current block reads:

```ts
      const update: Record<string, string> = {};
      if (original) {
        if (typeof original !== 'string' || original.length > MAX_TEXT_LENGTH) {
          return res.status(400).json({ message: `original must be a string of at most ${MAX_TEXT_LENGTH} characters` });
        }
        update.original = original;
      }
      if (translation) {
        if (typeof translation !== 'string' || translation.length > MAX_TRANSLATION_LENGTH) {
          return res.status(400).json({ message: `translation must be a string of at most ${MAX_TRANSLATION_LENGTH} characters` });
        }
        update.translation = translation;
      }
```

Replace it with:

```ts
      const update: Record<string, string> = {};
      if (original) {
        if (typeof original !== 'string' || original.length > MAX_TEXT_LENGTH) {
          return res.status(400).json({ message: `original must be a string of at most ${MAX_TEXT_LENGTH} characters` });
        }
        const formatted = formatEntry(original);
        if (formatted.length === 0) {
          return res.status(400).json({ message: 'original must not be empty after formatting' });
        }
        update.original = formatted;
      }
      if (translation) {
        if (typeof translation !== 'string' || translation.length > MAX_TRANSLATION_LENGTH) {
          return res.status(400).json({ message: `translation must be a string of at most ${MAX_TRANSLATION_LENGTH} characters` });
        }
        const formatted = formatEntry(translation);
        if (formatted.length === 0) {
          return res.status(400).json({ message: 'translation must not be empty after formatting' });
        }
        update.translation = formatted;
      }
```

- [ ] **Step 2: Typecheck / build the route**

Run: `nx build entry-server`
Expected: builds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/entry-server/src/routes/translations-routes.ts
git commit -m "feat: normalize text on PUT /translations/:id"
```

---

### Task 4: Apply `formatEntry` to `POST /import` bulk handler

**Files:**
- Modify: `apps/entry-server/src/routes/translations-routes.ts` (the `router.post('/import', ...)` handler, around lines 328-329)

- [ ] **Step 1: Normalize each imported value before dedup/insert**

In `router.post('/import', ...)`, the current lines read:

```ts
        const original = String(wordText).slice(0, MAX_TEXT_LENGTH);
        const translation = String(translations[0]).slice(0, MAX_TRANSLATION_LENGTH);
```

Replace them with:

```ts
        const original = formatEntry(String(wordText).slice(0, MAX_TEXT_LENGTH));
        const translation = formatEntry(String(translations[0]).slice(0, MAX_TRANSLATION_LENGTH));
        if (original.length === 0 || translation.length === 0) {
          skipped.push(wordText);
          continue;
        }
```

The existing dedup-by-key logic below now compares normalized values, so it stays unchanged.

- [ ] **Step 2: Typecheck / build the route**

Run: `nx build entry-server`
Expected: builds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/entry-server/src/routes/translations-routes.ts
git commit -m "feat: normalize text on POST /translations/import"
```

---

### Task 5: One-off migration script — backup + dry-run + report

**Files:**
- Create: `apps/entry-server/src/scripts/normalize-translations.ts`

This script is run manually with ts-node; it has no automated test (it performs live DB I/O). Correctness of the transform itself is already covered by Task 1's unit tests.

- [ ] **Step 1: Write the migration script**

Create `apps/entry-server/src/scripts/normalize-translations.ts`:

```ts
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
 * Run (dry-run):  DB_URI=... npx ts-node apps/entry-server/src/scripts/normalize-translations.ts
 * Run (apply):    DB_URI=... npx ts-node apps/entry-server/src/scripts/normalize-translations.ts --apply
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
    const changes: Array<{ id: unknown; original: string; translation: string }> = [];
    const normalizedRows = rows.map((r) => {
      const original = formatEntry(r.original ?? '');
      const translation = formatEntry(r.translation ?? '');
      if (original !== r.original || translation !== r.translation) {
        changes.push({ id: r._id, original, translation });
      }
      return { ...r, original, translation };
    });
    console.log(`${changes.length} rows would change.`);

    // 3. Duplicate report on the normalized values.
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
          filter: { _id: c._id as TranslationDoc['_id'] },
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
```

- [ ] **Step 2: Verify the script typechecks**

Run: `npx tsc --noEmit -p apps/entry-server/tsconfig.app.json`
Expected: no errors for `normalize-translations.ts`. (If the project's tsconfig excludes scripts, instead run `npx tsc --noEmit apps/entry-server/src/scripts/normalize-translations.ts --esModuleInterop --skipLibCheck --module commonjs --target es2020 --moduleResolution node` and confirm only missing-type noise unrelated to this file, with no errors inside the script itself.)

- [ ] **Step 3: Dry-run against the database**

Run: `DB_URI="<your connection string>" npx ts-node apps/entry-server/src/scripts/normalize-translations.ts`
Expected output includes: "Loaded N translation rows.", "Backup written to backups/translations-...json", "M rows would change.", a duplicate report (or "No duplicates after normalization."), and "Dry-run complete." Confirm the backup JSON file exists and contains the row data.

- [ ] **Step 4: Commit the script (before applying)**

```bash
git add apps/entry-server/src/scripts/normalize-translations.ts
git commit -m "feat: add one-off translations normalization migration"
```

- [ ] **Step 5: Apply the migration**

Run: `DB_URI="<your connection string>" npx ts-node apps/entry-server/src/scripts/normalize-translations.ts --apply`
Expected output ends with: "Applied. Modified M rows." Review any reported duplicate groups and delete extras manually if desired. If anything looks wrong, restore by re-importing the JSON file written in Step 3.

---

### Task 6: Add `backups/` to `.gitignore`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ignore the backup output directory**

Append to `.gitignore`:

```
# DB migration backups (translations normalization, etc.)
/backups/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore migration backups directory"
```
