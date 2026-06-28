# Translation Content Tabs (Translations / Explanation / Correction)

Date: 2026-06-27
App: training-app (frontend) + entry-server (backend)
Component: `apps/training-app/src/app/components/translation-add-modal.tsx`, `apps/entry-server/src/routes/translations-routes.ts`

## Revision 2026-06-28 — on-demand, UI-language (SUPERSEDES the single-call design below)

After the first implementation, the approach changed. The sections below describe the
original single-enriched-call design; the shipped behavior is:

- **Explanation and Correction are fetched on demand**, not bundled into `/translate`.
  `/translate` reverts to **lean** (translations + examples only). Two new endpoints:
  - `POST /api/translations/explain` → `{ explanation: { partOfSpeech, inflection, note } | null }`
  - `POST /api/translations/correct` → `{ correction: { corrected, what, why } | null }`
    (`null` = no mistake found)
  Each takes `{ text, language, provider, uiLanguage }`. The frontend fetches the active
  provider's explanation/correction the first time that tab is opened and **caches per
  provider** (`AsyncCell` with loading/error/done). Caches reset on translate/clear/navigate.
- **Explanations are written in the UI interface language** (the Profile → Interface
  Language setting, `useI18n().locale`, one of en/ru/pl/es → English/Russian/Polish/Spanish).
  Meta-text (part of speech, table title, row labels, note, correction what/why) is in the
  UI language; the inflected word forms in the table cells and `corrected` stay in the
  source language.
- **No settings toggle.** The feature is always available on demand; an earlier idea to
  gate it behind a persisted training-app setting was dropped.
- **Correction tab is always present** (except for Glosbe). Opening it fetches; "No
  mistakes found." is shown when the model reports no mistake. Glosbe (a dictionary
  scrape) shows the explanation empty state and hides the Correction tab.
- Backend reuse: a shared `runLLMJson(provider, systemPrompt, userText)` helper dispatches
  to the right model; `parseExplanationJson` / `parseCorrectionJson` validate/cap output.
- Applying a correction replaces the source field (Original in forward mode, Translation
  in reverse) without re-translating — **unchanged** from the original design.

The remainder of this document is retained for history.

## Revision 2026-06-28 (b) — correction merged into Translations, richer explanation

- **Correction moved back into `/translate`** (BE merge): each provider's translate call
  again returns `correction: { corrected, what, why } | null`, with what/why in the UI
  language (so `/translate` now takes `uiLanguage`). The separate on-demand `/correct`
  endpoint and `correctText` client are removed.
- **Content tabs are now just Translations / Explanation.** The correction (when present)
  renders as a highlighted block at the top of the **Translations** tab; clicking the
  corrected text still replaces the source field without re-translating.
- **Explanation gains a `meaning`** field — a brief plain-language definition in the UI
  language — shown above part of speech.
- **Inflection table reflects the base form's full paradigm.** When the looked-up word is
  an inflected form, the explanation still declines/conjugates the dictionary (base) form
  across all cases/persons.
- Explanation remains on-demand via `/explain`.

## Goal

When translations from different AI providers come back in the Add Translation modal,
enrich each provider's result with two new kinds of information and present everything
under a second-level set of content tabs:

1. **Translations** — translation options + examples (current behavior).
2. **Explanation** — what part of speech the source is and how it changes by cases
   (declension/conjugation), plus a short usage note.
3. **Correction** — shown only when the provider detects a mistake in the source
   word/sentence: a clickable corrected version (replaces the source input) plus an
   explanation of what was wrong and why.

## Decisions (from brainstorming)

- **Provider tabs stay on top, unchanged.** A new content-tab bar sits *below* the
  provider tab row. Switching provider swaps the whole content set.
- **Every LLM provider generates all the info** (translations, examples, explanation,
  correction) in **one enriched call** per provider — one round-trip, all tabs populate
  together when that provider finishes.
- **Glosbe** is a dictionary scraper, not an LLM. It keeps returning translations only.
  Its Explanation tab shows an empty state ("Not available for this provider") and its
  Correction tab never appears.
