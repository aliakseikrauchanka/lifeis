import { describe, it, expect } from 'vitest';
import { dedupeCandidates } from '../src/lib/dedupe';
import type { Candidate } from '../src/lib/rss';

const c = (over: Partial<Candidate>): Candidate => ({
  title: 't', summary: 's', link: 'https://a.com/1', sourceName: 'X', publishedAt: null, ...over,
});

describe('dedupeCandidates', () => {
  it('removes exact duplicate URLs', () => {
    const out = dedupeCandidates([c({ link: 'https://a.com/1' }), c({ link: 'https://a.com/1' })]);
    expect(out).toHaveLength(1);
  });

  it('removes near-identical titles from different sources', () => {
    const out = dedupeCandidates([
      c({ link: 'https://a.com/1', title: 'Poland signs new trade deal' }),
      c({ link: 'https://b.com/2', title: 'Poland Signs New Trade Deal!' }),
    ]);
    expect(out).toHaveLength(1);
  });

  it('keeps distinct stories', () => {
    const out = dedupeCandidates([
      c({ link: 'https://a.com/1', title: 'Election results announced' }),
      c({ link: 'https://b.com/2', title: 'Weather forecast for the week' }),
    ]);
    expect(out).toHaveLength(2);
  });
});
