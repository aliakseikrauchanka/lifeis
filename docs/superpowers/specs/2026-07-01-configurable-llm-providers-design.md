# Configurable LLM Providers for Add/Edit Translation

**Date:** 2026-07-01
**Status:** Approved (design)

## Problem

The Add/Edit translation modal (`apps/training-app/src/app/components/translation-add-modal.tsx`)
hardcodes `TRANSLATION_PROVIDERS = ['claude-opus', 'claude-sonnet', 'gemini', 'deepseek', 'glosbe']`
and fires **all five** in parallel on every translate. Users cannot narrow this down. We want a
setting that controls which LLM providers are requested on Add/Edit, for both translation and
explanation, to cut request volume (speed/cost).

## Preliminary rename: `anthropic` → `claude-sonnet`

The provider id `anthropic` actually means Claude Sonnet (`PROVIDER_LABELS` maps it to
"Claude Sonnet"). Before building the setting we rename the id to `claude-sonnet` for consistency
with `claude-opus`. Contained blast radius (no persisted data uses the id):

- `apps/training-app/src/app/api/srs.api.ts` — `TranslationProvider` union
- `apps/training-app/src/app/components/translation-add-modal.tsx` — `TRANSLATION_PROVIDERS`
  array and `PROVIDER_LABELS` key
- `apps/entry-server/src/routes/translations-routes.ts` — `SUPPORTED_PROVIDERS` set and the
  model-selection branch/comment (the `else` already maps to `claude-sonnet-4-6`, so it keeps
  working)

## Requirements

- **Multi-select subset**: user checks which providers get queried; only checked providers are
  requested and only their tabs appear.
- **Single shared list**: the same set applies to both translation and explanation. (Glosbe is
  translation-only and never returns an explanation; it simply has no effect on the explanation
  side.)
- **Default**: all 5 checked for users who have never touched the setting — no behavior change
  until opt-in.
- **Minimum**: at least one provider must stay checked; the user cannot uncheck them all.

## Design

### 1. Shared provider constants — `constants/translation-providers.ts`

Move the canonical provider list and labels out of the modal into a small shared module so the
modal and the profile menu agree on one source of truth.

- `TRANSLATION_PROVIDERS: readonly TranslationProvider[]` — canonical order
  `['claude-opus', 'claude-sonnet', 'gemini', 'deepseek', 'glosbe']`.
- `PROVIDER_LABELS: Record<TranslationProvider, string>` — moved verbatim from the modal.

### 2. Preference hook — `hooks/use-enabled-providers.ts`

Mirrors the existing `usePwnEnabled` / `useAppLevel` pattern: localStorage-backed with a
module-level listener `Set` so all consumers stay in sync.

- **Key**: `training-app-enabled-providers`, stored as a JSON array of provider ids.
- **Default when unset**: all of `TRANSLATION_PROVIDERS`.
- **Read/validation**: parse JSON, filter to known ids in canonical order. If parsing fails or the
  filtered result is empty, fall back to all 5. This guarantees the "at least one" invariant even
  against tampered/corrupt storage.
- **API**: `useEnabledProviders(): [TranslationProvider[], (next: TranslationProvider[]) => void]`.
  The returned list is always in canonical order. The setter writes JSON and notifies listeners.

### 3. UI control — `profile-menu.tsx`

A new "Translation providers" section adjacent to the existing PWN toggle. Renders one checkbox
per provider in `TRANSLATION_PROVIDERS`, labeled via `PROVIDER_LABELS`.

- Toggling a checkbox adds/removes that provider from the enabled list via the hook setter.
- **At-least-one enforcement**: when exactly one provider is checked, that checkbox is rendered
  `disabled` so the last one cannot be unchecked.
- Follows the existing label/row styling used by the PWN toggle.

### 4. Modal consumption — `translation-add-modal.tsx`

- Import `TRANSLATION_PROVIDERS` and `PROVIDER_LABELS` from the shared constants module (remove the
  local copies).
- Read the enabled subset via `useEnabledProviders()`; iterate **only** enabled providers for:
  - `handleTranslate` parallel requests,
  - the provider tab bar (rendered in canonical order),
  - the loading/aggregation state.
- **Active-provider fallback**: `activeProvider` still initializes to `'claude-opus'`, but an effect
  resets it to the first enabled provider whenever the current `activeProvider` is not in the
  enabled set (covers both initial load with Opus disabled and the set changing while the modal is
  open). This keeps the tab bar and the eager explanation-fetch effect pointed at a valid provider.
- Polish `dictionary` tab and explanation logic are unaffected — they key off `activeProvider`,
  which is now always a valid enabled provider.

## Testing

Vitest unit tests for `use-enabled-providers`:

- default (unset storage) returns all 5,
- persists and reads back a chosen subset,
- filters out unknown ids,
- empty array / corrupt JSON in storage falls back to all 5.

Modal render tests are skipped (heavy external deps: STT providers, network); the hook holds the
real logic.

## Out of Scope

- Separate provider lists per feature (translation vs explanation).
- Single-primary / lazy on-demand loading modes.
- Server-side persistence of the preference (localStorage only, consistent with existing settings).
