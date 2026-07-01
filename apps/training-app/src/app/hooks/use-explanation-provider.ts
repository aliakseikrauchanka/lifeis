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
