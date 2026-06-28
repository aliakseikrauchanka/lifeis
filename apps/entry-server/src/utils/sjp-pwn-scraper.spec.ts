import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePwnHtml, pwnUrl } from './sjp-pwn-scraper';

const fixture = readFileSync(join(__dirname, '__fixtures__', 'pwn-kasowac.html'), 'utf-8');

describe('parsePwnHtml', () => {
  const entry = parsePwnHtml(fixture, 'kasować');

  it('returns an entry for a known word', () => {
    expect(entry).not.toBeNull();
  });

  it('extracts the headword (base form)', () => {
    expect(entry?.headword).toBe('kasować');
  });

  it('extracts the numbered definitions', () => {
    expect(entry?.definitions.length).toBeGreaterThanOrEqual(5);
    expect(entry?.definitions[0]).toBe('likwidować, znosić lub unieważniać coś');
    // Number prefix and guillemets are stripped.
    expect(entry?.definitions.every((d) => !/^\d+\./.test(d) && !d.includes('«'))).toBe(true);
  });

  it('extracts the inflection line', () => {
    expect(entry?.inflection).toBe('kasować -suję, -sują');
  });

  it('extracts synonyms but not related words or the headword', () => {
    expect(entry?.synonyms).toEqual(expect.arrayContaining(['rozbijać', 'zarabiać', 'uchylać', 'pobierać']));
    expect(entry?.synonyms).not.toContain('basować'); // related word (/slowniki/basować.html)
    expect(entry?.synonyms).not.toContain('kasować'); // the headword itself
    expect(entry?.synonyms.some((s) => /zobacz/i.test(s))).toBe(false);
  });

  it('extracts the etymology', () => {
    expect(entry?.etymology).toBe('‹łac. casso›');
  });

  it('extracts at least one corpus example, trimmed of ellipses', () => {
    expect(entry?.examples.length).toBeGreaterThanOrEqual(1);
    expect(entry?.examples.every((e) => !e.startsWith('…') && !e.startsWith('...'))).toBe(true);
  });

  it('sets the canonical source url', () => {
    expect(entry?.sourceUrl).toBe(pwnUrl('kasować'));
  });
});

describe('parsePwnHtml — empty/not-found', () => {
  it('returns null when there is no dictionary content', () => {
    expect(parsePwnHtml('<html><body><h1>Nothing here</h1></body></html>', 'zzzz')).toBeNull();
  });
});
