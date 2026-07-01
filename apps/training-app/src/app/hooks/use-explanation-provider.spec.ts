/** @jest-environment jsdom */
import { EXPLANATION_PROVIDER_KEY, readExplanationProvider } from './use-explanation-provider';

describe('readExplanationProvider', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns gemini when storage is unset', () => {
    expect(readExplanationProvider()).toBe('gemini');
  });

  it('returns a valid stored provider as-is', () => {
    window.localStorage.setItem(EXPLANATION_PROVIDER_KEY, 'claude-opus');
    expect(readExplanationProvider()).toBe('claude-opus');
  });

  it('falls back to gemini for a non-explanation provider (glosbe)', () => {
    window.localStorage.setItem(EXPLANATION_PROVIDER_KEY, 'glosbe');
    expect(readExplanationProvider()).toBe('gemini');
  });

  it('falls back to gemini for an unknown value', () => {
    window.localStorage.setItem(EXPLANATION_PROVIDER_KEY, 'bogus');
    expect(readExplanationProvider()).toBe('gemini');
  });
});
