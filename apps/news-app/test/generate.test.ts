import { describe, it, expect } from 'vitest';
import { generateEdition } from '../src/lib/generate';
import type { Candidate } from '../src/lib/rss';

const cand = (link: string): Candidate => ({ title: link, summary: 's', link, sourceName: 'X', publishedAt: new Date() });
const pick = (url: string) => ({ source_url: url, source_name: 'X', translations: {
  en: { headline: 'h', body: 'b' }, pl: { headline: 'h', body: 'b' }, ru: { headline: 'h', body: 'b' } } });

describe('generateEdition (dry-run via injected deps)', () => {
  it('returns 3 picks per enabled category and status success', async () => {
    const deps = {
      loadCategories: async () => [
        { id: 'cat-poland', slug: 'poland', position: 1 },
        { id: 'cat-world', slug: 'world', position: 2 },
      ],
      loadSources: async (categoryId: string) => [{ feedUrl: 'u', sourceName: 'X', categoryId }],
      collect: async () => ({ candidates: [cand('https://x/a'), cand('https://x/b'), cand('https://x/c')], feedsFetched: 1 }),
      dedupe: (c: Candidate[]) => c,
      select: async () => [pick('https://x/a'), pick('https://x/b'), pick('https://x/c')],
    };
    const res = await generateEdition({ trigger: 'manual', dryRun: true, deps: deps as any });
    expect(res.status).toBe('success');
    expect(res.storiesCreated).toBe(6); // 2 categories x 3
    expect(res.editionId).toBeNull(); // dry-run does not persist
  });

  it('marks partial when one category fails', async () => {
    const deps = {
      loadCategories: async () => [
        { id: 'cat-poland', slug: 'poland', position: 1 },
        { id: 'cat-world', slug: 'world', position: 2 },
      ],
      loadSources: async (categoryId: string) => [{ feedUrl: 'u', sourceName: 'X', categoryId }],
      collect: async () => ({ candidates: [cand('https://x/a'), cand('https://x/b'), cand('https://x/c')], feedsFetched: 1 }),
      dedupe: (c: Candidate[]) => c,
      select: async (slug: string) => {
        if (slug === 'world') throw new Error('gemini failed');
        return [pick('https://x/a'), pick('https://x/b'), pick('https://x/c')];
      },
    };
    const res = await generateEdition({ trigger: 'manual', dryRun: true, deps: deps as any });
    expect(res.status).toBe('partial');
    expect(res.details.world.error).toMatch(/gemini failed/);
  });

  it('marks failed when all categories fail', async () => {
    const deps = {
      loadCategories: async () => [{ id: 'cat-poland', slug: 'poland', position: 1 }],
      loadSources: async (categoryId: string) => [{ feedUrl: 'u', sourceName: 'X', categoryId }],
      collect: async () => ({ candidates: [], feedsFetched: 0 }),
      dedupe: (c: Candidate[]) => c,
      select: async () => { throw new Error('no candidates'); },
    };
    const res = await generateEdition({ trigger: 'manual', dryRun: true, deps: deps as any });
    expect(res.status).toBe('failed');
  });
});
