import { utilFetch } from '@lifeis/common-ui';

export interface TranslationData {
  _id: string;
  original: string;
  translation: string;
  originalLanguage: string;
  translationLanguage: string;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface SrsCard {
  _id: string;
  translation_id: string;
  due_at: number;
  interval_days: number;
  ease: number;
  reps: number;
  lapses: number;
  learned_at?: number | null;
  last_reviewed_at?: number | null;
  last_rating?: Rating | null;
  translation: TranslationData;
}

export const fetchDueCards = async (): Promise<SrsCard[]> => {
  const res = await utilFetch('/srs/due');
  if (!res.ok) throw new Error('Failed to fetch due cards');
  const { cards } = await res.json();
  return cards;
};

export const fetchTrainedToday = async (): Promise<SrsCard[]> => {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const res = await utilFetch(`/srs/trained-today?since=${since.getTime()}`);
  if (!res.ok) throw new Error('Failed to fetch trained-today cards');
  const { cards } = await res.json();
  return cards;
};

export interface AddedTranslation extends TranslationData {
  timestamp: number;
  enrolled: boolean;
}

export const fetchAddedToday = async (): Promise<AddedTranslation[]> => {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const res = await utilFetch(`/translations/added-since?since=${since.getTime()}`);
  if (!res.ok) throw new Error('Failed to fetch added-since translations');
  const { translations } = await res.json();
  return translations;
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

export const setTranslationLearned = async (translationId: string, learned: boolean): Promise<void> => {
  const res = await utilFetch('/srs/learned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ translationId, learned }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body?.message === 'string' ? body.message : 'Failed to update learned state');
  }
};

export interface Example {
  original: string;
  translated: string;
}

export const fetchExamples = async (
  word: string,
  language: string,
  translationLanguage: string,
  options?: { signal?: AbortSignal; translation?: string },
): Promise<Example[]> => {
  const res = await utilFetch('/translations/examples', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, language, translationLanguage, translation: options?.translation }),
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

export interface ImportPreviewResult {
  total: number;
  toImportCount: number;
  duplicates: string[];
  skipped: string[];
}

export const previewImportTranslations = async (items: unknown[]): Promise<ImportPreviewResult> => {
  const res = await utilFetch('/translations/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, dryRun: true }),
  });
  if (!res.ok) throw new Error('Failed to preview import');
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

export type TranslationProvider = 'openai' | 'deepseek' | 'glosbe' | 'gemini' | 'anthropic' | 'claude-opus';

export interface InflectionTable {
  title: string;
  columns: string[];
  rows: { label: string; cells: string[] }[];
}

export interface ProviderExplanation {
  /** Dictionary / base form (lemma) of the looked-up word, in the source language. */
  baseForm: string | null;
  /** A brief plain-language definition of the word, in the UI interface language. */
  meaning: string | null;
  partOfSpeech: string;
  inflection: InflectionTable | null;
  /** Synonyms / near-synonyms of the word, in the word's own language. */
  synonyms: string[] | null;
  note: string | null;
}

export interface ProviderCorrection {
  corrected: string;
  what: string;
  why: string;
}

export interface ProviderTranslationResult {
  translations: string[];
  examples: Example[];
  correction: ProviderCorrection | null;
  error: string | null;
}

export const translateText = async (
  text: string,
  targetLanguage: string,
  originalLanguage: string | undefined,
  provider: TranslationProvider,
  uiLanguage: string,
): Promise<ProviderTranslationResult> => {
  const res = await utilFetch('/translations/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, targetLanguage, originalLanguage, provider, uiLanguage }),
  });
  if (!res.ok) throw new Error('Failed to translate');
  return res.json();
};

/** On-demand grammar explanation for a source word/phrase, in the UI interface language. */
export const explainWord = async (
  text: string,
  language: string,
  provider: TranslationProvider,
  uiLanguage: string,
): Promise<ProviderExplanation | null> => {
  const res = await utilFetch('/translations/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, provider, uiLanguage }),
  });
  if (!res.ok) throw new Error('Failed to explain');
  const { explanation } = await res.json();
  return explanation ?? null;
};

