import { formatEntry } from './format-entry';

describe('formatEntry', () => {
  it('trims leading and trailing whitespace', () => {
    expect(formatEntry('  kot  ')).toBe('Kot');
  });

  it('strips a single trailing period and re-trims', () => {
    expect(formatEntry('the dog runs.')).toBe('The dog runs');
    expect(formatEntry('hello . ')).toBe('Hello');
  });

  it('preserves trailing ? and !', () => {
    expect(formatEntry('why?')).toBe('Why?');
    expect(formatEntry('stop!')).toBe('Stop!');
  });

  it('capitalizes the first letter', () => {
    expect(formatEntry('dog')).toBe('Dog');
  });

  it('leaves the rest of the string untouched', () => {
    expect(formatEntry('USB cable')).toBe('USB cable');
    expect(formatEntry('iPhone')).toBe('IPhone');
  });

  it('handles multi-word sentences', () => {
    expect(formatEntry('  a quick brown fox.  ')).toBe('A quick brown fox');
  });

  it('returns empty string when value becomes empty after formatting', () => {
    expect(formatEntry('.')).toBe('');
    expect(formatEntry('   ')).toBe('');
  });
});
