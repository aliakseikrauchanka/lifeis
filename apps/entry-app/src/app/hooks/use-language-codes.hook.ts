import { useCallback } from 'react';
import { useStorageContext } from '../contexts/storage.context';

export function useLanguageCodes() {
  const { languageCode } = useStorageContext();

  const getDeepgramLanguage = useCallback(() => {
    if (languageCode === 'cs-CZ') return 'cs';
    if (languageCode === 'de-DE') return 'de';
    if (languageCode === 'fr-FR') return 'fr';
    return languageCode;
  }, [languageCode]);

  const getElevenLabsLanguage = useCallback(() => {
    const mapping: Record<string, string> = {
      pl: 'pl',
      ru: 'ru',
      en: 'en',
      es: 'es',
      'cs-CZ': 'cs',
      'de-DE': 'de',
      'fr-FR': 'fr',
    };
    return mapping[languageCode] || languageCode.split('-')[0];
  }, [languageCode]);

  return { getDeepgramLanguage, getElevenLabsLanguage };
}