/** Authoritative Polish dictionary entry scraped from sjp.pwn.pl. */
export interface PwnDictionaryEntry {
  headword: string | null;
  inflection: string | null;
  definitions: string[];
  synonyms: string[];
  etymology: string | null;
  examples: string[];
  sourceUrl: string;
}

/** On-demand Polish dictionary lookup (sjp.pwn.pl). Returns null when the word isn't found. */
export const lookupPwnDictionary = async (word: string): Promise<PwnDictionaryEntry | null> => {
  const res = await utilFetch('/translations/dictionary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: word, language: 'pl' }),
  });
  if (!res.ok) throw new Error('Failed to look up dictionary');
  const { entry } = await res.json();
  return entry ?? null;
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

export interface SentenceTrainingWord {
  translationId: string;
  original: string;
  translation: string;
}

export interface SentenceTrainingGenerated {
  words: SentenceTrainingWord[];
  story: string;
  translation: string;
  originalLanguage: string;
  translationLanguage: string;
}

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const generateSentenceTraining = async (params: {
  wordCount?: number;
  sentenceCount: number;
  level: CefrLevel;
  translationIds?: string[];
  nativeLanguage?: string;
  trainingLanguage?: string;
}): Promise<SentenceTrainingGenerated> => {
  const res = await utilFetch('/srs/sentence-training/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || 'Failed to generate sentence training');
  }
  return res.json();
};

export interface SentenceTrainingCheckResult {
  score: number;
  grammarFeedback: string;
  matchFeedback: string;
  corrected: string;
}

export const checkSentenceTraining = async (payload: {
  story: string;
  transcript: string;
  originalLanguage: string;
  translationLanguage: string;
}): Promise<SentenceTrainingCheckResult> => {
  const res = await utilFetch('/srs/sentence-training/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to check sentence training');
  return res.json();
};

export interface SentenceConstructionGenerated {
  words: SentenceTrainingWord[];
  originalLanguage: string;
  translationLanguage: string;
}

export const generateSentenceConstruction = async (params: {
  wordCount?: number;
  level: CefrLevel;
  translationIds?: string[];
  nativeLanguage?: string;
  trainingLanguage?: string;
}): Promise<SentenceConstructionGenerated> => {
  const res = await utilFetch('/srs/sentence-construction/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || 'Failed to generate sentence construction');
  }
  return res.json();
};

export interface SentenceConstructionCheckResult {
  grammarFeedback: string;
  levelSuggestion: string;
  improved: string;
  usedWords: string[];
  missingWords: string[];
}

export const checkSentenceConstruction = async (payload: {
  userText: string;
  words: SentenceTrainingWord[];
  level: CefrLevel;
  originalLanguage: string;
}): Promise<SentenceConstructionCheckResult> => {
  const res = await utilFetch('/srs/sentence-construction/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to check sentence construction');
  return res.json();
};

export interface SentenceBuilderGenerated {
  trainingSentence: string;
  nativeSentence: string;
  words: string[];
  shuffled: string[];
  originalLanguage: string;
  translationLanguage: string;
  source?: 'random' | 'library';
  translationId?: string;
}

export const generateSentenceBuilder = async (params: {
  level: CefrLevel;
  nativeLanguage: string;
  trainingLanguage: string;
  source?: 'random' | 'library';
}): Promise<SentenceBuilderGenerated> => {
  const res = await utilFetch('/srs/sentence-builder/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || 'Failed to generate sentence builder');
  }
  return res.json();
};

export interface WordBuilderGenerated {
  trainingText: string;
  nativeText: string;
  originalLanguage: string;
  translationLanguage: string;
  source?: 'random' | 'library';
  translationId?: string;
}

export const generateWordBuilder = async (params: {
  level: CefrLevel;
  nativeLanguage: string;
  trainingLanguage: string;
  source?: 'random' | 'library';
}): Promise<WordBuilderGenerated> => {
  const res = await utilFetch('/srs/word-builder/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || 'Failed to generate word builder');
  }
  return res.json();
};

export const fetchTranslations = async (): Promise<TranslationData[]> => {
  const res = await utilFetch('/translations');
  if (!res.ok) throw new Error('Failed to fetch translations');
  const { translations } = await res.json();
  return translations;
};
