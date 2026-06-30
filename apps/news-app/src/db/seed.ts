import 'dotenv/config';
import { getDb } from './client';
import { categories, sources } from './schema';
import { CATEGORY_SEED, SOURCE_SEED } from './seed-data';
import { eq } from 'drizzle-orm';

export async function seed(db = getDb()) {
  for (const c of CATEGORY_SEED) {
    await db.insert(categories)
      .values({ slug: c.slug, position: c.position, labels: c.labels })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { position: c.position, labels: c.labels },
      });
  }
  const cats = await db.select().from(categories);
  const bySlug = new Map(cats.map((c) => [c.slug, c.id]));

  for (const s of SOURCE_SEED) {
    const categoryId = bySlug.get(s.categorySlug)!;
    const existing = await db.select().from(sources)
      .where(eq(sources.feedUrl, s.feedUrl));
    if (existing.length === 0) {
      await db.insert(sources).values({ categoryId, name: s.name, feedUrl: s.feedUrl });
    }
  }
}

// Allow `tsx src/db/seed.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  seed().then(() => { console.log('seed complete'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
