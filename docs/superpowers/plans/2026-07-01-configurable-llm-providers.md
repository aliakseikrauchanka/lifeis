# Configurable LLM Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings control that lets the user choose which LLM providers are queried on Add/Edit for translation and explanation, defaulting to all five.

**Architecture:** A localStorage-backed preference hook (`useEnabledProviders`) following the existing `usePwnEnabled` pattern feeds the enabled subset to the translation modal and a new checkbox group in the profile menu. Provider ids/labels move to a shared constants module so both consumers agree. A preliminary rename changes the provider id `anthropic` → `claude-sonnet` across frontend type + backend route.

**Tech Stack:** React 18, TypeScript, Nx, Jest (training-app tests via `nx test training-app`), Express backend.

## Global Constraints

- Provider canonical order (used everywhere): `['claude-opus', 'claude-sonnet', 'gemini', 'deepseek', 'glosbe']`.
- Default enabled set when the preference is unset: **all five**.
- Invariant: **at least one** provider is always enabled (enforced in UI and in hook read/validation).
- localStorage key: `training-app-enabled-providers` (JSON array of provider ids).
- Preference hooks follow the existing module-level-listener pattern (see `apps/training-app/src/app/hooks/use-pwn-enabled.ts`).
- i18n: `en` is the source of truth (`MessageKey = keyof typeof en`); `ru`, `pl`, `es` are `Record<MessageKey, string>` and MUST contain every key or TypeScript fails.

---

### Task 1: Rename provider id `anthropic` → `claude-sonnet`

Pure rename, no behavior change. The frontend `PROVIDER_LABELS` display string stays "Claude Sonnet"; only the id changes.

**Files:**
- Modify: `apps/training-app/src/app/api/srs.api.ts:176`
- Modify: `apps/training-app/src/app/components/translation-add-modal.tsx:61,68`
- Modify: `apps/entry-server/src/routes/translations-routes.ts:46,467`

**Interfaces:**
- Consumes: nothing.
- Produces: `TranslationProvider = 'openai' | 'deepseek' | 'glosbe' | 'gemini' | 'claude-sonnet' | 'claude-opus'` (id `anthropic` no longer exists anywhere).

- [ ] **Step 1: Update the frontend type union**

In `apps/training-app/src/app/api/srs.api.ts:176`, change:

```ts
export type TranslationProvider = 'openai' | 'deepseek' | 'glosbe' | 'gemini' | 'anthropic' | 'claude-opus';
```

to:

```ts
export type TranslationProvider = 'openai' | 'deepseek' | 'glosbe' | 'gemini' | 'claude-sonnet' | 'claude-opus';
```

- [ ] **Step 2: Update the modal's provider list and label key**

In `apps/training-app/src/app/components/translation-add-modal.tsx:61`, change:

```ts
const TRANSLATION_PROVIDERS = ['claude-opus', 'anthropic', 'gemini', 'deepseek', 'glosbe'] as const satisfies readonly TranslationProvider[];
```

to:

```ts
const TRANSLATION_PROVIDERS = ['claude-opus', 'claude-sonnet', 'gemini', 'deepseek', 'glosbe'] as const satisfies readonly TranslationProvider[];
```

In the `PROVIDER_LABELS` object (around line 63-70), change the key `anthropic: 'Claude Sonnet',` to `'claude-sonnet': 'Claude Sonnet',`. Full object becomes:

```ts
const PROVIDER_LABELS: Record<TranslationProvider, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  glosbe: 'Glosbe',
  gemini: 'Gemini',
  'claude-sonnet': 'Claude Sonnet',
  'claude-opus': 'Claude Opus',
};
```

- [ ] **Step 3: Update the backend supported-providers set and model-selection comment**

In `apps/entry-server/src/routes/translations-routes.ts:46`, change:

```ts
const SUPPORTED_PROVIDERS = new Set(['openai', 'deepseek', 'glosbe', 'gemini', 'anthropic', 'claude-opus']);
```

to:

```ts
const SUPPORTED_PROVIDERS = new Set(['openai', 'deepseek', 'glosbe', 'gemini', 'claude-sonnet', 'claude-opus']);
```

In the same file around line 467, change the comment `// anthropic | claude-opus` to `// claude-sonnet | claude-opus`. The model-selection line below it is unchanged — `provider === 'claude-opus' ? 'claude-opus-4-8' : 'claude-sonnet-4-6'` already routes the non-opus Claude id to Sonnet.

