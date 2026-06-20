import { formatEntry } from './format-entry';

export interface ImportDoc {
  original: string;
  translation: string;
  originalLanguage: string;
  translationLanguage: string;
  owner_id: string;
  timestamp: number;
}

export interface BuildImportDocsConfig {
  userId: string;
  now: number;
  allowedLanguageCodes: Set<string>;
  maxTextLength: number;
  maxTranslationLength: number;
}

// Maps short LLN language codes to app codes.
const LANG_MAP: Record<string, string> = {
  pl: 'pl',
  ru: 'ru-RU',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  sr: 'sr-RS',
  fi: 'fi',
  es: 'es',
};

export function buildImportDocs(
  items: unknown[],
  config: BuildImportDocsConfig,
): { docs: ImportDoc[]; skipped: string[] } {
  const docs: ImportDoc[] = [];
  const skipped: string[] = [];

  for (const raw of items) {
    const item = raw as {
      key?: string;
      label?: string;
      word?: { text?: string };
      wordTranslationsArr?: unknown[];
      langCode_G?: string;
      translationLangCode_G?: string;
    };
    const wordText = item.word?.text;
    const translations = item.wordTranslationsArr;
    // Human-readable text for the skipped report. The client carries `label`
    // (word text, or a phrase's subtitle text for word-less items); fall back to
    // the word text, then the opaque key.
    const label = item.label || wordText || item.key || 'unknown';
    if (!wordText || !Array.isArray(translations) || translations.length === 0) {
      skipped.push(label);
      continue;
    }

    const originalLanguage = LANG_MAP[item.langCode_G as string];
    const translationLanguage = LANG_MAP[item.translationLangCode_G as string];
    if (!originalLanguage || !translationLanguage) {
      skipped.push(label);
      continue;
    }
    if (
      !config.allowedLanguageCodes.has(originalLanguage) ||
      !config.allowedLanguageCodes.has(translationLanguage)
    ) {
      skipped.push(label);
      continue;
    }

    const original = formatEntry(String(wordText).slice(0, config.maxTextLength));
    const translation = formatEntry(String(translations[0]).slice(0, config.maxTranslationLength));
    if (original.length === 0 || translation.length === 0) {
      skipped.push(label);
      continue;
    }

    docs.push({
      original,
      translation,
      originalLanguage,
      translationLanguage,
      owner_id: config.userId,
      timestamp: config.now,
    });
  }

  return { docs, skipped };
}

export function importKey(d: {
  original: string;
  originalLanguage: string;
  translationLanguage: string;
}): string {
  return `${d.original}|${d.originalLanguage}|${d.translationLanguage}`;
}

export function splitNewAndDuplicates(
  docs: ImportDoc[],
  existingKeys: Set<string>,
): { newDocs: ImportDoc[]; duplicates: ImportDoc[] } {
  const newDocs: ImportDoc[] = [];
  const duplicates: ImportDoc[] = [];
  for (const d of docs) {
    if (existingKeys.has(importKey(d))) duplicates.push(d);
    else newDocs.push(d);
  }
  return { newDocs, duplicates };
}
