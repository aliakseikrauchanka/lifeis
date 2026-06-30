import { describe, it, expect } from 'vitest';
import { validatePicks, selectAndTranslate, buildPrompt } from '../src/lib/gemini';
import type { Candidate } from '../src/lib/rss';

const cands: Candidate[] = [
  { title: 'A', summary: 'sa', link: 'https://x.com/a', sourceName: 'X', publishedAt: null },
  { title: 'B', summary: 'sb', link: 'https://x.com/b', sourceName: 'X', publishedAt: null },
  { title: 'C', summary: 'sc', link: 'https://x.com/c', sourceName: 'X', publishedAt: null },
];

const validPick = (url: string) => ({
  source_url: url, source_name: 'X',
  translations: {
    en: { headline: 'h', body: 'b' },
    pl: { headline: 'h', body: 'b' },
    ru: { headline: 'h', body: 'b' },
  },
});

describe('validatePicks', () => {
  it('accepts 3 valid picks whose urls are candidates', () => {
    const raw = [validPick('https://x.com/a'), validPick('https://x.com/b'), validPick('https://x.com/c')];
    expect(validatePicks(raw, cands)).toHaveLength(3);
  });

  it('rejects a hallucinated source_url', () => {
    const raw = [validPick('https://evil.com/z'), validPick('https://x.com/b'), validPick('https://x.com/c')];
    expect(() => validatePicks(raw, cands)).toThrow();
  });

  it('accepts fewer picks than the target when candidates are scarce', () => {
    expect(validatePicks([validPick('https://x.com/a')], cands)).toHaveLength(1);
  });

  it('rejects empty picks', () => {
    expect(() => validatePicks([], cands)).toThrow();
  });

  it('rejects more picks than the per-category limit', () => {
    const tooMany = Array.from({ length: 6 }, () => validPick('https://x.com/a'));
    expect(() => validatePicks(tooMany, cands)).toThrow();
  });
});

describe('selectAndTranslate', () => {
  it('retries once on invalid JSON then succeeds', async () => {
    let calls = 0;
    const generate = async () => {
      calls++;
      if (calls === 1) return 'not json';
      return JSON.stringify([validPick('https://x.com/a'), validPick('https://x.com/b'), validPick('https://x.com/c')]);
    };
    const picks = await selectAndTranslate('world', cands, { generate });
    expect(calls).toBe(2);
    expect(picks).toHaveLength(3);
  });

  it('buildPrompt includes neutral-tone rules and candidate urls', () => {
    const p = buildPrompt('world', cands);
    expect(p).toMatch(/neutral/i);
    expect(p).toContain('https://x.com/a');
  });
});