- [ ] **Step 4: Verify nothing else references the old id**

Run: `grep -rn "'anthropic'\|\"anthropic\"\|anthropic:" apps/training-app/src apps/entry-server/src | grep -v "@anthropic-ai\|new Anthropic\|import"`
Expected: no output (the `const anthropic = new Anthropic()` SDK client variable is unrelated and stays).

- [ ] **Step 5: Typecheck both projects**

Run: `npx nx lint training-app && npx nx lint entry-server`
Expected: PASS (no type errors about missing `anthropic` key or unassignable union).

- [ ] **Step 6: Commit**

```bash
git add apps/training-app/src/app/api/srs.api.ts apps/training-app/src/app/components/translation-add-modal.tsx apps/entry-server/src/routes/translations-routes.ts
git commit -m "refactor: rename translation provider id anthropic to claude-sonnet"
```

---

### Task 2: Shared provider constants module

Extract the canonical list and labels out of the modal so the profile menu and hook can share them.

**Files:**
- Create: `apps/training-app/src/app/constants/translation-providers.ts`
- Modify: `apps/training-app/src/app/components/translation-add-modal.tsx` (remove local consts, import from new module)

**Interfaces:**
- Consumes: `TranslationProvider` from `../api/srs.api`.
- Produces:
  - `TRANSLATION_PROVIDERS: readonly TranslationProvider[]` (canonical order).
  - `PROVIDER_LABELS: Record<TranslationProvider, string>`.

- [ ] **Step 1: Create the constants module**

Create `apps/training-app/src/app/constants/translation-providers.ts`:

```ts
import type { TranslationProvider } from '../api/srs.api';

/** Providers offered in the Add/Edit modal, in canonical display order. */
export const TRANSLATION_PROVIDERS = [
  'claude-opus',
  'claude-sonnet',
  'gemini',
  'deepseek',
  'glosbe',
] as const satisfies readonly TranslationProvider[];

/** Human-readable labels for every provider id. */
export const PROVIDER_LABELS: Record<TranslationProvider, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  glosbe: 'Glosbe',
  gemini: 'Gemini',
  'claude-sonnet': 'Claude Sonnet',
  'claude-opus': 'Claude Opus',
};
```

- [ ] **Step 2: Remove the local consts from the modal and import instead**

In `apps/training-app/src/app/components/translation-add-modal.tsx`, delete the local `TRANSLATION_PROVIDERS` const (line ~61) and the `PROVIDER_LABELS` const (lines ~63-70). Add to the existing import block near the other `../` imports:

```ts
import { TRANSLATION_PROVIDERS, PROVIDER_LABELS } from '../constants/translation-providers';
```

- [ ] **Step 3: Typecheck / lint the app**

Run: `npx nx lint training-app`
Expected: PASS (modal still resolves both symbols, now from the shared module).

- [ ] **Step 4: Build to confirm the modal still compiles**

Run: `npx nx build training-app`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/training-app/src/app/constants/translation-providers.ts apps/training-app/src/app/components/translation-add-modal.tsx
git commit -m "refactor: extract translation provider constants to shared module"
```

---

### Task 3: `useEnabledProviders` preference hook (TDD)

**Files:**
- Create: `apps/training-app/src/app/hooks/use-enabled-providers.ts`
- Test: `apps/training-app/src/app/hooks/use-enabled-providers.spec.ts`

**Interfaces:**
- Consumes: `TRANSLATION_PROVIDERS` from `../constants/translation-providers`; `TranslationProvider` from `../api/srs.api`.
- Produces: `useEnabledProviders(): [TranslationProvider[], (next: TranslationProvider[]) => void]` — the returned array is always non-empty and in canonical order. Also exports `ENABLED_PROVIDERS_KEY = 'training-app-enabled-providers'` and a pure helper `readEnabledProviders(): TranslationProvider[]` for testing.

- [ ] **Step 1: Write the failing test**

Create `apps/training-app/src/app/hooks/use-enabled-providers.spec.ts`:

```ts
/** @jest-environment jsdom */
import { ENABLED_PROVIDERS_KEY, readEnabledProviders } from './use-enabled-providers';
import { TRANSLATION_PROVIDERS } from '../constants/translation-providers';

