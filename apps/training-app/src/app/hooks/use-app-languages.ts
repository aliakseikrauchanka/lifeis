import { useEffect, useState } from 'react';
import { isValidLanguageCode, LANGUAGE_CODES } from '../constants/language-options';

const NATIVE_KEY = 'training-app-native-language';
const TRAINING_KEY = 'training-app-training-language';
const LEGACY_TRAINING_KEYS = ['library-orig-lang'];
const LEGACY_NATIVE_KEYS = ['library-trans-lang'];

const DEFAULT_NATIVE = 'ru-RU';
const DEFAULT_TRAINING = 'pl';

export interface AppLanguages {
  nativeLanguage: string;
  trainingLanguage: string;
}

function readInitialFor(key: string, legacyKeys: string[], fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const current = window.localStorage.getItem(key);
  if (isValidLanguageCode(current)) return current;
  for (const legacy of legacyKeys) {
    const v = window.localStorage.getItem(legacy);
    if (isValidLanguageCode(v)) {
      window.localStorage.setItem(key, v);
      return v;
    }
  }
  return fallback;
}

function readInitial(): AppLanguages {
  return {
    nativeLanguage: readInitialFor(NATIVE_KEY, LEGACY_NATIVE_KEYS, DEFAULT_NATIVE),
    trainingLanguage: readInitialFor(TRAINING_KEY, LEGACY_TRAINING_KEYS, DEFAULT_TRAINING),
  };
}

const listeners = new Set<(langs: AppLanguages) => void>();

export function useAppLanguages(): {
  nativeLanguage: string;
  trainingLanguage: string;
  setNativeLanguage: (code: string) => void;
  setTrainingLanguage: (code: string) => void;
} {
  const [state, setState] = useState<AppLanguages>(() => readInitial());

  useEffect(() => {
    const listener = (l: AppLanguages) => setState(l);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setNativeLanguage = (code: string) => {
    if (!isValidLanguageCode(code)) return;
    window.localStorage.setItem(NATIVE_KEY, code);
    const next: AppLanguages = { nativeLanguage: code, trainingLanguage: state.trainingLanguage };
    listeners.forEach((fn) => fn(next));
  };

  const setTrainingLanguage = (code: string) => {
    if (!isValidLanguageCode(code)) return;
    window.localStorage.setItem(TRAINING_KEY, code);
    const next: AppLanguages = { nativeLanguage: state.nativeLanguage, trainingLanguage: code };
    listeners.forEach((fn) => fn(next));
  };

  return {
    nativeLanguage: state.nativeLanguage,
    trainingLanguage: state.trainingLanguage,
    setNativeLanguage,
    setTrainingLanguage,
  };
}

export { LANGUAGE_CODES };
