import { describe, it, expect } from 'vitest';
import { CATEGORY_SEED, SOURCE_SEED } from '../src/db/seed-data';

describe('seed data', () => {
  it('defines exactly the three categories with unique positions', () => {
    expect(CATEGORY_SEED.map((c) => c.slug).sort()).toEqual(['poland', 'positive', 'world']);
    const positions = CATEGORY_SEED.map((c) => c.position);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('every category has en/pl/ru labels', () => {
    for (const c of CATEGORY_SEED) {
      expect(Object.keys(c.labels).sort()).toEqual(['en', 'pl', 'ru']);
    }
  });

  it('every source references a known category and has a feed url', () => {
    const slugs = new Set(CATEGORY_SEED.map((c) => c.slug));
    for (const s of SOURCE_SEED) {
      expect(slugs.has(s.categorySlug)).toBe(true);
      expect(s.feedUrl).toMatch(/^https?:\/\//);
    }
  });
});
