import { describe, it, expect } from 'vitest';
import { assembleEdition } from '../src/lib/read';

const rows = {
  edition: { editionDate: '2026-06-28', publishedAt: '2026-06-28T00:05:00Z' },
  categories: [
    { id: 'c2', slug: 'world', position: 2, enabled: true, labels: { en: 'World', pl: 'Świat', ru: 'Мир' } },
    { id: 'c1', slug: 'poland', position: 1, enabled: true, labels: { en: 'Poland', pl: 'Polska', ru: 'Польша' } },
    { id: 'c3', slug: 'hidden', position: 4, enabled: false, labels: { en: 'X', pl: 'X', ru: 'X' } },
  ],
  stories: [
    { id: 's1', categoryId: 'c1', position: 1, sourceName: 'PAP', sourceUrl: 'https://pap/1' },
  ],
  translations: [
    { storyId: 's1', lang: 'en', headline: 'EN', body: 'b' },
    { storyId: 's1', lang: 'pl', headline: 'PL', body: 'b' },
    { storyId: 's1', lang: 'ru', headline: 'RU', body: 'b' },
  ],
};

describe('assembleEdition', () => {
  it('orders categories by position, excludes disabled, embeds 3 langs', () => {
    const out = assembleEdition(rows as any)!;
    expect(out.categories.map((c) => c.slug)).toEqual(['poland', 'world']); // hidden excluded, ordered
    const poland = out.categories[0];
    expect(poland.stories[0].translations.en.headline).toBe('EN');
    expect(Object.keys(poland.stories[0].translations).sort()).toEqual(['en', 'pl', 'ru']);
  });

  it('returns null when no edition', () => {
    expect(assembleEdition(null as any)).toBeNull();
  });
});
