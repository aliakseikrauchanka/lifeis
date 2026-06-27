# Translation Content Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second-level tab bar (Translations / Explanation / Correction) below the existing provider tabs in the Add Translation modal, with each AI provider returning grammar explanation and a mistake correction alongside translations.

**Architecture:** Extend the `/translations/translate` LLM response with two nullable fields (`explanation`, `correction`) parsed by an extracted, unit-tested helper. The frontend mirrors the types and renders a content-tab bar inside the existing provider-results block; the Correction tab only appears when the active provider returns a correction, and applying it overwrites the source input.

**Tech Stack:** Express + TypeScript (entry-server, jest), React + Vite + Tailwind (training-app), Nx monorepo.

## Global Constraints

- Supported provider list (unchanged): `openai`, `deepseek`, `glosbe`, `gemini`, `anthropic`, `claude-opus`. Glosbe is a dictionary scrape — it returns `explanation: null, correction: null`.
- Anthropic models: `claude-opus-4-8` (claude-opus), `claude-sonnet-4-6` (anthropic).
- `MAX_TEXT_LENGTH = 2000` (entry-server) is the existing cap for source text.
- Field caps for parsed explanation/correction: string fields ≤ 500 chars (`corrected` ≤ 2000), `columns` ≤ 6, `rows` ≤ 20, `cells` per row ≤ 6, `translations` ≤ 5, `examples` ≤ 5.
- i18n: every key added to `en` MUST also be added to `ru` and `pl` in `messages.ts` (the `en` object's keys define the `MessageKey` type; bundles are typed `Record<MessageKey, string>`).
- training-app has **no** test harness — frontend tasks are verified with `nx lint` + `nx build` + manual check, not unit tests. entry-server uses jest.
- Commit after each task.

---

### Task 1: Extract and extend `parseTranslationJson` helper (backend, TDD)

Pull the inline `parseTranslationJson` out of `translations-routes.ts` into a focused, testable helper module and add `explanation` + `correction` parsing.

**Files:**
- Create: `apps/entry-server/src/helpers/parse-translation-json.ts`
- Create: `apps/entry-server/src/helpers/parse-translation-json.spec.ts`

**Interfaces:**
- Consumes: nothing (pure function over a JSON string).
- Produces:
  - `interface InflectionTable { title: string; columns: string[]; rows: { label: string; cells: string[] }[]; }`
  - `interface ProviderExplanation { partOfSpeech: string; inflection: InflectionTable | null; note: string | null; }`
  - `interface ProviderCorrection { corrected: string; what: string; why: string; }`
  - `interface ParsedTranslation { translations: string[]; examples: Array<{ original: string; translated: string }>; explanation: ProviderExplanation | null; correction: ProviderCorrection | null; }`
  - `function parseTranslationJson(raw: string): ParsedTranslation` — throws on invalid JSON (caller's try/catch handles it, preserving current behavior).

- [ ] **Step 1: Write the failing tests**

Create `apps/entry-server/src/helpers/parse-translation-json.spec.ts`:

```ts
import { parseTranslationJson } from './parse-translation-json';

describe('parseTranslationJson', () => {
  it('parses translations and examples (existing behavior)', () => {
    const raw = JSON.stringify({
      translations: ['kot', 'kotek'],
      examples: [{ original: 'Mam kota', translated: 'I have a cat' }],
    });
    const r = parseTranslationJson(raw);
    expect(r.translations).toEqual(['kot', 'kotek']);
    expect(r.examples).toEqual([{ original: 'Mam kota', translated: 'I have a cat' }]);
    expect(r.explanation).toBeNull();
    expect(r.correction).toBeNull();
  });

  it('parses a structured explanation with an inflection table', () => {
    const raw = JSON.stringify({
      translations: [],
      examples: [],
      explanation: {
        partOfSpeech: 'noun (masculine, animate)',
        inflection: {
          title: 'Declension',
          columns: ['', 'Singular', 'Plural'],
          rows: [
            { label: 'Nom', cells: ['kot', 'koty'] },
            { label: 'Gen', cells: ['kota', 'kotów'] },
          ],
        },
        note: 'Animate masculine: accusative = genitive.',
      },
    });
    const r = parseTranslationJson(raw);
    expect(r.explanation).toEqual({
      partOfSpeech: 'noun (masculine, animate)',
      inflection: {
        title: 'Declension',
        columns: ['', 'Singular', 'Plural'],
        rows: [
          { label: 'Nom', cells: ['kot', 'koty'] },
          { label: 'Gen', cells: ['kota', 'kotów'] },
        ],
      },
      note: 'Animate masculine: accusative = genitive.',
    });
  });

  it('keeps partOfSpeech but nulls a malformed inflection', () => {
    const raw = JSON.stringify({
      explanation: { partOfSpeech: 'verb', inflection: { title: 'Conjugation', columns: 'nope', rows: [] }, note: null },
    });
    const r = parseTranslationJson(raw);
    expect(r.explanation).not.toBeNull();
    expect(r.explanation?.partOfSpeech).toBe('verb');
    expect(r.explanation?.inflection).toBeNull();
  });

  it('nulls the whole explanation when partOfSpeech is missing', () => {
    const raw = JSON.stringify({ explanation: { inflection: null, note: 'x' } });
    expect(parseTranslationJson(raw).explanation).toBeNull();
  });

  it('parses a correction when all three fields are present', () => {
    const raw = JSON.stringify({
      correction: { corrected: 'kota', what: 'Wrong case ending', why: 'Accusative of animate masculine is "kota".' },
    });
    expect(parseTranslationJson(raw).correction).toEqual({
      corrected: 'kota',
      what: 'Wrong case ending',
      why: 'Accusative of animate masculine is "kota".',
    });
  });

  it('nulls the correction when a field is missing', () => {
    const raw = JSON.stringify({ correction: { corrected: 'kota', what: 'Wrong case' } });
    expect(parseTranslationJson(raw).correction).toBeNull();
  });

  it('caps oversized tables and strings', () => {
    const raw = JSON.stringify({
      explanation: {
        partOfSpeech: 'x'.repeat(1000),
        inflection: {
          title: 'T',
          columns: Array(10).fill('c'),
          rows: Array(50).fill(0).map((_, i) => ({ label: `r${i}`, cells: Array(10).fill('v') })),
        },
        note: null,
      },
    });
    const r = parseTranslationJson(raw);
    expect(r.explanation?.partOfSpeech.length).toBe(500);
    expect(r.explanation?.inflection?.columns.length).toBe(6);
    expect(r.explanation?.inflection?.rows.length).toBe(20);
    expect(r.explanation?.inflection?.rows[0].cells.length).toBe(6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `nx test entry-server --testFile=apps/entry-server/src/helpers/parse-translation-json.spec.ts`
Expected: FAIL — cannot find module `./parse-translation-json`.

- [ ] **Step 3: Write the implementation**

Create `apps/entry-server/src/helpers/parse-translation-json.ts`:

```ts
const MAX_FIELD_LENGTH = 500;
const MAX_CORRECTED_LENGTH = 2000;
const MAX_COLUMNS = 6;
const MAX_ROWS = 20;
const MAX_CELLS = 6;
const MAX_TRANSLATIONS = 5;
const MAX_EXAMPLES = 5;

export interface InflectionTable {
  title: string;
  columns: string[];
  rows: { label: string; cells: string[] }[];
}

export interface ProviderExplanation {
  partOfSpeech: string;
  inflection: InflectionTable | null;
  note: string | null;
}

export interface ProviderCorrection {
  corrected: string;
  what: string;
  why: string;
}

export interface ParsedTranslation {
  translations: string[];
  examples: Array<{ original: string; translated: string }>;
  explanation: ProviderExplanation | null;
  correction: ProviderCorrection | null;
}

const isStr = (x: unknown): x is string => typeof x === 'string';
const truncate = (s: string, max: number): string => (s.length > max ? s.slice(0, max) : s);
const isNonEmpty = (x: unknown): x is string => isStr(x) && x.trim().length > 0;

function parseInflection(raw: unknown): InflectionTable | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { title?: unknown; columns?: unknown; rows?: unknown };
  if (!isStr(r.title)) return null;
  if (!Array.isArray(r.columns) || !r.columns.every(isStr)) return null;
  if (!Array.isArray(r.rows)) return null;
  const rows = r.rows
    .filter(
      (row: unknown): row is { label: string; cells: string[] } =>
        !!row &&
        typeof row === 'object' &&
        isStr((row as { label?: unknown }).label) &&
        Array.isArray((row as { cells?: unknown }).cells) &&
        (row as { cells: unknown[] }).cells.every(isStr),
    )
    .slice(0, MAX_ROWS)
    .map((row) => ({
      label: truncate(row.label, MAX_FIELD_LENGTH),
      cells: row.cells.slice(0, MAX_CELLS).map((c) => truncate(c, MAX_FIELD_LENGTH)),
    }));
  return {
    title: truncate(r.title, MAX_FIELD_LENGTH),
    columns: r.columns.slice(0, MAX_COLUMNS).map((c) => truncate(c, MAX_FIELD_LENGTH)),
    rows,
  };
}

function parseExplanation(raw: unknown): ProviderExplanation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { partOfSpeech?: unknown; inflection?: unknown; note?: unknown };
  if (!isNonEmpty(r.partOfSpeech)) return null;
  return {
    partOfSpeech: truncate(r.partOfSpeech, MAX_FIELD_LENGTH),
    inflection: parseInflection(r.inflection),
    note: isStr(r.note) ? truncate(r.note, MAX_FIELD_LENGTH) : null,
  };
}

