export type InterfaceLocale = 'en' | 'ru' | 'pl' | 'es';

export const INTERFACE_LOCALES: InterfaceLocale[] = ['en', 'ru', 'pl', 'es'];

const STORAGE_KEY = 'training-app-ui-locale';

export function readInterfaceLocale(): InterfaceLocale {
  if (typeof window === 'undefined') return 'en';
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === 'en' || v === 'ru' || v === 'pl' || v === 'es') return v;
  return 'en';
}

export function persistInterfaceLocale(locale: InterfaceLocale): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, locale);
}
