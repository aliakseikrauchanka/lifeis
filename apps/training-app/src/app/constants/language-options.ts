export interface LanguageOption {
  code: string;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'pl', label: 'Polish' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'en-US', label: 'English' },
  { code: 'de-DE', label: 'German' },
  { code: 'fr-FR', label: 'French' },
  { code: 'sr-RS', label: 'Serbian' },
  { code: 'fi', label: 'Finnish' },
  { code: 'es', label: 'Spanish' },
];

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