- **Explanation is structured**: part of speech + an inflection/declension/conjugation
  table rendered as a grid + a short note.
- **Correction apply replaces the source input only — no auto re-translate.** Results
  stay until the user hits translate again. The corrected text targets whichever field
  was the source (Original in forward mode, Translation in reverse mode).

## Data Model

### Backend response (`POST /translations/translate`)

Extend the existing `{ translations, examples, error }` response with two nullable fields:

```ts
interface ProviderExplanation {
  partOfSpeech: string;            // e.g. "noun (masculine, animate)"
  inflection: {                    // null when not applicable (e.g. uninflected word, sentence)
    title: string;                 // e.g. "Declension" | "Conjugation"
    columns: string[];             // e.g. ["", "Singular", "Plural"]
    rows: { label: string; cells: string[] }[]; // e.g. { label: "Nom", cells: ["kot", "koty"] }
  } | null;
  note: string | null;             // short usage note, may be null
}

interface ProviderCorrection {
  corrected: string;               // corrected version of the source text
  what: string;                    // what was wrong
  why: string;                     // why it is wrong
}

interface ProviderTranslationResult {
  translations: string[];
  examples: Example[];
  explanation: ProviderExplanation | null;
  correction: ProviderCorrection | null;  // null when the source has no mistake
  error: string | null;
}
```

The same `ProviderTranslationResult` shape is mirrored in
`apps/training-app/src/app/api/srs.api.ts`, with the new `ProviderExplanation` and
`ProviderCorrection` interfaces exported.

## Backend Changes (`translations-routes.ts`)

### Enriched system prompt

The `/translate` system prompt is expanded so the LLM returns `explanation` and
`correction` in addition to `translations` and `examples`:

- `explanation` describes the **source** text in the **source language**: part of speech
  (with gender/animacy where relevant), and how it changes by cases — a declension table
  for nouns/adjectives, a conjugation table for verbs. `inflection` is `null` when not
  applicable (indeclinable words, or multi-word sentences where a single table doesn't
  fit). `note` is a short optional usage hint.
- `correction` is returned **only if** the source text contains a spelling or grammar
  mistake. It contains the corrected source text plus `what`/`why`. When the source is
  correct, `correction` is `null`.

The prompt continues to require a strict JSON object and (for Anthropic) "no surrounding
prose or code fences."

### Defensive parsing

`parseTranslationJson` is extended to parse the two new fields with the same defensive
posture as today:

- `explanation`: accept only if `partOfSpeech` is a non-empty string. `inflection` is
  accepted only if `title` is a string, `columns` is a string array, and `rows` is an
  array of `{ label: string, cells: string[] }`; otherwise `inflection` is `null`.
  `note` accepted only if string, else `null`. Any malformed shape → `explanation: null`.
- `correction`: accept only if `corrected`, `what`, and `why` are all non-empty strings;
  otherwise `correction: null`.
- **Caps** (guard against token-stuffing / runaway output): `columns` ≤ 6, `rows` ≤ 20,
  `cells` per row ≤ 6, and every string field truncated to a sane max (e.g. 500 chars;
  `corrected` capped to `MAX_TEXT_LENGTH`).

### Provider wiring

- `openai`, `deepseek`, `gemini`, `anthropic`, `claude-opus`: return
  `{ ...parsed, error: null }` where `parsed` now includes `explanation` and `correction`.
- Anthropic calls: bump `max_tokens` from `1024` to `2048` so declension tables fit.
- `glosbe`: return `explanation: null, correction: null` alongside its translations.
- The `catch` fallback returns `explanation: null, correction: null` too.

## Frontend Changes (`translation-add-modal.tsx`)

### New state

```ts
const [activeContentTab, setActiveContentTab] =
  useState<'translations' | 'explanation' | 'correction'>('translations');
```

- Reset to `'translations'` wherever `providerResults`/`suggestionTarget` are reset
  (handleTranslate start, handleSave, handlePrev, handleNext, handleNewEntry).

