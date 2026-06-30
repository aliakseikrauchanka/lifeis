import { z } from 'zod';

const translation = z.object({
  headline: z.string().min(1),
  body: z.string().min(1),
});

export const pickSchema = z.object({
  source_url: z.string().url(),
  source_name: z.string().min(1),
  translations: z.object({ en: translation, pl: translation, ru: translation }),
});

export const picksSchema = z.array(pickSchema);
export type Pick = z.infer<typeof pickSchema>;
