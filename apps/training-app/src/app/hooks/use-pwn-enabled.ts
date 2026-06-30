import { useEffect, useState } from 'react';

const PWN_ENABLED_KEY = 'training-app-pwn-enabled';

function readInitial(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(PWN_ENABLED_KEY) === 'true';
}

const listeners = new Set<(v: boolean) => void>();

/** Whether the PWN dictionary tab is enabled (persisted in localStorage). Off by default. */
export function usePwnEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabledState] = useState<boolean>(() => readInitial());

  useEffect(() => {
    const listener = (v: boolean) => setEnabledState(v);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setEnabled = (v: boolean) => {
    window.localStorage.setItem(PWN_ENABLED_KEY, String(v));
    listeners.forEach((fn) => fn(v));
  };

  return [enabled, setEnabled];
}
