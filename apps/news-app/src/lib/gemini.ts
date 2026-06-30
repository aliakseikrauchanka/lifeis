import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Candidate } from './rss';
import { picksSchema, type Pick } from './schemas';

export type GenerateFn = (prompt: string) => Promise<string>;

/** Target number of stories selected per category. */
export const STORIES_PER_CATEGORY = 5;

export function buildPrompt(categorySlug: string, candidates: Candidate[]): string {
  const list = candidates
    .map((c, i) => `${i + 1}. [${c.sourceName}] ${c.title}\n   url: ${c.link}\n   summary: ${c.summary}`)
    .join('\n');
  return `You are editing a neutral daily news digest (category: ${categorySlug}).
Pick the ${STORIES_PER_CATEGORY} MOST SIGNIFICANT stories from the candidates below — not the most sensational.
If fewer than ${STORIES_PER_CATEGORY} candidates are provided, pick all of them.
Rewrite each in a NEUTRAL, FACTUAL tone: no opinion, no editorializing, no clickbait.
Use ONLY facts present in the provided candidate items. Do not invent details.
The source_url MUST be copied exactly from one of the candidates below.
Provide each story in English (en), Polish (pl) and Russian (ru). Body ≈ 2 short paragraphs.

Return STRICT JSON only (no markdown), an array of up to ${STORIES_PER_CATEGORY} objects:
[{ "source_url": "...", "source_name": "...", "translations": { "en": {"headline":"...","body":"..."}, "pl": {...}, "ru": {...} } }]

Candidates:
${list}`;
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

export function validatePicks(raw: unknown, candidates: Candidate[]): Pick[] {
  const picks = picksSchema.parse(raw);
  if (picks.length < 1 || picks.length > STORIES_PER_CATEGORY) {
    throw new Error(`expected 1..${STORIES_PER_CATEGORY} picks, got ${picks.length}`);
  }
  const allowed = new Set(candidates.map((c) => c.link));
  for (const p of picks) {
    if (!allowed.has(p.source_url)) {
      throw new Error(`hallucinated source_url not among candidates: ${p.source_url}`);
    }
  }
  return picks;
}

const defaultGenerate: GenerateFn = async (prompt) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const genai = new GoogleGenerativeAI(key);
  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const res = await model.generateContent(prompt);
  return res.response.text();
};

export async function selectAndTranslate(
  categorySlug: string,
  candidates: Candidate[],
  opts: { generate?: GenerateFn } = {},
): Promise<Pick[]> {
  const generate = opts.generate ?? defaultGenerate;
  const prompt = buildPrompt(categorySlug, candidates);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await generate(prompt);
      return validatePicks(extractJson(text), candidates);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
