export const AI_PROVIDER_OPTIONS = [
  { value: 'gemini-2.5-flash-lite', label: 'Gemini Flash 2.5 Lite' },
  { value: 'gemini-2.5-flash', label: 'Gemini Flash 2.5' },
  { value: 'gemini-3-pro-preview', label: 'Gemini Pro 3.0' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek-r1', label: 'Deepseek R1' },
  { value: 'glosbe', label: 'Glosbe' },
] as const;

export const PROVIDER_ORDER: string[] = AI_PROVIDER_OPTIONS.map((opt) => opt.value);
