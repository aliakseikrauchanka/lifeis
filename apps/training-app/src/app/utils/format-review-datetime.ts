import type { InterfaceLocale } from '../i18n/interface-locale';

const LOCALE_TAG: Record<InterfaceLocale, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  pl: 'pl-PL',
  es: 'es',
};

/** Format SRS due timestamp for display in the Library row (locale-aware). */
export function formatReviewDateTime(dueAtMs: number, locale: InterfaceLocale): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dueAtMs));
}
