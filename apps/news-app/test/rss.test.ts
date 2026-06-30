import { describe, it, expect } from 'vitest';
import Parser from 'rss-parser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeItems, withinWindow } from '../src/lib/rss';

const xml = readFileSync(join(__dirname, 'fixtures/reuters.xml'), 'utf-8');

describe('rss normalize', () => {
  it('maps rss items to candidates', async () => {
    const parsed = await new Parser().parseString(xml);
    const cands = normalizeItems(parsed.items, 'Reuters');
    expect(cands).toHaveLength(2);
    expect(cands[0]).toMatchObject({
      title: 'Sample headline one',
      link: 'https://reuters.com/world/article-one',
      sourceName: 'Reuters',
    });
    expect(cands[0].publishedAt instanceof Date).toBe(true);
  });

  it('withinWindow filters by recency', () => {
    const now = new Date('2026-06-28T12:00:00Z');
    const fresh = { title: 't', summary: 's', link: 'l', sourceName: 'r', publishedAt: new Date('2026-06-28T09:00:00Z') };
    const stale = { ...fresh, publishedAt: new Date('2026-06-25T09:00:00Z') };
    expect(withinWindow(fresh, now, 36)).toBe(true);
    expect(withinWindow(stale, now, 36)).toBe(false);
  });
});
