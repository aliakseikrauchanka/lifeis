import { parseTranslationJson } from './parse-translation-json';

describe('parseTranslationJson', () => {
  it('parses translations and examples (existing behavior)', () => {
    const raw = JSON.stringify({
      translations: ['kot', 'kotek'],
      examples: [{ original: 'Mam kota', translated: 'I have a cat' }],
    });
    const r = parseTranslationJson(raw);
    expect(r.translations).toEqual(['kot', 'kotek']);
    expect(r.examples).toEqual([{ original: 'Mam kota', translated: 'I have a cat' }]);
    expect(r.explanation).toBeNull();
    expect(r.correction).toBeNull();
  });

  it('parses a structured explanation with an inflection table', () => {
    const raw = JSON.stringify({
      translations: [],
      examples: [],
      explanation: {
        partOfSpeech: 'noun (masculine, animate)',
        inflection: {
          title: 'Declension',
          columns: ['', 'Singular', 'Plural'],
          rows: [
            { label: 'Nom', cells: ['kot', 'koty'] },
            { label: 'Gen', cells: ['kota', 'kotów'] },
          ],
        },
        note: 'Animate masculine: accusative = genitive.',
      },
    });
    const r = parseTranslationJson(raw);
    expect(r.explanation).toEqual({
      partOfSpeech: 'noun (masculine, animate)',
      inflection: {
        title: 'Declension',
        columns: ['', 'Singular', 'Plural'],
        rows: [
          { label: 'Nom', cells: ['kot', 'koty'] },
          { label: 'Gen', cells: ['kota', 'kotów'] },
        ],
      },
      note: 'Animate masculine: accusative = genitive.',
    });
  });

  it('keeps partOfSpeech but nulls a malformed inflection', () => {
    const raw = JSON.stringify({
      explanation: { partOfSpeech: 'verb', inflection: { title: 'Conjugation', columns: 'nope', rows: [] }, note: null },
    });
    const r = parseTranslationJson(raw);
    expect(r.explanation).not.toBeNull();
    expect(r.explanation?.partOfSpeech).toBe('verb');
    expect(r.explanation?.inflection).toBeNull();
  });

  it('nulls the whole explanation when partOfSpeech is missing', () => {
    const raw = JSON.stringify({ explanation: { inflection: null, note: 'x' } });
    expect(parseTranslationJson(raw).explanation).toBeNull();
  });

  it('parses a correction when all three fields are present', () => {
    const raw = JSON.stringify({
      correction: { corrected: 'kota', what: 'Wrong case ending', why: 'Accusative of animate masculine is "kota".' },
    });
    expect(parseTranslationJson(raw).correction).toEqual({
      corrected: 'kota',
      what: 'Wrong case ending',
      why: 'Accusative of animate masculine is "kota".',
    });
  });

  it('nulls the correction when a field is missing', () => {
    const raw = JSON.stringify({ correction: { corrected: 'kota', what: 'Wrong case' } });
    expect(parseTranslationJson(raw).correction).toBeNull();
  });

  it('caps oversized tables and strings', () => {
    const raw = JSON.stringify({
      explanation: {
        partOfSpeech: 'x'.repeat(1000),
        inflection: {
          title: 'T',
          columns: Array(10).fill('c'),
          rows: Array(50).fill(0).map((_, i) => ({ label: `r${i}`, cells: Array(10).fill('v') })),
        },
        note: null,
      },
    });
    const r = parseTranslationJson(raw);
    expect(r.explanation?.partOfSpeech.length).toBe(500);
    expect(r.explanation?.inflection?.columns.length).toBe(6);
    expect(r.explanation?.inflection?.rows.length).toBe(20);
    expect(r.explanation?.inflection?.rows[0].cells.length).toBe(6);
  });
});
