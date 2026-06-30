import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { categories, sources } from '../db/schema';
import { collectCandidates, type Candidate } from './rss';
import { dedupeCandidates } from './dedupe';
import { selectAndTranslate } from './gemini';
import { createEdition, persistStories, finalizeEdition, writeLog, type CategoryPicks } from './persist';
import type { Pick } from './schemas';

type CatRow = { id: string; slug: string; position: number };
type FeedRow = { feedUrl: string; sourceName: string; categoryId: string };

export type GenerateDeps = {
  db: ReturnType<typeof getDb>;
  now: Date;
  loadCategories: () => Promise<CatRow[]>;
  loadSources: (categoryId: string) => Promise<FeedRow[]>;
  collect: (feeds: { feedUrl: string; sourceName: string }[], now: Date) => Promise<{ candidates: Candidate[]; feedsFetched: number }>;
  dedupe: (c: Candidate[]) => Candidate[];
  select: (slug: string, candidates: Candidate[]) => Promise<Pick[]>;
};

export type GenerateResult = {
  editionId: string | null;
  status: 'success' | 'partial' | 'failed';
  storiesCreated: number;
  feedsFetched: number;
  itemsConsidered: number;
  durationMs: number;
  details: Record<string, { stories: number; error?: string }>;
};

function defaultDeps(): GenerateDeps {
  const db = getDb();
  return {
    db,
    now: new Date(),
    loadCategories: async () => {
      const rows = await db.select().from(categories).where(eq(categories.enabled, true));
      return rows.map((c) => ({ id: c.id, slug: c.slug, position: c.position }))
        .sort((a, b) => a.position - b.position);
    },
    loadSources: async (categoryId) => {
      const rows = await db.select().from(sources).where(eq(sources.categoryId, categoryId));
      return rows.filter((s) => s.enabled).map((s) => ({ feedUrl: s.feedUrl, sourceName: s.name, categoryId }));
    },
    collect: collectCandidates,
    dedupe: dedupeCandidates,
    select: (slug, candidates) => selectAndTranslate(slug, candidates),
  };
}

export async function generateEdition(args: {
  trigger: 'cron' | 'manual';
  dryRun?: boolean;
  deps?: Partial<GenerateDeps>;
}): Promise<GenerateResult> {
  const deps = { ...defaultDeps(), ...args.deps } as GenerateDeps;
  const start = Date.now();
  const now = deps.now ?? new Date();
  const dateStr = now.toISOString().slice(0, 10);

  let feedsFetched = 0;
  let itemsConsidered = 0;
  const details: GenerateResult['details'] = {};
  const categoryPicks: CategoryPicks[] = [];

  let editionId: string | null = null;
  if (!args.dryRun) {
    editionId = await createEdition(deps.db, args.trigger, dateStr);
  }

  const cats = await deps.loadCategories();

  await Promise.all(cats.map(async (cat) => {
    try {
      const feeds = await deps.loadSources(cat.id);
      const { candidates, feedsFetched: ff } = await deps.collect(feeds, now);
      feedsFetched += ff;
      const deduped = deps.dedupe(candidates);
      itemsConsidered += deduped.length;
      const picks = await deps.select(cat.slug, deduped);
      categoryPicks.push({ categoryId: cat.id, picks });
      details[cat.slug] = { stories: picks.length };
    } catch (e) {
      details[cat.slug] = { stories: 0, error: e instanceof Error ? e.message : String(e) };
    }
  }));

  const filledCategories = cats.filter(
    (c) => !details[c.slug]?.error && (details[c.slug]?.stories ?? 0) > 0,
  ).length;
  let status: GenerateResult['status'];
  if (filledCategories === cats.length && cats.length > 0) status = 'success';
  else if (filledCategories === 0) status = 'failed';
  else status = 'partial';

  let storiesCreated = categoryPicks.reduce((n, cp) => n + cp.picks.length, 0);

  if (!args.dryRun && editionId) {
    storiesCreated = await persistStories(deps.db, editionId, categoryPicks);
    const editionStatus = status === 'success' ? 'published' : status;
    await finalizeEdition(deps.db, editionId, editionStatus, status === 'success' ? now : null);
    await writeLog(deps.db, {
      trigger: args.trigger, status, editionId,
      feedsFetched, itemsConsidered, storiesCreated,
      durationMs: Date.now() - start, details,
    });
  }

  return {
    editionId, status, storiesCreated, feedsFetched, itemsConsidered,
    durationMs: Date.now() - start, details,
  };
}
