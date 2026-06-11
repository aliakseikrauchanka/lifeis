# Normalize Saved Translations — Design

**Date:** 2026-06-11
**Status:** Approved

## Problem

Words and sentences are saved into the `translations` collection as raw strings via
`POST /api/translations` (and bulk `POST /import`, and the MCP add-word tool, which both
funnel into the same write paths). Inconsistent casing, stray whitespace, and trailing
periods make the library and SRS flashcards look uneven. We want every stored
`original`/`translation` value to be normalized consistently, both for new writes and for
existing rows.

## Formatting rules

A single deterministic transform applies to both the `original` and `translation` fields,
with no word-vs-sentence detection:

1. **Trim** leading/trailing whitespace.
2. **Strip a single trailing period** (`.` only — `?` and `!` are preserved because they
   carry meaning), then re-trim the end.
3. **Capitalize the first letter** only. The rest of the string is left exactly as typed,
   so acronyms and proper nouns survive.

The transform is **idempotent**: applying it to an already-formatted value yields the same
value.

Examples:

| Input            | Output        |
| ---------------- | ------------- |
| `"dog"`          | `"Dog"`       |
| `"  kot  "`      | `"Kot"`       |
| `"the dog runs."`| `"The dog runs"` |
| `"Why?"`         | `"Why?"`      |
| `"USB cable"`    | `"USB cable"` |
| `"."`            | `""` (rejected by required-field validation) |

## Components

### 1. Shared formatter

**File:** `apps/entry-server/src/helpers/format-entry.ts`

```ts
export function formatEntry(value: string): string {
  let s = value.trim();
  if (s.endsWith('.')) s = s.slice(0, -1).trimEnd(); // strip one trailing period
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);      // capitalize first letter only
}
```

This is the single source of truth, used by both the live write paths and the migration
script.

### 2. Live formatting on write paths

**File:** `apps/entry-server/src/routes/translations-routes.ts`

- **`POST /`** — format `original` and `translation` immediately after the existing
  required-field check and **before** the length and duplicate checks, so dedup compares
  normalized values. After formatting, re-check non-empty: if a value reduced to empty
  (e.g. input was `"."` or pure whitespace), return `400` with the existing
  "required" message.
- **`PUT /:id`** — format whichever of `original`/`translation` is present in the update,
  before the length check. Apply the same empty-after-format guard.
- **`POST /import`** — run each imported `original`/`translation` through `formatEntry`
  before dedup and insert.

This covers the entry-app form, bulk import, and the MCP add-word tool (which goes through
`POST /`).

### 3. One-off migration script

**File:** `apps/entry-server/src/scripts/normalize-translations.ts`

Reuses the same `formatEntry` helper. Flow:

1. Connect using the existing `getMongoDbClient()` (reads `DB_URI`).
2. **Backup first.** Dump the entire `translations` collection to
   `backups/translations-<ISO-timestamp>.json`. If the backup write fails, **abort
   immediately** — no DB changes are made without a snapshot on disk.
3. Load all rows; compute normalized `original`/`translation`; collect the rows where
   either value actually changed.
4. **Dry-run by default.** Default invocation logs the count of rows that would change and
   prints the full duplicate report (see below), writing nothing. Passing `--apply`
   performs a bulk update of only the changed rows.
5. **Duplicate report.** After computing normalized values, group rows by
   `(owner_id, original, translation, originalLanguage, translationLanguage)` and print
   every group containing more than one row, including their `_id`s, so they can be
   reviewed and deleted manually later.

The migration **never deletes or merges** rows — this avoids SRS-card ambiguity
(`translation_srs.translation_id` references) and guarantees no data loss. Restore, if
ever needed, is a re-import of the JSON backup.

## Error handling

- Empty-after-format values are rejected with `400` on the live paths (consistent with the
  current required-field behavior).
- The migration aborts before any write if the backup cannot be created.
- The migration only updates rows whose normalized value differs, minimizing writes.

## Testing

Jest unit tests for `formatEntry` covering:

- trims both leading and trailing whitespace
- strips a single trailing period
- preserves trailing `?` and `!`
- capitalizes the first letter
- leaves the rest of the string untouched (acronym/proper-noun case)
- multi-word sentence
- value that becomes empty after formatting

## Out of scope

- No DB-migration framework is introduced; the script is a standalone one-off.
- No automatic dedup/merge of existing duplicates (reported only).
- No changes to existing rows beyond the normalization transform.