function parseCorrection(raw: unknown): ProviderCorrection | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { corrected?: unknown; what?: unknown; why?: unknown };
  if (!isNonEmpty(r.corrected) || !isNonEmpty(r.what) || !isNonEmpty(r.why)) return null;
  return {
    corrected: truncate(r.corrected, MAX_CORRECTED_LENGTH),
    what: truncate(r.what, MAX_FIELD_LENGTH),
    why: truncate(r.why, MAX_FIELD_LENGTH),
  };
}

export function parseTranslationJson(raw: string): ParsedTranslation {
  const parsed = JSON.parse(raw);
  return {
    translations: Array.isArray(parsed.translations)
      ? parsed.translations.filter(isStr).slice(0, MAX_TRANSLATIONS)
      : [],
    examples: Array.isArray(parsed.examples)
      ? parsed.examples
          .filter(
            (e: unknown): e is { original: string; translated: string } =>
              !!e &&
              isStr((e as { original?: unknown }).original) &&
              isStr((e as { translated?: unknown }).translated),
          )
          .slice(0, MAX_EXAMPLES)
      : [],
    explanation: parseExplanation(parsed.explanation),
    correction: parseCorrection(parsed.correction),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `nx test entry-server --testFile=apps/entry-server/src/helpers/parse-translation-json.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/entry-server/src/helpers/parse-translation-json.ts apps/entry-server/src/helpers/parse-translation-json.spec.ts
git commit -m "feat(entry-server): extract parseTranslationJson helper with explanation/correction parsing"
```

---

### Task 2: Wire enriched prompt + helper into the `/translate` route (backend)

Replace the inline parser, expand the system prompt, bump Anthropic `max_tokens`, and return the new fields for every provider path.

**Files:**
- Modify: `apps/entry-server/src/routes/translations-routes.ts` (imports near line 11; `/translate` handler lines 424–545)

**Interfaces:**
- Consumes: `parseTranslationJson`, `ParsedTranslation` from Task 1.
- Produces: `/translations/translate` JSON response now includes `explanation: ProviderExplanation | null` and `correction: ProviderCorrection | null` alongside `translations`, `examples`, `error`.

- [ ] **Step 1: Add the helper import**

Add to the import block (after line 11, `import { buildImportDocs, ... }`):

```ts
import { parseTranslationJson } from '../helpers/parse-translation-json';
```

- [ ] **Step 2: Replace the system prompt**

Replace the `systemPrompt` constant (lines 455–458) with:

```ts
    const systemPrompt = `You are a precise translator and language tutor. The user message is the SOURCE text written in ${originalLanguage ?? 'its original language'}. Return a JSON object with:
- "translations": array of exactly 3 distinct translation options for the source text into ${targetLanguage} (vary by formality, style, or synonyms)
- "examples": array of exactly 3 objects, each with "original" (example sentence in ${originalLanguage ?? 'the source language'}) and "translated" (its translation in ${targetLanguage})
- "explanation": an object describing the SOURCE text in its own language, with:
    - "partOfSpeech": short label, e.g. "noun (masculine, animate)" or "verb (imperfective)"
    - "inflection": either null (for indeclinable words or multi-word sentences) or an object with "title" (e.g. "Declension" or "Conjugation"), "columns" (array of column headers, first usually ""), and "rows" (array of objects with "label" for the case/person and "cells" matching the columns)
    - "note": a short usage note, or null
- "correction": null if the source text has no spelling or grammar mistake. If it DOES contain a mistake, an object with "corrected" (the corrected source text), "what" (what was wrong), and "why" (why it is wrong).
No extra fields. Respond with only the JSON object.`;
```

- [ ] **Step 3: Remove the inline parser and retype `callLLM`**

Delete the inline `parseTranslationJson` definition (lines 460–479). Update `callLLM`'s return type (lines 481–494) to use the imported `ParsedTranslation`:

```ts
    const callLLM = async (client: OpenAI, model: string): Promise<ParsedTranslation> => {
      const completion = await client.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      });
      return parseTranslationJson(completion.choices[0].message.content ?? '{}');
    };
```

Add the type import alongside the value import in Step 1:

```ts
import { parseTranslationJson, ParsedTranslation } from '../helpers/parse-translation-json';
```

- [ ] **Step 4: Bump Anthropic max_tokens and confirm spreads**

In the `anthropic`/`claude-opus` branch (line ~517) change `max_tokens: 1024` to `max_tokens: 2048`. The branch already does `const r = parseTranslationJson(raw); return res.json({ ...r, error: null });` — `r` now carries `explanation`/`correction`, so no further change. Confirm the `openai`, `deepseek`, and `gemini` branches all `return res.json({ ...r, error: null })`.

- [ ] **Step 5: Add null fields to Glosbe and catch paths**

Glosbe success branches (lines ~529 and ~537) currently return `{ translations: ..., examples: [], error: null }`. Update both to include the new fields:

```ts
      // empty-langs guard:
      return res.json({ translations: [], examples: [], explanation: null, correction: null, error: null });
      // ...
      // glosbe result:
      return res.json({ translations: result.translations ?? [], examples: [], explanation: null, correction: null, error: null });
```

Update the `catch` (lines ~538–544):

```ts
    } catch (err) {
      return res.json({
        translations: [],
        examples: [],
        explanation: null,
        correction: null,
        error: (err as Error)?.message ?? 'failed',
      });
    }
```

- [ ] **Step 6: Verify build and lint**

Run: `nx build entry-server`
Expected: succeeds, no TypeScript errors.
Run: `nx lint entry-server`
Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add apps/entry-server/src/routes/translations-routes.ts
git commit -m "feat(entry-server): return grammar explanation and mistake correction from /translate"
```

---

### Task 3: Extend frontend API types (training-app)

Mirror the backend response shape in the frontend API client.

**Files:**
- Modify: `apps/training-app/src/app/api/srs.api.ts` (lines 176–197)

**Interfaces:**
- Consumes: backend `/translations/translate` response from Task 2.
- Produces: exported `ProviderExplanation`, `ProviderCorrection`, and an extended `ProviderTranslationResult` for the modal (Task 5).

- [ ] **Step 1: Add types and extend the result interface**

Replace the `ProviderTranslationResult` interface (lines 178–182) with:

```ts
export interface InflectionTable {
  title: string;
  columns: string[];
  rows: { label: string; cells: string[] }[];
}

export interface ProviderExplanation {
  partOfSpeech: string;
  inflection: InflectionTable | null;
  note: string | null;
}

export interface ProviderCorrection {
  corrected: string;
  what: string;
  why: string;
}

export interface ProviderTranslationResult {
  translations: string[];
  examples: Example[];
  explanation: ProviderExplanation | null;
  correction: ProviderCorrection | null;
  error: string | null;
}
```

`translateText` returns `res.json()`, so no call-site change.

- [ ] **Step 2: Verify build**

Run: `nx build training-app`
Expected: succeeds (no consumers reference the new fields yet, existing code still compiles).

- [ ] **Step 3: Commit**

```bash
git add apps/training-app/src/app/api/srs.api.ts
git commit -m "feat(training-app): add explanation/correction to ProviderTranslationResult types"
```

---

### Task 4: Add i18n keys (training-app)

Add the content-tab and panel strings to all three locales.

**Files:**
- Modify: `apps/training-app/src/app/i18n/messages.ts` (`en` ends line 278, `ru` line 416, `pl` line 554)

**Interfaces:**
- Consumes: nothing.
- Produces: message keys used by the modal in Task 5: `modal.tabTranslations`, `modal.tabExplanation`, `modal.tabCorrection`, `modal.explanationUnavailable`, `modal.partOfSpeech`, `modal.inflectionHeading`, `modal.usageNote`, `modal.correctionHeading`, `modal.correctionWhat`, `modal.correctionWhy`, `modal.applyCorrection`.

- [ ] **Step 1: Add the English keys**

In the `en` object, after `'modal.getExamples': 'Get examples',` (line 103) add:

```ts
  'modal.tabTranslations': 'Translations',
  'modal.tabExplanation': 'Explanation',
  'modal.tabCorrection': 'Correction',
  'modal.explanationUnavailable': 'Not available for this provider.',
  'modal.partOfSpeech': 'Part of speech',
  'modal.inflectionHeading': 'How it changes',
  'modal.usageNote': 'Note',
  'modal.correctionHeading': 'Suggested correction',
  'modal.correctionWhat': 'What was wrong',
  'modal.correctionWhy': 'Why',
  'modal.applyCorrection': 'Use this correction',
```

- [ ] **Step 2: Add the Russian keys**

In the `ru` object, after its `'modal.getExamples': 'Получить примеры',` entry (line 243) add:

```ts
  'modal.tabTranslations': 'Переводы',
  'modal.tabExplanation': 'Объяснение',
  'modal.tabCorrection': 'Исправление',
  'modal.explanationUnavailable': 'Недоступно для этого провайдера.',
  'modal.partOfSpeech': 'Часть речи',
  'modal.inflectionHeading': 'Как изменяется',
  'modal.usageNote': 'Примечание',
  'modal.correctionHeading': 'Предлагаемое исправление',
  'modal.correctionWhat': 'Что было не так',
  'modal.correctionWhy': 'Почему',
  'modal.applyCorrection': 'Применить исправление',
```

- [ ] **Step 3: Add the Polish keys**

In the `pl` object, after its `'modal.getExamples'` entry add:

```ts
  'modal.tabTranslations': 'Tłumaczenia',
  'modal.tabExplanation': 'Wyjaśnienie',
  'modal.tabCorrection': 'Poprawka',
  'modal.explanationUnavailable': 'Niedostępne dla tego dostawcy.',
  'modal.partOfSpeech': 'Część mowy',
  'modal.inflectionHeading': 'Jak się odmienia',
  'modal.usageNote': 'Uwaga',
  'modal.correctionHeading': 'Sugerowana poprawka',
  'modal.correctionWhat': 'Co było nie tak',
  'modal.correctionWhy': 'Dlaczego',
  'modal.applyCorrection': 'Zastosuj poprawkę',
```

- [ ] **Step 4: Verify build (type-checks all locales cover MessageKey)**

Run: `nx build training-app`
Expected: succeeds. If a locale is missing a key, the `Record<MessageKey, string>` bundle type fails — fix the missing key.

- [ ] **Step 5: Commit**

```bash
git add apps/training-app/src/app/i18n/messages.ts
git commit -m "feat(training-app): add i18n keys for translation content tabs"
```

---

### Task 5: Render content tabs in the modal (training-app)

Add the content-tab state and bar below the provider tabs, split the panel into three content panels, and wire apply-correction.

**Files:**
- Modify: `apps/training-app/src/app/components/translation-add-modal.tsx` (imports line 7–13; state block ~117–127; resets in `handleTranslate`/`handleSave`/`handlePrev`/`handleNext`/`handleNewEntry`; the `providerResults` render block lines 632–772)

**Interfaces:**
- Consumes: `ProviderExplanation`, `ProviderCorrection` types and the extended `ProviderTranslationResult` from Task 3; i18n keys from Task 4.
- Produces: UI only (no exported interface).

- [ ] **Step 1: Import the new types**

Update the import from `../api/srs.api` (lines 7–13) to add `ProviderExplanation` and `ProviderCorrection`:

```ts
import {
  createTranslation,
  updateTranslation,
  translateText,
  TranslationProvider,
  ProviderTranslationResult,
  ProviderExplanation,
  ProviderCorrection,
} from '../api/srs.api';
```

- [ ] **Step 2: Add content-tab state**

After the `activeProvider` state (line 121) add:

```ts
  const [activeContentTab, setActiveContentTab] =
    useState<'translations' | 'explanation' | 'correction'>('translations');
```

- [ ] **Step 3: Reset content tab alongside existing resets**

Add `setActiveContentTab('translations');` immediately after each existing `setSuggestionTarget('translation');` reset call inside `handleTranslate` (after `setSuggestionTarget(plan.suggestionTarget);` at line 226 — set to `'translations'`), `handleSave` (line 266), `handlePrev` (line 291), `handleNext` (lines 301 and 312), and `handleNewEntry` (line 320). In `handleTranslate`, place it right after `setSuggestionTarget(plan.suggestionTarget);`.

- [ ] **Step 4: Add derived values and apply-correction handler**

After the `applySuggestion` function (line 344) add:

```ts
  const activeResult = providerResults?.[activeProvider];
  const hasCorrection = !!activeResult?.correction;
  const effectiveContentTab =
    activeContentTab === 'correction' && !hasCorrection ? 'translations' : activeContentTab;
  const correctionSourceField: 'original' | 'translation' =
    suggestionTarget === 'translation' ? 'original' : 'translation';
  const applyCorrection = (corrected: string) => {
    setAddForm((prev) => ({ ...prev, [correctionSourceField]: corrected }));
  };
```

- [ ] **Step 5: Replace the panel body with content tabs**

Replace the inner panel `<div className="p-3 flex flex-col gap-3">...</div>` (lines 667–770 — the block holding the translations/examples IIFE) with the content-tab bar plus three panels:

```tsx
                <div className="flex border-b">
                  {(['translations', 'explanation', 'correction'] as const).map((tab) => {
                    if (tab === 'correction' && !hasCorrection) return null;
                    const label =
                      tab === 'translations'
                        ? t('modal.tabTranslations')
                        : tab === 'explanation'
                          ? t('modal.tabExplanation')
                          : t('modal.tabCorrection');
                    const isActive = effectiveContentTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveContentTab(tab)}
                        className={
                          'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ' +
                          (isActive
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground')
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="p-3 flex flex-col gap-3">
                  {(() => {
                    const r = activeResult;
                    if (!r) {
                      if (loadingProviders.includes(activeProvider)) {
                        return (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                            {t('modal.fetchingSuggestions')}
                          </div>
                        );
                      }
                      return null;
                    }
                    if (r.error) {
                      return (
                        <p className="text-sm text-red-600">{t('modal.errorWithReason', { message: r.error })}</p>
                      );
                    }

                    if (effectiveContentTab === 'explanation') {
                      return renderExplanation(r.explanation);
                    }
                    if (effectiveContentTab === 'correction' && r.correction) {
                      return renderCorrection(r.correction);
                    }

                    // translations tab
                    if (r.translations.length === 0) {
                      return <p className="text-sm text-muted-foreground">{t('modal.noSuggestions')}</p>;
                    }
                    return (
                      <>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            {t('modal.translationsHeading')}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {r.translations.map((opt, i) => (
                              <Button
                                key={`${activeProvider}-t-${i}`}
                                variant={suggestionSelected === opt ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => applySuggestion(opt)}
                                className="inline-flex items-center gap-2"
                              >
                                <span>{opt}</span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speak(opt, suggestionSpeakLang);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      speak(opt, suggestionSpeakLang);
                                    }
                                  }}
                                  title={t('a11y.speak')}
                                  className="inline-flex items-center opacity-70 hover:opacity-100"
                                >
                                  <Volume2 className="h-3 w-3" />
                                </span>
                              </Button>
                            ))}
                          </div>
                        </div>
                        {r.examples && r.examples.length > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              {t('modal.examplesHeading')}
                            </span>
                            <ul className="flex flex-col gap-1.5">
                              {r.examples.map((ex, i) => (
                                <li key={`${activeProvider}-e-${i}`} className="text-sm">
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium flex-1">{ex.original}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 shrink-0"
                                      onClick={() => speak(ex.original, addForm.originalLanguage)}
                                      title={t('a11y.speak')}
                                    >
                                      <Volume2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground flex-1">{ex.translated}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 shrink-0"
                                      onClick={() => speak(ex.translated, addForm.translationLanguage)}
                                      title={t('a11y.speak')}
                                    >
                                      <Volume2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
```

- [ ] **Step 6: Add the explanation and correction render helpers**

Inside `ModalBody`, just before the `return (` of the component JSX (after the `applyCorrection` block from Step 4), add two render helpers:

```tsx
  const renderExplanation = (explanation: ProviderExplanation | null) => {
    if (!explanation) {
      return <p className="text-sm text-muted-foreground">{t('modal.explanationUnavailable')}</p>;
    }
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {t('modal.partOfSpeech')}
          </span>
          <span className="text-sm">{explanation.partOfSpeech}</span>
        </div>
        {explanation.inflection && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              {explanation.inflection.title || t('modal.inflectionHeading')}
            </span>
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr>
                    {explanation.inflection.columns.map((c, i) => (
                      <th key={`col-${i}`} className="text-left font-medium text-muted-foreground px-2 py-1 border-b">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {explanation.inflection.rows.map((row, ri) => (
                    <tr key={`row-${ri}`}>
                      <td className="font-medium text-muted-foreground px-2 py-1 border-b">{row.label}</td>
                      {row.cells.map((cell, ci) => (
                        <td key={`cell-${ri}-${ci}`} className="px-2 py-1 border-b">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {explanation.note && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground uppercase">{t('modal.usageNote')}</span>
            <span className="text-sm text-muted-foreground">{explanation.note}</span>
          </div>
        )}
      </div>
    );
  };

  const renderCorrection = (correction: ProviderCorrection) => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {t('modal.correctionHeading')}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyCorrection(correction.corrected)}
          className="self-start inline-flex items-center gap-2"
          title={t('modal.applyCorrection')}
        >
          <Check className="h-3.5 w-3.5" />
          <span>{correction.corrected}</span>
        </Button>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {t('modal.correctionWhat')}
        </span>
        <span className="text-sm">{correction.what}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {t('modal.correctionWhy')}
        </span>
        <span className="text-sm text-muted-foreground">{correction.why}</span>
      </div>
    </div>
  );
```

Note: `Check` is already imported from `lucide-react` (line 3).

- [ ] **Step 7: Verify lint and build**

Run: `nx lint training-app`
Expected: passes (no unused-var or exhaustive-deps errors; the render helpers are defined before the JSX `return`).
Run: `nx build training-app`
Expected: succeeds.

- [ ] **Step 8: Manual verification**

Run: `nx serve entry-server` and `nx serve training-app`. Open the Add Translation modal, type a Polish word with a deliberate mistake (e.g. `kod` meant as cat → `kot`), translate. Verify:
- Provider tabs still on top; content tabs (Translations / Explanation) appear below.
- Explanation tab shows part of speech + declension table.
- Correction tab appears only for providers that flagged a mistake; clicking the corrected text replaces the source field and does NOT re-translate.
- Selecting Glosbe shows the Explanation empty state and no Correction tab.

- [ ] **Step 9: Commit**

```bash
git add apps/training-app/src/app/components/translation-add-modal.tsx
git commit -m "feat(training-app): add Translations/Explanation/Correction content tabs to add modal"
```

---

## Self-Review Notes

- **Spec coverage:** provider tabs unchanged (Task 5 keeps them) ✓; content tabs below (Task 5) ✓; one enriched call per provider (Task 2 prompt) ✓; Glosbe empty state + no correction (Task 2 nulls, Task 5 rendering) ✓; structured explanation with inflection table (Tasks 1/5) ✓; correction replaces source field opposite of `suggestionTarget`, no re-translate (Task 5 `applyCorrection`) ✓; max_tokens bump (Task 2) ✓; caps (Task 1) ✓; i18n all locales (Task 4) ✓; backend parser tests (Task 1) ✓.
- **Type consistency:** `ProviderExplanation`/`ProviderCorrection`/`InflectionTable` identical in `parse-translation-json.ts` (Task 1) and `srs.api.ts` (Task 3); `effectiveContentTab`, `hasCorrection`, `applyCorrection`, `renderExplanation`, `renderCorrection` all defined in Task 5 before use.
- **No frontend unit tests:** training-app has no jest/vitest harness — verified via lint/build/manual per Global Constraints.
```
