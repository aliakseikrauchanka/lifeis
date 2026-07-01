/** @jest-environment jsdom */
import { ENABLED_PROVIDERS_KEY, readEnabledProviders } from './use-enabled-providers';
import { TRANSLATION_PROVIDERS } from '../constants/translation-providers';

describe('readEnabledProviders', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns all providers when storage is unset', () => {
    expect(readEnabledProviders()).toEqual([...TRANSLATION_PROVIDERS]);
  });

  it('returns the stored subset in canonical order', () => {
    window.localStorage.setItem(ENABLED_PROVIDERS_KEY, JSON.stringify(['gemini', 'claude-opus']));
    expect(readEnabledProviders()).toEqual(['claude-opus', 'gemini']);
  });

  it('drops unknown ids', () => {
    window.localStorage.setItem(ENABLED_PROVIDERS_KEY, JSON.stringify(['gemini', 'bogus']));
    expect(readEnabledProviders()).toEqual(['gemini']);
  });

  it('falls back to all providers when the stored array is empty', () => {
    window.localStorage.setItem(ENABLED_PROVIDERS_KEY, JSON.stringify([]));
    expect(readEnabledProviders()).toEqual([...TRANSLATION_PROVIDERS]);
  });

  it('falls back to all providers when storage is corrupt', () => {
    window.localStorage.setItem(ENABLED_PROVIDERS_KEY, 'not json');
    expect(readEnabledProviders()).toEqual([...TRANSLATION_PROVIDERS]);
  });
});
