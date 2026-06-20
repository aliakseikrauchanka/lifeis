# Import duplicate preview (training-app library)

Date: 2026-06-20

## Problem

The Library page (`apps/training-app`) imports words+translations from an LLN
JSON file. The server already skips duplicates during `/translations/import`,
but the user only learns what happened *after* the import (a terse
"Imported X (Y skipped)" string). The user wants to see, **before** importing,
which words from the list already exist in their library.

The comparison must use the normalization logic already in place (`formatEntry`)
so that, e.g., `apple` in the file matches an existing `Apple` row.

## Decisions (from brainstorming)

- **Where the check runs:** server-side, via a dry-run on the existing import
  endpoint. This keeps normalization (`formatEntry`), language mapping,
  validation, and the authoritative DB existence check in one place — no logic
  is duplicated into the frontend, so preview and real import can never drift.
- **Match rule:** mirror the current server behavior exactly — a word "exists"
  when its normalized `original` + `originalLanguage` + `translationLanguage`
  matches an existing row for the user. Translation text is not part of the key.
- **UX:** a confirm dialog showing a breakdown ("X new · Y already in library ·
  Z skipped") with the list of existing words. Importing proceeds only on
  confirm.
- **Endpoint:** reuse `POST /translations/import` with a `dryRun` flag (not a
  separate route).
- **Confirm step:** re-send *all* parsed items to the real import; the server's
  existing dedup makes this idempotent, so the client does not need to compute
  or send "only the new ones."

## Design

### Server — `apps/entry-server/src/routes/translations-routes.ts`

The `/import` handler currently: loops items → validates → `formatEntry`
normalizes → builds `docs` (or pushes to `skipped`) → queries existing rows →
filters out duplicates → `insertMany`.

Changes:

1. Extract the per-item loop into a local helper, e.g.
   `buildImportDocs(items, userId, now) -> { docs, skipped }`, where each doc
   carries its normalized `original`/`translation`/language pair and `skipped`
   holds the original word texts that could not be imported. No behavior change
   — pure refactor so both the dry-run and real paths share identical parsing
   and normalization.
2. After querying existing rows and splitting `docs` into `newDocs` vs
   `duplicates` (same key as today:
   `original | originalLanguage | translationLanguage`):
   - If `req.body.dryRun` is truthy, respond **without inserting**:
     ```json
     {
       "total": <items.length>,
       "toImportCount": <newDocs.length>,
       "duplicates": ["<word>", ...],
       "skipped": ["<word>", ...]
     }
     ```
     `duplicates` lists the original word text of each item that already exists;
     `skipped` lists items that failed validation/mapping.
   - Otherwise, behave exactly as today: `insertMany(newDocs)` and respond with
     `{ inserted, duplicates, skipped, total }` (counts). Backward compatible.

The existence query and dedup key are unchanged, so the dry-run result is an
exact prediction of what the real import will insert.

### API client — `apps/training-app/src/app/api/srs.api.ts`

- Add `previewImportTranslations(items: unknown[])` that POSTs to
  `/translations/import` with `{ items, dryRun: true }` and is typed to the
  breakdown:
  `{ total: number; toImportCount: number; duplicates: string[]; skipped: string[] }`.
- Leave `importTranslations(items)` unchanged for the confirm step.

### UI — `apps/training-app/src/app/pages/library.page.tsx`

- `handleFileUpload` becomes a two-phase flow:
  1. Validate the file client-side as today (≤15 MB, `JSON.parse`, must be an
     array, ≤500 items) and keep the parsed `items` in component state.
  2. Call `previewImportTranslations(items)` and open the confirm dialog with
     the returned breakdown. Do **not** import yet.
- New state: the parsed `items`, the preview result, and dialog open/loading
  flags. Reset the file input value after parsing (as today) so the same file
  can be re-picked.
- On **Import** (confirm): call `importTranslations(items)`, then `load()` +
  `refreshIndex()`, close the dialog, and surface the existing `importResult`
  summary. On **Cancel**: discard items + preview, close dialog.
- Errors during preview/import: show the existing `importResult` failure message
  and close/keep the dialog closed.

### New component — `apps/training-app/src/app/components/import-preview-dialog.tsx`

- Presentational confirm dialog styled like `translation-add-modal.tsx`
  (fixed overlay, `ui/button`, Escape + backdrop to cancel).
- Props: breakdown counts, `duplicates`/`skipped` word lists, `loading`,
  `onConfirm`, `onCancel`.
- Shows the headline counts and a scrollable list of words already in the
  library (and skipped, if any). Confirm button disabled while `loading`.

### i18n — `apps/training-app/src/app/i18n/messages.ts`

Add keys for the dialog: title, the "X new / Y existing / Z skipped" summary,
the "already in library" / "skipped" section headers, and Confirm/Cancel
labels. Follow the existing `library.*` / `modal.*` key conventions and add
translations for all locales already present in the file.

## Testing

- **Server:** a test for `POST /translations/import` with `dryRun: true` that:
  - asserts **no document is inserted** (collection count unchanged);
  - asserts an item whose `original` differs only by `formatEntry` normalization
    (e.g. file `"apple"` vs existing `"Apple"`) is reported under `duplicates`;
  - asserts a genuinely new item is counted in `toImportCount`;
  - asserts an item with an unmapped/invalid language or missing fields is
    reported under `skipped`.
- Follow the existing entry-server test setup/patterns for this route.

## Out of scope

- Changing the dedup key to include translation text.
- Unifying the two normalizers (`formatEntry` vs the add-modal's local
  `normalize`); the modal is untouched here.
- Any change to the import file format.
