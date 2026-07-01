# Explanation-Provider Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted Settings-popup dropdown that chooses which LLM generates the Explain-button explanation on Study / Word Builder / Sentence Builder cards, replacing the hardcoded `'gemini'`.

**Architecture:** A localStorage-backed single-value preference hook (`useExplanationProvider`, same module-listener pattern as `useEnabledProviders`) feeds `ExplanationTabs` and a new `<select>` in the profile menu. Provider set/default constants live in the existing shared constants module.

**Tech Stack:** React 18, TypeScript, Nx, Jest (training-app tests via `nx test training-app`).

## Global Constraints

- Explanation provider options: `EXPLANATION_PROVIDERS = TRANSLATION_PROVIDERS.filter(p => p !== 'glosbe')` → `['claude-opus','claude-sonnet','gemini','deepseek']`.
- Default provider: `gemini` (`DEFAULT_EXPLANATION_PROVIDER`).
- localStorage key: `training-app-explanation-provider`.
- Preference hooks follow the module-level-listener pattern of `apps/training-app/src/app/hooks/use-enabled-providers.ts` / `use-pwn-enabled.ts`.
- `nx lint` is broken repo-wide (`prettier.resolveConfig.sync`) — verify with `nx build training-app` and `nx test training-app`, never `nx lint`.
- i18n: `en` is source of truth (`MessageKey = keyof typeof en`); `ru`, `pl`, `es` are `Record<MessageKey, string>` and must contain every key.
- Branch: continue on `feat/configurable-llm-providers` (this builds on its constants module + profile menu). Commits omit any Co-Authored-By trailer.

---

### Task 1: Explanation-provider constants

**Files:**
- Modify: `apps/training-app/src/app/constants/translation-providers.ts`

**Interfaces:**
- Consumes: existing `TRANSLATION_PROVIDERS`, `TranslationProvider`.
- Produces: `EXPLANATION_PROVIDERS: TranslationProvider[]` and `DEFAULT_EXPLANATION_PROVIDER: TranslationProvider`.

- [ ] **Step 1: Add the constants**

Append to `apps/training-app/src/app/constants/translation-providers.ts`:

```ts
/** Providers that can produce an explanation (Glosbe cannot). */
export const EXPLANATION_PROVIDERS: TranslationProvider[] = TRANSLATION_PROVIDERS.filter(
  (p) => p !== 'glosbe',
);

/** Default explanation provider (preserves prior hardcoded behavior). */
export const DEFAULT_EXPLANATION_PROVIDER: TranslationProvider = 'gemini';
```

- [ ] **Step 2: Build**

Run: `npx nx build training-app`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/training-app/src/app/constants/translation-providers.ts
git commit -m "feat: add explanation provider constants"
```

---

### Task 2: `useExplanationProvider` hook (TDD)

**Files:**
- Create: `apps/training-app/src/app/hooks/use-explanation-provider.ts`
- Test: `apps/training-app/src/app/hooks/use-explanation-provider.spec.ts`

**Interfaces:**
- Consumes: `EXPLANATION_PROVIDERS`, `DEFAULT_EXPLANATION_PROVIDER` from `../constants/translation-providers`; `TranslationProvider` from `../api/srs.api`.
- Produces: `useExplanationProvider(): [TranslationProvider, (p: TranslationProvider) => void]`; also `EXPLANATION_PROVIDER_KEY = 'training-app-explanation-provider'` and pure `readExplanationProvider(): TranslationProvider`.

- [ ] **Step 1: Write the failing test**

Create `apps/training-app/src/app/hooks/use-explanation-provider.spec.ts`:

```ts
/** @jest-environment jsdom */
import { EXPLANATION_PROVIDER_KEY, readExplanationProvider } from './use-explanation-provider';

