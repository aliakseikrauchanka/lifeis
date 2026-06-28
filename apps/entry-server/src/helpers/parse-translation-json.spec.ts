import { parseTranslationJson, parseExplanationJson, parseCorrectionJson } from './parse-translation-json';

describe('parseTranslationJson', () => {
  it('parses translations and examples', () => {
    const raw = JSON.stringify({
      translations: ['kot', 'kotek'],
      examples: [{ original: 'Mam kota', translated: 'I have a cat' }],
    });
    const r = parseTranslationJson(raw);
    expect(r.translations).toEqual(['kot', 'kotek']);
    expect(r.examples).toEqual([{ original: 'Mam kota', translated: 'I have a cat' }]);
  });

  it('defaults to empty arrays and null correction for missing fields', () => {
    const r = parseTranslationJson(JSON.stringify({}));
    expect(r.translations).toEqual([]);
    expect(r.examples).toEqual([]);
    expect(r.correction).toBeNull();
  });

  it('parses an embedded correction', () => {
    const raw = JSON.stringify({
      translations: ['kot'],
      examples: [],
      correction: { corrected: 'kot', what: 'typo', why: 'extra letter' },
    });
    expect(parseTranslationJson(raw).correction).toEqual({
      corrected: 'kot',
      what: 'typo',
      why: 'extra letter',
    });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseTranslationJson('not json')).toThrow();
  });
});

describe('parseExplanationJson', () => {
  it('parses a structured explanation with an inflection table', () => {
    const raw = JSON.stringify({
      explanation: {
        baseForm: 'kot',
        meaning: 'a small domesticated feline animal',
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
    expect(parseExplanationJson(raw)).toEqual({
      baseForm: 'kot',
      meaning: 'a small domesticated feline animal',
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

  it('defaults baseForm to null when absent', () => {
    const raw = JSON.stringify({ explanation: { partOfSpeech: 'verb', inflection: null, note: null } });
    expect(parseExplanationJson(raw)?.baseForm).toBeNull();
  });

  it('accepts the explanation object at the top level', () => {
    const raw = JSON.stringify({ partOfSpeech: 'verb', inflection: null, note: null });
    expect(parseExplanationJson(raw)?.partOfSpeech).toBe('verb');
  });

  it('keeps partOfSpeech but nulls a malformed inflection', () => {
    const raw = JSON.stringify({
      explanation: { partOfSpeech: 'verb', inflection: { title: 'Conjugation', columns: 'nope', rows: [] }, note: null },
    });
    const e = parseExplanationJson(raw);
    expect(e).not.toBeNull();
    expect(e?.partOfSpeech).toBe('verb');
    expect(e?.inflection).toBeNull();
  });

  it('returns null when partOfSpeech is missing', () => {
    expect(parseExplanationJson(JSON.stringify({ explanation: { inflection: null, note: 'x' } }))).toBeNull();
  });

  it('caps oversized tables and strings', () => {
    const raw = JSON.stringify({
      explanation: {
        partOfSpeech: 'x'.repeat(1000),
        inflection: {
          title: 'T',
          columns: Array(10).fill('c'),
          rows: Array(50)
            .fill(0)
            .map((_, i) => ({ label: `r${i}`, cells: Array(10).fill('v') })),
        },
        note: null,
      },
    });
    const e = parseExplanationJson(raw);
    expect(e?.partOfSpeech.length).toBe(500);
    expect(e?.inflection?.columns.length).toBe(6);
    expect(e?.inflection?.rows.length).toBe(20);
    expect(e?.inflection?.rows[0].cells.length).toBe(6);
  });
});

describe('parseCorrectionJson', () => {
  it('parses a correction when all three fields are present', () => {
    const raw = JSON.stringify({
      correction: { corrected: 'kota', what: 'Wrong case ending', why: 'Accusative of animate masculine is "kota".' },
    });
    expect(parseCorrectionJson(raw)).toEqual({
      corrected: 'kota',
      what: 'Wrong case ending',
      why: 'Accusative of animate masculine is "kota".',
    });
  });

  it('accepts the correction object at the top level', () => {
    const raw = JSON.stringify({ corrected: 'kota', what: 'x', why: 'y' });
    expect(parseCorrectionJson(raw)?.corrected).toBe('kota');
  });

  it('returns null (no mistake) when correction is null', () => {
    expect(parseCorrectionJson(JSON.stringify({ correction: null }))).toBeNull();
  });

  it('returns null when a field is missing', () => {
    expect(parseCorrectionJson(JSON.stringify({ correction: { corrected: 'kota', what: 'Wrong case' } }))).toBeNull();
  });
});
