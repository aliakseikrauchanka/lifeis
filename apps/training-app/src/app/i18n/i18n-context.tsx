import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { InterfaceLocale } from './interface-locale';
import { persistInterfaceLocale, readInterfaceLocale } from './interface-locale';
import { bundles, type MessageKey } from './messages';

interface I18nContextValue {
  locale: InterfaceLocale;
  setLocale: (locale: InterfaceLocale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<InterfaceLocale>(() => readInterfaceLocale());

  const setLocale = useCallback((l: InterfaceLocale) => {
    persistInterfaceLocale(l);
    setLocaleState(l);
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => {
      const pack = bundles[locale] ?? bundles.en;
      let template = pack[key] ?? bundles.en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          const needle = `{{${k}}}`;
          template = template.split(needle).join(String(v));
        }
      }
      return template;
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