describe('readEnabledProviders', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns all providers when storage is unset', () => {
    expect(readEnabledProviders()).toEqual([...TRANSLATION_PROVIDERS]);
  });

  it('returns the stored subset in canonical order', () => {
    window.localStorage.setItem(ENABLED_PROVIDERS_KEY, JSON.stringify(['gemini', 'claude-opus']));
    expect(readEnabledProviders()).toEqual(['claude-opus', 'gemini']);
  });

  it('drops unknown ids', () => {
    window.localStorage.setItem(ENABLED_PROVIDERS_KEY, JSON.stringify(['gemini', 'bogus']));
    expect(readEnabledProviders()).toEqual(['gemini']);
  });

  it('falls back to all providers when the stored array is empty', () => {
    window.localStorage.setItem(ENABLED_PROVIDERS_KEY, JSON.stringify([]));
    expect(readEnabledProviders()).toEqual([...TRANSLATION_PROVIDERS]);
  });

  it('falls back to all providers when storage is corrupt', () => {
    window.localStorage.setItem(ENABLED_PROVIDERS_KEY, 'not json');
    expect(readEnabledProviders()).toEqual([...TRANSLATION_PROVIDERS]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test training-app --testFile=apps/training-app/src/app/hooks/use-enabled-providers.spec.ts`
Expected: FAIL — cannot resolve `./use-enabled-providers`.

- [ ] **Step 3: Write the hook**

Create `apps/training-app/src/app/hooks/use-enabled-providers.ts`:

```ts
import { useEffect, useState } from 'react';
import type { TranslationProvider } from '../api/srs.api';
import { TRANSLATION_PROVIDERS } from '../constants/translation-providers';

export const ENABLED_PROVIDERS_KEY = 'training-app-enabled-providers';

const ALL: TranslationProvider[] = [...TRANSLATION_PROVIDERS];

/** Read + validate the persisted enabled set. Always returns a non-empty list in canonical order. */
export function readEnabledProviders(): TranslationProvider[] {
  if (typeof window === 'undefined') return [...ALL];
  const raw = window.localStorage.getItem(ENABLED_PROVIDERS_KEY);
  if (!raw) return [...ALL];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...ALL];
    const set = new Set(parsed);
    const filtered = ALL.filter((p) => set.has(p));
    return filtered.length > 0 ? filtered : [...ALL];
  } catch {
    return [...ALL];
  }
}

const listeners = new Set<(v: TranslationProvider[]) => void>();

/** Which providers are queried on Add/Edit (persisted). Defaults to all; always keeps >= 1. */
export function useEnabledProviders(): [TranslationProvider[], (next: TranslationProvider[]) => void] {
  const [providers, setProvidersState] = useState<TranslationProvider[]>(() => readEnabledProviders());

  useEffect(() => {
    const listener = (v: TranslationProvider[]) => setProvidersState(v);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setProviders = (next: TranslationProvider[]) => {
    const set = new Set(next);
    const filtered = ALL.filter((p) => set.has(p));
    const safe = filtered.length > 0 ? filtered : [...ALL];
    window.localStorage.setItem(ENABLED_PROVIDERS_KEY, JSON.stringify(safe));
    listeners.forEach((fn) => fn(safe));
  };

  return [providers, setProviders];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test training-app --testFile=apps/training-app/src/app/hooks/use-enabled-providers.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/training-app/src/app/hooks/use-enabled-providers.ts apps/training-app/src/app/hooks/use-enabled-providers.spec.ts
git commit -m "feat: add useEnabledProviders preference hook"
```

---

### Task 4: i18n keys for the providers setting

**Files:**
- Modify: `apps/training-app/src/app/i18n/messages.ts` (add keys to `en`, `ru`, `pl`, `es`)

**Interfaces:**
- Consumes: nothing.
- Produces: message keys `profile.sectionProviders` and `profile.providersHint` available via `t(...)`.

- [ ] **Step 1: Add keys to the `en` source object**

In `apps/training-app/src/app/i18n/messages.ts`, inside the `en` object next to the existing `profile.pwnHint` entry, add:

```ts
  'profile.sectionProviders': 'Translation providers',
  'profile.providersHint': 'Choose which AI models are queried when you add or edit a translation. At least one must stay selected.',
```

- [ ] **Step 2: Add the same keys to `ru`**

Inside the `ru` object, add:

```ts
  'profile.sectionProviders': 'Провайдеры перевода',
  'profile.providersHint': 'Выберите, какие ИИ-модели запрашиваются при добавлении или редактировании перевода. Хотя бы один должен оставаться выбранным.',
```

- [ ] **Step 3: Add the same keys to `pl`**

Inside the `pl` object, add:

```ts
  'profile.sectionProviders': 'Dostawcy tłumaczeń',
  'profile.providersHint': 'Wybierz, które modele AI są odpytywane przy dodawaniu lub edycji tłumaczenia. Co najmniej jeden musi pozostać zaznaczony.',
```

- [ ] **Step 4: Add the same keys to `es`**

Inside the `es` object, add:

```ts
  'profile.sectionProviders': 'Proveedores de traducción',
  'profile.providersHint': 'Elige qué modelos de IA se consultan al añadir o editar una traducción. Al menos uno debe permanecer seleccionado.',
```

- [ ] **Step 5: Typecheck to confirm every locale has the new keys**

Run: `npx nx lint training-app`
Expected: PASS. (If a locale is missing a key, `Record<MessageKey, string>` fails to compile — this is the check.)

- [ ] **Step 6: Commit**

```bash
git add apps/training-app/src/app/i18n/messages.ts
git commit -m "feat: add i18n strings for translation providers setting"
```

---

### Task 5: Profile-menu provider checkboxes

**Files:**
- Modify: `apps/training-app/src/app/components/profile-menu.tsx`

**Interfaces:**
- Consumes: `useEnabledProviders` (Task 3), `TRANSLATION_PROVIDERS` + `PROVIDER_LABELS` (Task 2), message keys (Task 4).
- Produces: a "Translation providers" section with one checkbox per provider; the last-remaining checkbox is disabled.

- [ ] **Step 1: Add imports**

In `apps/training-app/src/app/components/profile-menu.tsx`, add near the other hook/constant imports:

```ts
import { useEnabledProviders } from '../hooks/use-enabled-providers';
import { TRANSLATION_PROVIDERS, PROVIDER_LABELS } from '../constants/translation-providers';
```

Also add `Sparkles` to the existing `lucide-react` import (used as the section icon), e.g. change the import to include `Sparkles`:

```ts
import { BookOpen, Check, Headphones, Languages, Mic, Sparkles, User, X } from 'lucide-react';
```

- [ ] **Step 2: Read the hook inside the component**

Near the existing `const [pwnEnabled, setPwnEnabled] = usePwnEnabled();` line (~79), add:

```ts
  const [enabledProviders, setEnabledProviders] = useEnabledProviders();
```

- [ ] **Step 3: Add a toggle handler**

Just below where the component's other handlers/derived values sit (any spot inside the component body before the return), add:

```ts
  const toggleProvider = (provider: (typeof TRANSLATION_PROVIDERS)[number], checked: boolean) => {
    const set = new Set(enabledProviders);
    if (checked) set.add(provider);
    else set.delete(provider);
    setEnabledProviders(TRANSLATION_PROVIDERS.filter((p) => set.has(p)));
  };
```

- [ ] **Step 4: Render the section**

In the JSX, immediately after the closing `</section>` of the Dictionary/PWN block (the `<section>` ending at ~line 226), insert:

```tsx
              <section className="flex flex-col gap-2">
                <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Sparkles className="h-3.5 w-3.5" /> {t('profile.sectionProviders')}
                </h4>
                {TRANSLATION_PROVIDERS.map((provider) => {
                  const checked = enabledProviders.includes(provider);
                  const isLastChecked = checked && enabledProviders.length === 1;
                  return (
                    <label
                      key={provider}
                      className="flex items-center justify-between gap-3 text-sm text-foreground cursor-pointer"
                    >
                      <span>{PROVIDER_LABELS[provider]}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isLastChecked}
                        onChange={(e) => toggleProvider(provider, e.target.checked)}
                        className="h-4 w-4 accent-violet-600 disabled:opacity-50"
                      />
                    </label>
                  );
                })}
                <p className="text-xs text-muted-foreground">{t('profile.providersHint')}</p>
              </section>
```

- [ ] **Step 5: Lint + build**

Run: `npx nx lint training-app && npx nx build training-app`
Expected: PASS / build succeeds.

- [ ] **Step 6: Manual verification**

Run `npx nx serve training-app`, open the profile menu. Confirm: the "Translation providers" section shows 5 checkboxes all checked; unchecking down to one leaves the last checkbox disabled; reload the page and the selection persists.

- [ ] **Step 7: Commit**

```bash
git add apps/training-app/src/app/components/profile-menu.tsx
git commit -m "feat: add translation providers checklist to profile menu"
```

---

### Task 6: Modal consumes the enabled subset

**Files:**
- Modify: `apps/training-app/src/app/components/translation-add-modal.tsx`

**Interfaces:**
- Consumes: `useEnabledProviders` (Task 3). Note the module still imports `TRANSLATION_PROVIDERS` (canonical order) + `PROVIDER_LABELS` from Task 2 — the canonical list is only used as a fallback ordering; requests iterate the enabled subset.
- Produces: modal requests + tabs limited to enabled providers; `activeProvider` always valid.

- [ ] **Step 1: Read the enabled subset in `ModalBody`**

In `translation-add-modal.tsx`, inside `ModalBody`, near the other hook calls (e.g. after `const { history, appendHistory, findByOriginalOrTranslation } = useTranslationAdd();`), add:

```ts
  const [enabledProviders] = useEnabledProviders();
```

Add the import near the other `../hooks` / `../constants` imports:

```ts
import { useEnabledProviders } from '../hooks/use-enabled-providers';
```

- [ ] **Step 2: Point requests and tabs at the enabled subset**

Replace every use of the module-level `TRANSLATION_PROVIDERS` **inside `ModalBody`** (the `handleTranslate` loop `TRANSLATION_PROVIDERS.forEach(...)`, the `setLoadingProviders(TRANSLATION_PROVIDERS)` call, and the provider tab bar `TRANSLATION_PROVIDERS.map(...)`) with `enabledProviders`. Concretely:

- In `handleTranslate`: change `setLoadingProviders(TRANSLATION_PROVIDERS);` to `setLoadingProviders(enabledProviders);` and `TRANSLATION_PROVIDERS.forEach(async (p) => {` to `enabledProviders.forEach(async (p) => {`.
- In the tab bar JSX: change `{TRANSLATION_PROVIDERS.map((p) => {` to `{enabledProviders.map((p) => {`.

Leave the top-level `import { TRANSLATION_PROVIDERS, PROVIDER_LABELS } ...` in place — `PROVIDER_LABELS` is still used, and `TRANSLATION_PROVIDERS` is used by the fallback in Step 3.

- [ ] **Step 3: Add the active-provider fallback effect**

`activeProvider` still initializes to `'claude-opus'`. Add an effect (near the other `useEffect`s in `ModalBody`) that resets it to the first enabled provider whenever the current one is not enabled:

```ts
  useEffect(() => {
    if (enabledProviders.length > 0 && !enabledProviders.includes(activeProvider)) {
      setActiveProvider(enabledProviders[0]);
    }
  }, [enabledProviders, activeProvider]);
```

- [ ] **Step 4: Lint + build**

Run: `npx nx lint training-app && npx nx build training-app`
Expected: PASS / build succeeds.

- [ ] **Step 5: Manual verification**

Run `npx nx serve training-app`. In the profile menu, uncheck Claude Opus and Gemini (leave e.g. Claude Sonnet + DeepSeek + Glosbe). Open Add translation, type a word, translate. Confirm: only the enabled providers fire (only their tabs appear), the active tab is a valid enabled provider (not the hidden Opus), and explanation/dictionary still work on the active tab.

- [ ] **Step 6: Commit**

```bash
git add apps/training-app/src/app/components/translation-add-modal.tsx
git commit -m "feat: request only enabled providers in Add/Edit modal"
```

---

## Self-Review

**Spec coverage:**
- Multi-select subset → Tasks 3 (hook), 5 (UI), 6 (modal). ✓
- Single shared list (both translation + explanation) → modal uses one `enabledProviders` for the translate loop and tabs; explanation keys off `activeProvider` which is constrained to enabled. ✓
- Default all 5 → hook `readEnabledProviders` returns `ALL` when unset (Task 3, tested). ✓
- At least one required → UI disables last checkbox (Task 5) + hook read/write fallback to `ALL` on empty (Task 3, tested). ✓
- Preliminary rename `anthropic` → `claude-sonnet` → Task 1. ✓
- Glosbe translation-only → unchanged; no special handling needed (out of scope per spec). ✓

**Placeholder scan:** No TBD/TODO; all code blocks present; commands have expected output. ✓

**Type consistency:** `TranslationProvider` union (Task 1) omits `anthropic`, adds `claude-sonnet`; `TRANSLATION_PROVIDERS`/`PROVIDER_LABELS` (Task 2) use `claude-sonnet`; hook signature `useEnabledProviders(): [TranslationProvider[], (next) => void]` used identically in Tasks 5 and 6; `readEnabledProviders` / `ENABLED_PROVIDERS_KEY` names match between hook and test. ✓
