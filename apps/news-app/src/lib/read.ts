import { desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client';
import { editions, stories, storyTranslations, categories } from '../db/schema';

type Lang = 'en' | 'pl' | 'ru';
type Trans = { headline: string; body: string };
export type EditionPayload = {
  editionDate: string;
  publishedAt: string | null;
  categories: {
    slug: string;
    labels: Record<Lang, string>;
    stories: { sourceName: string; sourceUrl: string; translations: Record<Lang, Trans> }[];
  }[];
} | null;

type RowBundle = {
  edition: { editionDate: string; publishedAt: string | null };
  categories: { id: string; slug: string; position: number; enabled: boolean; labels: Record<Lang, string> }[];
  stories: { id: string; categoryId: string; position: number; sourceName: string; sourceUrl: string }[];
  translations: { storyId: string; lang: Lang; headline: string; body: string }[];
};

export function assembleEdition(rows: RowBundle | null): EditionPayload {
  if (!rows) return null;
  const transByStory = new Map<string, Record<Lang, Trans>>();
  for (const t of rows.translations) {
    const m = transByStory.get(t.storyId) ?? ({} as Record<Lang, Trans>);
    m[t.lang] = { headline: t.headline, body: t.body };
    transByStory.set(t.storyId, m);
  }
  const cats = rows.categories
    .filter((c) => c.enabled)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      slug: c.slug,
      labels: c.labels,
      stories: rows.stories
        .filter((s) => s.categoryId === c.id)
        .sort((a, b) => a.position - b.position)
        .map((s) => ({
          sourceName: s.sourceName,
          sourceUrl: s.sourceUrl,
          translations: transByStory.get(s.id) as Record<Lang, Trans>,
        })),
    }));
  return { editionDate: rows.edition.editionDate, publishedAt: rows.edition.publishedAt, categories: cats };
}

export async function getLatestPublishedEdition(db = getDb()): Promise<EditionPayload> {
  const [edition] = await db.select().from(editions)
    .where(eq(editions.status, 'published'))
    .orderBy(desc(editions.publishedAt))
    .limit(1);
  if (!edition) return null;

  const cats = await db.select().from(categories);
  const storyRows = await db.select().from(stories).where(eq(stories.editionId, edition.id));
  const storyIds = storyRows.map((s) => s.id);
  const transRows = storyIds.length
    ? await db.select().from(storyTranslations).where(inArray(storyTranslations.storyId, storyIds))
    : [];

  return assembleEdition({
    edition: {
      editionDate: edition.editionDate,
      publishedAt: edition.publishedAt ? edition.publishedAt.toISOString() : null,
    },
    categories: cats.map((c) => ({ id: c.id, slug: c.slug, position: c.position, enabled: c.enabled, labels: c.labels as Record<Lang, string> })),
    stories: storyRows.map((s) => ({ id: s.id, categoryId: s.categoryId, position: s.position, sourceName: s.sourceName, sourceUrl: s.sourceUrl })),
    translations: transRows.map((t) => ({ storyId: t.storyId, lang: t.lang as Lang, headline: t.headline, body: t.body })),
  });
}
