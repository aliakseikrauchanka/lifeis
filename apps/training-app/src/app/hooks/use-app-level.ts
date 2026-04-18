import { useEffect, useState } from 'react';
import type { CefrLevel } from '../api/srs.api';

const APP_LEVEL_KEY = 'training-app-level';
const LEGACY_KEYS = ['sentence-training-level', 'sentence-construction-level'];
const VALID: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function readInitial(): CefrLevel {
  if (typeof window === 'undefined') return 'B1';
  const current = window.localStorage.getItem(APP_LEVEL_KEY) as CefrLevel | null;
  if (current && VALID.includes(current)) return current;
  for (const legacy of LEGACY_KEYS) {
    const v = window.localStorage.getItem(legacy) as CefrLevel | null;
    if (v && VALID.includes(v)) {
      window.localStorage.setItem(APP_LEVEL_KEY, v);
      return v;
    }
  }
  return 'B1';
}

const listeners = new Set<(level: CefrLevel) => void>();

export function useAppLevel(): [CefrLevel, (level: CefrLevel) => void] {
  const [level, setLevelState] = useState<CefrLevel>(() => readInitial());

  useEffect(() => {
    const listener = (l: CefrLevel) => setLevelState(l);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setLevel = (l: CefrLevel) => {
    window.localStorage.setItem(APP_LEVEL_KEY, l);
    listeners.forEach((fn) => fn(l));
  };

  return [level, setLevel];
}

export const APP_LEVELS = VALID;
