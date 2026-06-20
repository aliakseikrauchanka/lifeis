/**
 * Reduces a raw Language Reactor export item down to only the fields the import
 * endpoint needs, dropping the bulky embedded data (base64 audio, thumbnails,
 * subtitle tokens, etc.) so the upload payload stays small.
 *
 * `label` is a human-readable string for the skipped/duplicate report: the word
 * text when present, otherwise a phrase's subtitle text (for word-less PHRASE
 * items), otherwise the opaque key.
 */
export interface SlimImportItem {
  key?: string;
  label: string;
  word?: { text: string };
  wordTranslationsArr: string[];
  langCode_G?: string;
  translationLangCode_G?: string;
}

export function slimImportItem(raw: unknown): SlimImportItem {
  const item = raw as {
    key?: string;
    word?: { text?: string };
    wordTranslationsArr?: unknown;
    langCode_G?: string;
    translationLangCode_G?: string;
    context?: { phrase?: { subtitles?: Record<string, unknown> } };
  };

  const wordText = item?.word?.text;
  const word = typeof wordText === 'string' && wordText ? { text: wordText } : undefined;

  const subtitles = item?.context?.phrase?.subtitles;
  const phraseText =
    subtitles && typeof subtitles === 'object'
      ? Object.values(subtitles)
          .filter((v): v is string => typeof v === 'string')
          .join(' ')
          .trim()
      : '';

  const label = word?.text || phraseText || item?.key || 'unknown';

  const wordTranslationsArr = Array.isArray(item?.wordTranslationsArr)
    ? item.wordTranslationsArr.filter((v): v is string => typeof v === 'string')
    : [];

  return {
    key: item?.key,
    label,
    word,
    wordTranslationsArr,
    langCode_G: item?.langCode_G,
    translationLangCode_G: item?.translationLangCode_G,
  };
}
