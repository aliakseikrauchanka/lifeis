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

export const unenrollTranslation = async (translationId: string): Promise<void> => {
  const res = await utilFetch(`/srs/enroll/${translationId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to unenroll translation');
};

export const fetchTranslations = async (): Promise<TranslationData[]> => {
  const res = await utilFetch('/translations');
  if (!res.ok) throw new Error('Failed to fetch translations');
  const { translations } = await res.json();
  return translations;
};
