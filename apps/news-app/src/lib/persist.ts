import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { editions, stories, storyTranslations, generationLogs } from '../db/schema';
import type { Pick } from './schemas';

type Db = ReturnType<typeof getDb>;
export type CategoryPicks = { categoryId: string; picks: Pick[] };

export async function createEdition(db: Db, trigger: string, dateStr: string): Promise<string> {
  const [row] = await db.insert(editions)
    .values({ editionDate: dateStr, status: 'draft', trigger })
    .returning({ id: editions.id });
  return row.id;
}

export async function persistStories(
  db: Db, editionId: string, categoryPicks: CategoryPicks[],
): Promise<number> {
  let count = 0;
  for (const { categoryId, picks } of categoryPicks) {
    for (let i = 0; i < picks.length; i++) {
      const p = picks[i];
      const [story] = await db.insert(stories).values({
        editionId, categoryId, position: i + 1,
        sourceName: p.source_name, sourceUrl: p.source_url,
      }).returning({ id: stories.id });
      for (const lang of ['en', 'pl', 'ru'] as const) {
        await db.insert(storyTranslations).values({
          storyId: story.id, lang,
          headline: p.translations[lang].headline,
          body: p.translations[lang].body,
        });
      }
      count++;
    }
  }
  return count;
}

export async function finalizeEdition(
  db: Db, editionId: string, status: string, publishedAt: Date | null,
): Promise<void> {
  await db.update(editions).set({ status, publishedAt }).where(eq(editions.id, editionId));
}

export async function writeLog(db: Db, row: {
  trigger: string; status: string; editionId: string | null;
  feedsFetched: number; itemsConsidered: number; storiesCreated: number;
  durationMs: number; error?: string | null; details?: unknown;
}): Promise<void> {
  await db.insert(generationLogs).values({
    trigger: row.trigger, status: row.status, editionId: row.editionId ?? undefined,
    feedsFetched: row.feedsFetched, itemsConsidered: row.itemsConsidered,
    storiesCreated: row.storiesCreated, durationMs: row.durationMs,
    error: row.error ?? undefined, details: row.details ?? undefined,
  });
}