describe('readExplanationProvider', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns gemini when storage is unset', () => {
    expect(readExplanationProvider()).toBe('gemini');
  });

  it('returns a valid stored provider as-is', () => {
    window.localStorage.setItem(EXPLANATION_PROVIDER_KEY, 'claude-opus');
    expect(readExplanationProvider()).toBe('claude-opus');
  });

  it('falls back to gemini for a non-explanation provider (glosbe)', () => {
    window.localStorage.setItem(EXPLANATION_PROVIDER_KEY, 'glosbe');
    expect(readExplanationProvider()).toBe('gemini');
  });

  it('falls back to gemini for an unknown value', () => {
    window.localStorage.setItem(EXPLANATION_PROVIDER_KEY, 'bogus');
    expect(readExplanationProvider()).toBe('gemini');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test training-app --testFile=apps/training-app/src/app/hooks/use-explanation-provider.spec.ts`
Expected: FAIL — cannot resolve `./use-explanation-provider`.

- [ ] **Step 3: Write the hook**

Create `apps/training-app/src/app/hooks/use-explanation-provider.ts`:

```ts
import { useEffect, useState } from 'react';
import type { TranslationProvider } from '../api/srs.api';
import { EXPLANATION_PROVIDERS, DEFAULT_EXPLANATION_PROVIDER } from '../constants/translation-providers';

export const EXPLANATION_PROVIDER_KEY = 'training-app-explanation-provider';

function isValid(v: unknown): v is TranslationProvider {
  return typeof v === 'string' && (EXPLANATION_PROVIDERS as string[]).includes(v);
}

/** Read + validate the persisted explanation provider. Falls back to the default. */
export function readExplanationProvider(): TranslationProvider {
  if (typeof window === 'undefined') return DEFAULT_EXPLANATION_PROVIDER;
  const raw = window.localStorage.getItem(EXPLANATION_PROVIDER_KEY);
  return isValid(raw) ? raw : DEFAULT_EXPLANATION_PROVIDER;
}

const listeners = new Set<(v: TranslationProvider) => void>();

/** Which provider generates the Explain-button explanation (persisted). Defaults to gemini. */
export function useExplanationProvider(): [TranslationProvider, (p: TranslationProvider) => void] {
  const [provider, setProviderState] = useState<TranslationProvider>(() => readExplanationProvider());

  useEffect(() => {
    const listener = (v: TranslationProvider) => setProviderState(v);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setProvider = (p: TranslationProvider) => {
    const safe = isValid(p) ? p : DEFAULT_EXPLANATION_PROVIDER;
    window.localStorage.setItem(EXPLANATION_PROVIDER_KEY, safe);
    listeners.forEach((fn) => fn(safe));
  };

  return [provider, setProvider];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test training-app --testFile=apps/training-app/src/app/hooks/use-explanation-provider.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/training-app/src/app/hooks/use-explanation-provider.ts apps/training-app/src/app/hooks/use-explanation-provider.spec.ts
git commit -m "feat: add useExplanationProvider preference hook"
```

---

### Task 3: i18n keys for the explanation-provider setting

**Files:**
- Modify: `apps/training-app/src/app/i18n/messages.ts` (add keys to `en`, `ru`, `pl`, `es`)

**Interfaces:**
- Produces: message keys `profile.sectionExplanationProvider` and `profile.explanationProviderHint`.

- [ ] **Step 1: Add keys to `en`**

In the `en` object, next to the `profile.providersHint` entry, add:

```ts
  'profile.sectionExplanationProvider': 'Explanation',
  'profile.explanationProviderHint': 'Which AI model generates the explanation shown by the Explain button on cards.',
```

- [ ] **Step 2: Add to `ru`**

```ts
  'profile.sectionExplanationProvider': 'Объяснение',
  'profile.explanationProviderHint': 'Какая ИИ-модель формирует объяснение, показываемое кнопкой «Объяснить» на карточках.',
```

- [ ] **Step 3: Add to `pl`**

```ts
  'profile.sectionExplanationProvider': 'Wyjaśnienie',
  'profile.explanationProviderHint': 'Który model AI generuje wyjaśnienie pokazywane przyciskiem „Wyjaśnij” na fiszkach.',
```

- [ ] **Step 4: Add to `es`**

```ts
  'profile.sectionExplanationProvider': 'Explicación',
  'profile.explanationProviderHint': 'Qué modelo de IA genera la explicación que muestra el botón Explicar en las tarjetas.',
```

- [ ] **Step 5: Build (type-checks locale completeness)**

Run: `npx nx build training-app`
Expected: build succeeds (a missing key in any locale would fail `Record<MessageKey, string>`).

- [ ] **Step 6: Commit**

```bash
git add apps/training-app/src/app/i18n/messages.ts
git commit -m "feat: add i18n strings for explanation provider setting"
```

---

### Task 4: Explanation-provider dropdown in the profile menu

**Files:**
- Modify: `apps/training-app/src/app/components/profile-menu.tsx`

**Interfaces:**
- Consumes: `useExplanationProvider` (Task 2), `EXPLANATION_PROVIDERS` + `PROVIDER_LABELS` (Task 1 / constants), message keys (Task 3).
- Produces: an "Explanation" section with a `<select>` bound to the preference.

- [ ] **Step 1: Add imports**

Add near the other hook/constant imports in `profile-menu.tsx`:

```ts
import { useExplanationProvider } from '../hooks/use-explanation-provider';
import { EXPLANATION_PROVIDERS } from '../constants/translation-providers';
```

(`PROVIDER_LABELS` is already imported by the Translation-providers section from the same module — reuse it. If for any reason it is not in scope, add it to that existing import.) Add `MessageSquare` to the existing `lucide-react` import for the section icon:

```ts
import { BookOpen, Check, Headphones, Languages, MessageSquare, Mic, Sparkles, User, X } from 'lucide-react';
```

- [ ] **Step 2: Read the hook**

Near the existing `const [enabledProviders, setEnabledProviders] = useEnabledProviders();` line, add:

```ts
  const [explanationProvider, setExplanationProvider] = useExplanationProvider();
```

- [ ] **Step 3: Render the section**

Immediately after the closing `</section>` of the "Translation providers" section, insert:

```tsx
              <section className="flex flex-col gap-2">
                <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <MessageSquare className="h-3.5 w-3.5" /> {t('profile.sectionExplanationProvider')}
                </h4>
                <select
                  id="profile-explanation-provider"
                  value={explanationProvider}
                  onChange={(e) => setExplanationProvider(e.target.value as (typeof EXPLANATION_PROVIDERS)[number])}
                  className="h-9 px-2 text-sm rounded-md border border-input bg-background"
                >
                  {EXPLANATION_PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {PROVIDER_LABELS[provider]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{t('profile.explanationProviderHint')}</p>
              </section>
```

- [ ] **Step 4: Build**

Run: `npx nx build training-app`
Expected: build succeeds.

- [ ] **Step 5: Manual verification**

Run `npx nx serve training-app`, open the profile menu. Confirm the "Explanation" section shows a dropdown defaulting to Gemini; changing it and reopening the menu (and reloading) keeps the selection.

- [ ] **Step 6: Commit**

```bash
git add apps/training-app/src/app/components/profile-menu.tsx
git commit -m "feat: add explanation provider dropdown to profile menu"
```

---

### Task 5: Consume the preference in `ExplanationTabs`

**Files:**
- Modify: `apps/training-app/src/app/components/explanation-tabs.tsx`

**Interfaces:**
- Consumes: `useExplanationProvider` (Task 2).
- Produces: the Explain-button explanation uses the selected provider instead of hardcoded `'gemini'`.

- [ ] **Step 1: Add the import and hook**

In `explanation-tabs.tsx`, add near the other `../hooks` imports:

```ts
import { useExplanationProvider } from '../hooks/use-explanation-provider';
```

Inside the `ExplanationTabs` component, near the existing `const [pwnEnabled] = usePwnEnabled();` line, add:

```ts
  const [explanationProvider] = useExplanationProvider();
```

- [ ] **Step 2: Replace the hardcoded provider**

At line ~84, change:

```ts
      const e = await explainWord(word, language, 'gemini', locale);
```

to:

```ts
      const e = await explainWord(word, language, explanationProvider, locale);
```

Add `explanationProvider` to the `handleExplain` `useCallback` dependency array (it currently lists `[word, language, locale]` → make it `[word, language, locale, explanationProvider]`).

- [ ] **Step 3: Build**

Run: `npx nx build training-app`
Expected: build succeeds.

- [ ] **Step 4: Manual verification**

Run `npx nx serve training-app`. Set the Explanation provider to Claude Opus in Settings. On a Study card, click Explain and confirm the explanation is produced (provider changed from Gemini). Switching the setting changes subsequent explanations.

- [ ] **Step 5: Commit**

```bash
git add apps/training-app/src/app/components/explanation-tabs.tsx
git commit -m "feat: use selected explanation provider in ExplanationTabs"
```

---

## Self-Review

**Spec coverage:**
- Single-select persisted preference → Task 2 hook (tested). ✓
- Chosen in Settings popup → Task 4 dropdown. ✓
- Options = 4 providers (Glosbe excluded) → Task 1 `EXPLANATION_PROVIDERS`, used by dropdown + hook validation. ✓
- Default Gemini → `DEFAULT_EXPLANATION_PROVIDER` (Task 1), hook fallback (Task 2). ✓
- Applies everywhere ExplanationTabs is used → Task 5 (Study / Word Builder / Sentence Builder all render it). ✓

**Placeholder scan:** No TBD/TODO; all code + commands present. ✓

**Type consistency:** `useExplanationProvider(): [TranslationProvider, (p) => void]` used identically in Tasks 4 and 5; `EXPLANATION_PROVIDER_KEY` / `readExplanationProvider` names match between hook and test; `EXPLANATION_PROVIDERS` / `DEFAULT_EXPLANATION_PROVIDER` defined in Task 1 and consumed in Tasks 2 and 4. ✓
