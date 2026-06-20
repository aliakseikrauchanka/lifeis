import { buildImportDocs, importKey, splitNewAndDuplicates } from './import-translations';

const config = {
  userId: 'user-1',
  now: 1000,
  allowedLanguageCodes: new Set(['pl', 'ru-RU', 'en-US']),
  maxTextLength: 2000,
  maxTranslationLength: 2000,
};

const validItem = {
  key: 'k1',
  word: { text: 'kot' },
  wordTranslationsArr: ['cat'],
  langCode_G: 'pl',
  translationLangCode_G: 'en',
};

describe('buildImportDocs', () => {
  it('builds a normalized doc for a valid item', () => {
    const { docs, skipped } = buildImportDocs([validItem], config);
    expect(skipped).toEqual([]);
    expect(docs).toEqual([
      {
        original: 'Kot',
        translation: 'Cat',
        originalLanguage: 'pl',
        translationLanguage: 'en-US',
        owner_id: 'user-1',
        timestamp: 1000,
      },
    ]);
  });

  it('skips items missing word text or translations (reports key)', () => {
    const { docs, skipped } = buildImportDocs(
      [{ key: 'bad', word: { text: '' }, wordTranslationsArr: [], langCode_G: 'pl', translationLangCode_G: 'en' }],
      config,
    );
    expect(docs).toEqual([]);
    expect(skipped).toEqual(['bad']);
  });

  it('skips items with unmapped/disallowed languages (reports word text)', () => {
    const { docs, skipped } = buildImportDocs(
      [{ ...validItem, translationLangCode_G: 'xx' }],
      config,
    );
    expect(docs).toEqual([]);
    expect(skipped).toEqual(['kot']);
  });

  it('truncates to the configured max lengths', () => {
    const longWord = 'a'.repeat(3000);
    const { docs } = buildImportDocs(
      [{ ...validItem, word: { text: longWord }, wordTranslationsArr: [longWord] }],
      config,
    );
    expect(docs[0].original.length).toBe(2000);
    expect(docs[0].translation.length).toBe(2000);
  });
});

describe('importKey', () => {
  it('joins normalized original and language pair', () => {
    expect(importKey({ original: 'Kot', originalLanguage: 'pl', translationLanguage: 'en-US' })).toBe('Kot|pl|en-US');
  });
});

describe('splitNewAndDuplicates', () => {
  it('separates docs whose key is already present', () => {
    const docs = buildImportDocs([validItem, { ...validItem, word: { text: 'pies' }, wordTranslationsArr: ['dog'] }], config).docs;
    const existing = new Set(['Kot|pl|en-US']);
    const { newDocs, duplicates } = splitNewAndDuplicates(docs, existing);
    expect(newDocs.map((d) => d.original)).toEqual(['Pies']);
    expect(duplicates.map((d) => d.original)).toEqual(['Kot']);
  });
});
