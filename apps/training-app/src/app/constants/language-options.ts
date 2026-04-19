export interface LanguageOption {
  code: string;
  label: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'pl', label: 'Polish', flag: '🇵🇱' },
  { code: 'ru-RU', label: 'Russian', flag: '🇷🇺' },
  { code: 'en-US', label: 'English', flag: '🇺🇸' },
  { code: 'de-DE', label: 'German', flag: '🇩🇪' },
  { code: 'fr-FR', label: 'French', flag: '🇫🇷' },
  { code: 'sr-RS', label: 'Serbian', flag: '🇷🇸' },
  { code: 'fi', label: 'Finnish', flag: '🇫🇮' },
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
];

export function getLanguageFlag(code: string): string {
  return LANGUAGE_OPTIONS.find((l) => l.code === code)?.flag ?? code;
}

export const LANGUAGE_CODES = LANGUAGE_OPTIONS.map((l) => l.code);

export function isValidLanguageCode(code: string | null | undefined): code is string {
  return !!code && LANGUAGE_CODES.includes(code);
}

export function getLanguageLabel(code: string): string {
  return LANGUAGE_OPTIONS.find((l) => l.code === code)?.label ?? code;
}

export function matchesAppLanguagePair(
  item: { originalLanguage: string; translationLanguage: string },
  nativeLanguage: string,
  trainingLanguage: string,
): boolean {
  if (nativeLanguage === trainingLanguage) return true;
  return (
    (item.originalLanguage === trainingLanguage && item.translationLanguage === nativeLanguage) ||
    (item.originalLanguage === nativeLanguage && item.translationLanguage === trainingLanguage)
  );
}
