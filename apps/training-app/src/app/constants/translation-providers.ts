import type { TranslationProvider } from '../api/srs.api';

/** Providers offered in the Add/Edit modal, in canonical display order. */
export const TRANSLATION_PROVIDERS = [
  'claude-opus',
  'claude-sonnet',
  'gemini',
  'deepseek',
  'glosbe',
] as const satisfies readonly TranslationProvider[];

/** Human-readable labels for every provider id. */
export const PROVIDER_LABELS: Record<TranslationProvider, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  glosbe: 'Glosbe',
  gemini: 'Gemini',
  'claude-sonnet': 'Claude Sonnet',
  'claude-opus': 'Claude Opus',
};

/** Providers that can produce an explanation (Glosbe cannot). */
export const EXPLANATION_PROVIDERS: TranslationProvider[] = TRANSLATION_PROVIDERS.filter(
  (p) => p !== 'glosbe',
);

/** Default explanation provider (preserves prior hardcoded behavior). */
export const DEFAULT_EXPLANATION_PROVIDER: TranslationProvider = 'gemini';