### Layout

Inside the existing `providerResults` block, the structure becomes:

```
[ provider tab row ]               <- unchanged (Opus | DeepSeek | Glosbe | Gemini | Sonnet)
[ content tab row ]                <- NEW: Translations | Explanation | Correction
[ active content panel ]
```

The content tab row renders below the provider tabs and above the panel body
(replacing the current single panel that mixes translations + examples).

- **Translations** tab: the current rendering (translation chips + examples) moves here
  verbatim.
- **Explanation** tab: renders `partOfSpeech`, the `inflection` table as a CSS grid
  (columns header row + labelled rows), and `note`. When `explanation` is `null`
  (Glosbe, or model returned none), show the empty state
  `t('modal.explanationUnavailable')`.
- **Correction** tab: rendered in the content tab bar **only** when the active provider's
  `correction` is non-null. Body shows the corrected text as a clickable button plus the
  `what` and `why` text. Clicking the corrected text applies it to the source field.

### Correction-tab visibility & fallback

- The Correction tab button appears in the content tab row only when
  `providerResults[activeProvider]?.correction` is truthy.
- If `activeContentTab === 'correction'` and the (newly) active provider has no
  correction, fall back to rendering the Translations panel (derive an effective tab:
  `correction` is only honored when a correction exists, else treat as `translations`).
- Switching provider keeps `activeContentTab` selected (per decision), with the fallback
  above handling providers that lack a correction.

### Apply correction

```ts
const sourceField = suggestionTarget === 'translation' ? 'original' : 'translation';
const applyCorrection = (corrected: string) => {
  setAddForm((prev) => ({ ...prev, [sourceField]: corrected }));
};
```

- `suggestionTarget === 'translation'` means forward mode (source = Original).
- `suggestionTarget === 'original'` means reverse mode (source = Translation).
- No re-translate is triggered. Existing `providerResults` stay until the user presses
  translate again.

### API client (`srs.api.ts`)

- Export `ProviderExplanation` and `ProviderCorrection` interfaces.
- Add `explanation` and `correction` to `ProviderTranslationResult`.
- `translateText` already returns `res.json()`, so no call-site signature change.

### i18n (`messages.ts`)

New keys (added for every supported locale in the file):

- `modal.tabTranslations`, `modal.tabExplanation`, `modal.tabCorrection`
- `modal.explanationUnavailable`
- `modal.partOfSpeech`, `modal.inflectionHeading`, `modal.usageNote`
- `modal.correctionHeading`, `modal.correctionWhat`, `modal.correctionWhy`,
  `modal.applyCorrection`

## Error / Edge Handling

- Provider still loading: the content tabs render once that provider's result exists;
  the existing per-provider loading spinner is preserved in the Translations panel.
- Provider `error`: the existing error message renders inside the Translations panel;
  Explanation shows the empty state; Correction tab is absent.
- `inflection: null` but `partOfSpeech` present: render part of speech + note only.
- All-correct source across all providers: Correction tab simply never appears.

## Testing

- **Backend (jest, entry-server):** unit tests for the extended `parseTranslationJson`:
  - valid explanation with inflection table → parsed and capped correctly
  - explanation missing / malformed `inflection` → `inflection: null`, partOfSpeech kept
  - explanation entirely malformed → `explanation: null`
  - correction with all three fields → parsed
  - correction missing a field → `correction: null`
  - oversized columns/rows/cells/strings → truncated to caps
- **Frontend (training-app):** if the test harness supports component tests, cover
  content-tab switching, Correction tab visibility (present vs absent), Glosbe empty
  state, and apply-correction targeting the correct source field. Confirm harness
  availability during planning; otherwise verify manually.

## Out of Scope

- No changes to how/when the translate calls fire (still all providers in parallel on
  translate).
- No persistence of explanation/correction with saved translations.
- No re-translate after applying a correction.
- No changes to the Glosbe scrape path beyond returning the two null fields.
