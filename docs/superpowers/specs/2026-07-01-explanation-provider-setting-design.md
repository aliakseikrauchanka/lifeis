# Explanation-Provider Setting

**Date:** 2026-07-01
**Status:** Approved (design)

## Problem

The **Explain** ("Объяснить") button on Study, Word Builder, and Sentence Builder cards is powered
by the shared `ExplanationTabs` component, which hardcodes the provider:
`explainWord(word, language, 'gemini', locale)` (`apps/training-app/src/app/components/explanation-tabs.tsx:84`).
The user cannot choose which LLM generates that explanation. We want a persisted setting, chosen in
the Settings popup (profile menu), that controls the explanation provider everywhere `ExplanationTabs`
is used.

Scope note: the Add/Edit translation modal's explanation is intentionally out of scope — it already
lets the user pick a provider via its per-provider tabs.

## Requirements

- A **single-select** provider preference, persisted (localStorage) and remembered across cards and
  sessions.
- Chosen in the **Settings popup** (profile menu), not inline on the card.
- Provider options: **Claude Opus, Claude Sonnet, Gemini, DeepSeek** (i.e. `TRANSLATION_PROVIDERS`
  minus Glosbe, which has no explanation).
- Default: **Gemini** (preserves current behavior).

## Design

### 1. Constants — `constants/translation-providers.ts`

Add, next to the existing exports:

```ts
/** Providers that can produce an explanation (Glosbe cannot). */
export const EXPLANATION_PROVIDERS = TRANSLATION_PROVIDERS.filter((p) => p !== 'glosbe');
// → ['claude-opus', 'claude-sonnet', 'gemini', 'deepseek']

export const DEFAULT_EXPLANATION_PROVIDER: TranslationProvider = 'gemini';
```

### 2. Preference hook — `hooks/use-explanation-provider.ts`

Mirrors the `use-enabled-providers` / `use-pwn-enabled` pattern: localStorage-backed, module-level
listener `Set`.

- Key: `training-app-explanation-provider` (stores the provider id string).
- Read/validation: if the stored value is not one of `EXPLANATION_PROVIDERS`, or is unset, return
  `DEFAULT_EXPLANATION_PROVIDER` (`gemini`).
- API: `useExplanationProvider(): [TranslationProvider, (p: TranslationProvider) => void]`. Also
  export `EXPLANATION_PROVIDER_KEY` and a pure `readExplanationProvider()` for testing.
- The setter validates against `EXPLANATION_PROVIDERS` before persisting (ignores/normalizes an
  invalid value to the default).

### 3. Settings UI — `profile-menu.tsx`

A new "Explanation" section placed immediately after the "Translation providers" section. Contains a
`<select>` dropdown (styled like the existing UI-language `<select>`), options from
`EXPLANATION_PROVIDERS` labeled via `PROVIDER_LABELS`, wired to `useExplanationProvider()`, plus a
short hint paragraph.

### 4. Consumption — `explanation-tabs.tsx`

Replace the hardcoded `'gemini'` at line 84 with the value from `useExplanationProvider()`. This
covers Study, Word Builder, and Sentence Builder (all render `ExplanationTabs`). The auto-fetch and
on-demand button paths both use the same value.

### 5. i18n — `messages.ts`

Add `profile.sectionExplanationProvider` and `profile.explanationProviderHint` to all four locales
(`en`, `ru`, `pl`, `es`).

## Testing

Jest unit tests for `use-explanation-provider`:

- unset storage → `gemini`,
- valid persisted value (e.g. `claude-opus`) → returned as-is,
- invalid/unknown value (incl. `glosbe`) → falls back to `gemini`.

## Out of Scope

- The Add/Edit modal explanation (already provider-selectable via tabs).
- Adding OpenAI to the offered set.
- Server-side persistence (localStorage only, consistent with existing settings).
