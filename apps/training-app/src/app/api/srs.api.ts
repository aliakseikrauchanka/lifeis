import { utilFetch } from '@lifeis/common-ui';

export interface TranslationData {
  _id: string;
  original: string;
  translation: string;
  originalLanguage: string;
  translationLanguage: string;
}

export interface SrsCard {
  _id: string;
  translation_id: string;
  due_at: number;
  interval_days: number;
  ease: number;
  reps: number;
  lapses: number;
  translation: TranslationData;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export const fetchDueCards = async (): Promise<SrsCard[]> => {
  const res = await utilFetch('/srs/due');
  if (!res.ok) throw new Error('Failed to fetch due cards');
  const { cards } = await res.json();
  return cards;
};

export const fetchEnrolledCards = async (): Promise<SrsCard[]> => {
  const res = await utilFetch('/srs/enrolled');
  if (!res.ok) throw new Error('Failed to fetch enrolled cards');
  const { cards } = await res.json();
  return cards;
};

export const reviewCard = async (translationId: string, rating: Rating): Promise<void> => {
  const res = await utilFetch('/srs/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ translationId, rating }),
  });
  if (!res.ok) throw new Error('Failed to review card');
};

export const enrollTranslation = async (translationId: string): Promise<void> => {
  const res = await utilFetch('/srs/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ translationId }),
  });
  if (!res.ok) throw new Error('Failed to enroll translation');
};

export const enrollTranslationsBatch = async (translationIds: string[]): Promise<{ enrolled: number; existing: number }> => {
  const res = await utilFetch('/srs/enroll/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ translationIds }),
  });
  if (!res.ok) throw new Error('Failed to batch enroll translations');
  return res.json();
};

export const unenrollTranslation = async (translationId: string): Promise<void> => {
  const res = await utilFetch(`/srs/enroll/${translationId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to unenroll translation');
};

export interface Example {
  original: string;
  translated: string;
}

export const fetchExamples = async (
  word: string,
  language: string,
  translationLanguage: string,
  options?: { signal?: AbortSignal },
): Promise<Example[]> => {
  const res = await utilFetch('/translations/examples', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, language, translationLanguage }),
    signal: options?.signal,
  });
  if (!res.ok) throw new Error('Failed to fetch examples');
  const { examples } = await res.json();
  return examples;
};

export const importTranslations = async (items: unknown[]): Promise<{ inserted: number; skipped: number; total: number }> => {
  const res = await utilFetch('/translations/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error('Failed to import translations');
  return res.json();
};

export const updateTranslation = async (translationId: string, data: { original?: string; translation?: string }): Promise<void> => {
  const res = await utilFetch(`/translations/${translationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update translation');
};

export const deleteTranslation = async (translationId: string): Promise<void> => {
  const res = await utilFetch(`/translations/${translationId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete translation');
};

export const translateText = async (text: string, targetLanguage: string, originalLanguage?: string): Promise<{ translations: string[] }> => {
  const res = await utilFetch('/translations/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, targetLanguage, originalLanguage }),
  });
  if (!res.ok) throw new Error('Failed to translate');
  return res.json();
};

export const createTranslation = async (data: {
  original: string;
  translation: string;
  originalLanguage: string;
  translationLanguage: string;
}): Promise<void> => {
  const res = await utilFetch('/translations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create translation');
};

export const fetchTranslations = async (): Promise<TranslationData[]> => {
  const res = await utilFetch('/translations');
  if (!res.ok) throw new Error('Failed to fetch translations');
  const { translations } = await res.json();
  return translations;
};
