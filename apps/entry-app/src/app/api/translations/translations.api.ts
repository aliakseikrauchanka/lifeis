import { utilFetch } from '@lifeis/common-ui';

export interface TranslationExample {
  original: string;
  translated: string;
}

export interface TranslationResult {
  translations: string[];
  examples: TranslationExample[];
}

export const detectLanguage = async (text: string): Promise<string> => {
  const accessToken = localStorage.getItem('accessToken');
  const res = await utilFetch('/translations/detect-language', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text }),
  });
  const { languageCode } = await res.json();
  return languageCode;
};

export const fetchTranslation = async (
  text: string,
  targetLanguage: string,
  originalLanguage: string,
): Promise<TranslationResult> => {
  const accessToken = localStorage.getItem('accessToken');
  const res = await utilFetch('/translations/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text, targetLanguage, originalLanguage }),
  });
  return res.json();
};

export const saveTranslation = async (data: {
  original: string;
  translation: string;
  originalLanguage: string;
  translationLanguage: string;
}): Promise<void> => {
  const accessToken = localStorage.getItem('accessToken');
  await utilFetch('/translations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data),
  });
};
