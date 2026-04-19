import { useEffect, useState } from 'react';

export type AppDirection = 'native-to-training' | 'training-to-native';

const APP_DIRECTION_KEY = 'training-app-direction';
const LEGACY_KEYS = ['sentence-builder-direction', 'sentence-training-direction'];
const VALID: AppDirection[] = ['native-to-training', 'training-to-native'];

function isValid(v: unknown): v is AppDirection {
  return typeof v === 'string' && VALID.includes(v as AppDirection);
}

function readInitial(): AppDirection {
  if (typeof window === 'undefined') return 'native-to-training';
  const current = window.localStorage.getItem(APP_DIRECTION_KEY);
  if (isValid(current)) return current;
  for (const legacy of LEGACY_KEYS) {
    const v = window.localStorage.getItem(legacy);
    if (isValid(v)) {
      window.localStorage.setItem(APP_DIRECTION_KEY, v);
      return v;
    }
  }
  return 'native-to-training';
}

const listeners = new Set<(d: AppDirection) => void>();

export function useAppDirection(): [AppDirection, (d: AppDirection) => void] {
  const [direction, setDirectionState] = useState<AppDirection>(() => readInitial());

  useEffect(() => {
    const listener = (d: AppDirection) => setDirectionState(d);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setDirection = (d: AppDirection) => {
    window.localStorage.setItem(APP_DIRECTION_KEY, d);
    listeners.forEach((fn) => fn(d));
  };

  return [direction, setDirection];
}
