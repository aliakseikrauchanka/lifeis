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
