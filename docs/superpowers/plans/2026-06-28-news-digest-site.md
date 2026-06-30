# News Digest Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal infopiguła-style news digest site (`apps/news-app`): 3 tabs × 3 stories × 3 languages, one edition generated per day from curated RSS feeds, summarized/translated by Gemini, served as a fast near-static page.

**Architecture:** A single self-contained **Astro** project living in the Nx monorepo at `apps/news-app`, integrated into Nx through `nx:run-commands` targets (there is no `@nx/astro` plugin). It holds both the public reading page and the API routes (`src/pages/api/...`). Data lives in **Postgres** (Neon in prod, Docker Postgres locally) accessed via **Drizzle ORM**. A single `generateEdition()` function — called by both Vercel Cron and a local `tsx` script — fetches RSS, selects/rewrites 3 stories per category with Gemini, validates with Zod, and persists an edition with a generation log.

**Tech Stack:** Astro (Node/Vercel adapter), TypeScript (ESM), Drizzle ORM + `drizzle-kit`, `postgres` (postgres.js) driver, `rss-parser`, `@google/generative-ai` (existing dep), `zod` v4 (existing dep), Vitest (existing dep) for tests, `tsx` for the generate script.

## Global Constraints

- **Monorepo:** Nx 22.3.3. New app at `apps/news-app` with `apps/news-app/project.json`. Integrate via `nx:run-commands` targets; do not attempt an Astro Nx plugin (none installed).
- **Module system:** ESM only (Astro requirement). `apps/news-app/package.json` MUST have `"type": "module"`.
- **Node:** `>=22.12.0` (matches root `engines`).
- **Categories (fixed slugs):** `'poland' | 'world' | 'positive'`. Tab order via `position`.
- **Languages (fixed codes):** `'en' | 'pl' | 'ru'`. Default language resolution order: URL `?lang=` → `localStorage` → browser `Accept-Language` → `pl`.
- **Stories:** exactly 3 per enabled category, `position` 1..3.
- **Tone (Gemini prompt, verbatim intent):** neutral, fact-based, no opinion, no clickbait; use only facts present in provided candidate items; `source_url` MUST be copied from a candidate.
- **Cron:** `POST /api/cron/generate`, schedule `0 0 * * *` (00:00 UTC), guarded by a `CRON_SECRET` header. Local generation uses `npm run generate` (no cron).
- **LLM model:** Gemini Flash — use model id `gemini-2.5-flash`.
- **Read contract:** `GET /api/edition/latest` returns the latest `status='published'` edition only; enabled categories only; ordered by `category.position` then `story.position`; all three languages embedded.
- **Failure behavior:** a run that fails or yields fewer than expected stories marks the edition `partial`/`failed`; the public page keeps serving the last `published` edition. Readers never see a broken/empty page.
- **Secrets:** never read `.env`. Document env in a committed `.env.example`. Required: `DATABASE_URL`, `GEMINI_API_KEY`, `CRON_SECRET`.
- **Commits:** Conventional Commits. No `Co-Authored-By` trailer (user preference).

## File Structure

```
apps/news-app/
  package.json                 # "type":"module"; app-local deps optional (root holds them)
  project.json                 # Nx run-commands targets
  astro.config.mjs             # Astro + Vercel adapter, server output
  tsconfig.json                # extends root base
  vitest.config.ts             # unit tests
  drizzle.config.ts            # drizzle-kit config (schema + out + dialect)
  .env.example                 # DATABASE_URL, GEMINI_API_KEY, CRON_SECRET
  vercel.json                  # crons config
  src/
    db/
      schema.ts                # 6 Drizzle tables
      client.ts               # postgres.js + drizzle instance (lazy, from DATABASE_URL)
      seed-data.ts            # default categories + sources (the seed source of truth)
      seed.ts                 # idempotent seed runner
    lib/
      rss.ts                  # fetchFeed + normalizeItems + collectCandidates
      dedupe.ts               # dedupeCandidates (URL + fuzzy title)
      gemini.ts               # selectAndTranslate(candidates) -> validated picks
      schemas.ts              # Zod schemas for Gemini output + types
      generate.ts             # generateEdition({trigger}) orchestration
      persist.ts              # writeEdition(...) DB persistence
      read.ts                 # getLatestPublishedEdition() read-model
      logs.ts                 # recentLogs() helper
    pages/
      index.astro             # public reading page (server load + embedded JSON)
      api/
        edition/latest.ts     # GET read API
        cron/generate.ts      # POST cron (CRON_SECRET guarded)
        admin/logs.ts         # GET recent generation_logs (CRON_SECRET guarded)
    components/
      Digest.tsx (or .astro island script)  # tab + language client switching
  scripts/
    generate.ts               # CLI: runs generateEdition; supports --dry-run
    logs.ts                   # CLI: prints recent generation_logs
  test/
    rss.test.ts
    dedupe.test.ts
    gemini.test.ts
    generate.test.ts
    read.test.ts
    fixtures/
      reuters.xml             # sample RSS for tests
```

Root-level changes:
- `package.json`: add deps (`astro`, `@astrojs/vercel`, `@astrojs/node`, `drizzle-orm`, `drizzle-kit`, `postgres`, `rss-parser`, `tsx`) and scripts (`db:up`, `db:migrate`, `db:seed`, `generate`, `news:logs`).
- `docker-compose.yml`: add `news-db` Postgres service + volume.
- `docker-compose.base.yml`: unchanged (news-db is self-contained).

---

## Phase 1 — Scaffolding & Data Model (checkpoint: `npm run db:migrate && npm run db:seed` succeeds against local Postgres)

### Task 1: Scaffold the Astro app and wire it into Nx

**Files:**
- Create: `apps/news-app/package.json`
- Create: `apps/news-app/astro.config.mjs`
- Create: `apps/news-app/tsconfig.json`
- Create: `apps/news-app/project.json`
- Create: `apps/news-app/src/pages/index.astro` (placeholder)
- Create: `apps/news-app/.env.example`
- Modify: root `package.json` (dependencies + scripts)

**Interfaces:**
- Produces: Nx targets `news-app:serve`, `news-app:build`; root scripts `db:up`, `db:migrate`, `db:seed`, `generate`, `news:logs` (wired in later tasks but declared here).

- [ ] **Step 1: Add dependencies to root `package.json`**

Add to `dependencies`:
```json
"astro": "^5.0.0",
"@astrojs/vercel": "^8.0.0",
"@astrojs/node": "^9.0.0",
"drizzle-orm": "^0.36.0",
"postgres": "^3.4.5",
"rss-parser": "^3.13.0"
```
Add to `devDependencies`:
```json
"drizzle-kit": "^0.28.0",
"tsx": "^4.19.0"
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes; `node -e "require.resolve('astro')"` succeeds.

- [ ] **Step 3: Create `apps/news-app/package.json`**

```json
{
  "name": "@lifeis/news-app",
  "version": "0.0.0",
  "type": "module",
  "private": true
}
```

- [ ] **Step 4: Create `apps/news-app/astro.config.mjs`**

```js
import { defineConfig } from 'astro';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  server: { port: 4205 },
});
```

- [ ] **Step 5: Create `apps/news-app/tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "types": ["astro/client"],
    "strictNullChecks": true
  },
  "include": ["src", "scripts", "test", "drizzle.config.ts", "astro.config.mjs"]
}
```

- [ ] **Step 6: Create placeholder `apps/news-app/src/pages/index.astro`**

```astro
---
const title = 'News Digest';
---
<html lang="en">
  <head><meta charset="utf-8" /><title>{title}</title></head>
  <body><main><h1>{title}</h1><p>Coming soon.</p></main></body>
</html>
```

- [ ] **Step 7: Create `apps/news-app/.env.example`**

```
# Postgres connection (Neon in prod, local Docker in dev)
DATABASE_URL=postgres://news:news@localhost:5433/news
# Google Gemini API key
GEMINI_API_KEY=
# Shared secret guarding the cron + admin endpoints
CRON_SECRET=
```

- [ ] **Step 8: Create `apps/news-app/project.json`**

```json
{
  "name": "news-app",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/news-app/src",
  "projectType": "application",
  "tags": [],
  "targets": {
    "serve": {
      "executor": "nx:run-commands",
      "options": { "command": "astro dev", "cwd": "apps/news-app" }
    },
    "build": {
      "executor": "nx:run-commands",
      "outputs": ["{projectRoot}/dist"],
      "options": { "command": "astro build", "cwd": "apps/news-app" }
    },
    "generate": {
      "executor": "nx:run-commands",
      "options": { "command": "tsx scripts/generate.ts", "cwd": "apps/news-app" }
    },
    "db:migrate": {
      "executor": "nx:run-commands",
      "options": { "command": "drizzle-kit migrate", "cwd": "apps/news-app" }
    },
    "db:generate": {
      "executor": "nx:run-commands",
      "options": { "command": "drizzle-kit generate", "cwd": "apps/news-app" }
    },
    "db:seed": {
      "executor": "nx:run-commands",
      "options": { "command": "tsx src/db/seed.ts", "cwd": "apps/news-app" }
    },
    "logs": {
      "executor": "nx:run-commands",
      "options": { "command": "tsx scripts/logs.ts", "cwd": "apps/news-app" }
    },
    "test": {
      "executor": "nx:run-commands",
      "options": { "command": "vitest run", "cwd": "apps/news-app" }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"]
    }
  }
}
```

- [ ] **Step 9: Add root `package.json` scripts**

```json
"db:up": "docker-compose up -d news-db",
"db:migrate": "npx nx run news-app:db:migrate",
"db:seed": "npx nx run news-app:db:seed",
"generate": "npx nx run news-app:generate",
"news:logs": "npx nx run news-app:logs"
```

- [ ] **Step 10: Verify Astro builds and Nx sees the project**

Run: `npx nx show project news-app --json | head -c 200`
Expected: JSON describing the project with the `serve`/`build` targets.
Run: `cd apps/news-app && npx astro build`
Expected: build succeeds (placeholder page compiles). Return to repo root afterward.

- [ ] **Step 11: Commit**

```bash
git add apps/news-app package.json package-lock.json
git commit -m "feat(news-app): scaffold Astro app and wire Nx targets"
```

---

### Task 2: Local Postgres via docker-compose + Drizzle config

**Files:**
- Modify: `docker-compose.yml` (add `news-db` service + volume)
- Create: `apps/news-app/drizzle.config.ts`

**Interfaces:**
- Produces: a reachable Postgres at `localhost:5433` (db/user/pass `news`); `drizzle-kit` configured to read `src/db/schema.ts` and emit migrations to `drizzle/`.

- [ ] **Step 1: Add `news-db` service to `docker-compose.yml`**

Under `services:` add:
```yaml
  news-db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_USER=news
      - POSTGRES_PASSWORD=news
      - POSTGRES_DB=news
    ports:
      - '5433:5432'
    volumes:
      - news-db-data:/var/lib/postgresql/data
```
And under the existing `volumes:` block add:
```yaml
  news-db-data: null
```

- [ ] **Step 2: Create `apps/news-app/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://news:news@localhost:5433/news',
  },
});
```

- [ ] **Step 3: Start the DB and verify connectivity**

Run: `docker-compose up -d news-db`
Run: `docker-compose exec news-db pg_isready -U news`
Expected: `accepting connections`.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml apps/news-app/drizzle.config.ts
git commit -m "feat(news-app): add local Postgres service and drizzle config"
```

---

### Task 3: Drizzle schema (6 tables)

**Files:**
- Create: `apps/news-app/src/db/schema.ts`
- Create: `apps/news-app/src/db/client.ts`

**Interfaces:**
- Produces: table objects `categories, editions, stories, storyTranslations, generationLogs, sources`; `getDb()` returning a Drizzle client; types `Category`, `Edition`, `Story`, `StoryTranslation`, `GenerationLog`, `Source` (inferred via `$inferSelect`).

- [ ] **Step 1: Write `apps/news-app/src/db/schema.ts`**

```ts
import {
  pgTable, uuid, text, smallint, boolean, timestamp, integer, jsonb, date, unique,
} from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  position: smallint('position').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  labels: jsonb('labels').$type<{ en: string; pl: string; ru: string }>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const editions = pgTable('editions', {
  id: uuid('id').defaultRandom().primaryKey(),
  editionDate: date('edition_date').notNull(),
  status: text('status').notNull(), // 'draft' | 'published' | 'partial' | 'failed'
  trigger: text('trigger').notNull(), // 'cron' | 'manual'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
});

export const stories = pgTable('stories', {
  id: uuid('id').defaultRandom().primaryKey(),
  editionId: uuid('edition_id').notNull().references(() => editions.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  position: smallint('position').notNull(),
  sourceName: text('source_name').notNull(),
  sourceUrl: text('source_url').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (t) => ({
  uq: unique().on(t.editionId, t.categoryId, t.position),
}));

export const storyTranslations = pgTable('story_translations', {
  id: uuid('id').defaultRandom().primaryKey(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  lang: text('lang').notNull(), // 'en' | 'pl' | 'ru'
  headline: text('headline').notNull(),
  body: text('body').notNull(),
}, (t) => ({
  uq: unique().on(t.storyId, t.lang),
}));

export const generationLogs = pgTable('generation_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
  trigger: text('trigger').notNull(),
  status: text('status').notNull(), // 'success' | 'partial' | 'failed'
  editionId: uuid('edition_id').references(() => editions.id),
  feedsFetched: integer('feeds_fetched').notNull().default(0),
  itemsConsidered: integer('items_considered').notNull().default(0),
  storiesCreated: integer('stories_created').notNull().default(0),
  durationMs: integer('duration_ms').notNull().default(0),
  error: text('error'),
  details: jsonb('details'),
});

export const sources = pgTable('sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  name: text('name').notNull(),
  feedUrl: text('feed_url').notNull(),
  enabled: boolean('enabled').notNull().default(true),
});

export type Category = typeof categories.$inferSelect;
export type Edition = typeof editions.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type StoryTranslation = typeof storyTranslations.$inferSelect;
export type GenerationLog = typeof generationLogs.$inferSelect;
export type Source = typeof sources.$inferSelect;
```

- [ ] **Step 2: Write `apps/news-app/src/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not set');
  if (!_db) {
    const sql = postgres(url, { max: 1 });
    _db = drizzle(sql, { schema });
  }
  return _db;
}

export { schema };
```

- [ ] **Step 3: Generate the migration**

Run: `cd apps/news-app && npx drizzle-kit generate`
Expected: a SQL file appears under `apps/news-app/drizzle/`.

- [ ] **Step 4: Apply the migration**

Run (repo root): `DATABASE_URL=postgres://news:news@localhost:5433/news npx nx run news-app:db:migrate`
Expected: migration applies with no error.
Verify: `docker-compose exec news-db psql -U news -d news -c '\dt'` lists the 6 tables.

- [ ] **Step 5: Commit**

```bash
git add apps/news-app/src/db apps/news-app/drizzle
git commit -m "feat(news-app): drizzle schema and db client"
```

---

### Task 4: Seed data (categories + default sources), idempotent

**Files:**
- Create: `apps/news-app/src/db/seed-data.ts`
- Create: `apps/news-app/src/db/seed.ts`
- Test: `apps/news-app/test/seed.test.ts` (pure shape test on seed-data)

**Interfaces:**
- Consumes: `categories`, `sources` from `schema.ts`; `getDb()` from `client.ts`.
- Produces: `CATEGORY_SEED` (array with `slug`, `position`, `labels`), `SOURCE_SEED` (array with `categorySlug`, `name`, `feedUrl`); `seed()` async function (idempotent: upsert by unique key).

- [ ] **Step 1: Write the failing test `apps/news-app/test/seed.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { CATEGORY_SEED, SOURCE_SEED } from '../src/db/seed-data';

describe('seed data', () => {
  it('defines exactly the three categories with unique positions', () => {
    expect(CATEGORY_SEED.map((c) => c.slug).sort()).toEqual(['poland', 'positive', 'world']);
    const positions = CATEGORY_SEED.map((c) => c.position);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('every category has en/pl/ru labels', () => {
    for (const c of CATEGORY_SEED) {
      expect(Object.keys(c.labels).sort()).toEqual(['en', 'pl', 'ru']);
    }
  });

  it('every source references a known category and has a feed url', () => {
    const slugs = new Set(CATEGORY_SEED.map((c) => c.slug));
    for (const s of SOURCE_SEED) {
      expect(slugs.has(s.categorySlug)).toBe(true);
      expect(s.feedUrl).toMatch(/^https?:\/\//);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/news-app && npx vitest run test/seed.test.ts`
Expected: FAIL — cannot find module `../src/db/seed-data`.

- [ ] **Step 3: Write `apps/news-app/src/db/seed-data.ts`**

```ts
export const CATEGORY_SEED = [
  { slug: 'poland', position: 1, labels: { en: 'Poland', pl: 'Polska', ru: 'Польша' } },
  { slug: 'world', position: 2, labels: { en: 'World', pl: 'Świat', ru: 'Мир' } },
  { slug: 'positive', position: 3, labels: { en: 'Positive', pl: 'Pozytywne', ru: 'Позитив' } },
] as const;

export const SOURCE_SEED = [
  // Poland
  { categorySlug: 'poland', name: 'PAP', feedUrl: 'https://www.pap.pl/rss.xml' },
  { categorySlug: 'poland', name: 'Polskie Radio', feedUrl: 'https://polskieradio24.pl/rss' },
  { categorySlug: 'poland', name: 'Notes from Poland', feedUrl: 'https://notesfrompoland.com/feed/' },
  // World
  { categorySlug: 'world', name: 'Reuters', feedUrl: 'https://feeds.reuters.com/reuters/worldNews' },
  { categorySlug: 'world', name: 'Associated Press', feedUrl: 'https://feedx.net/rss/ap.xml' },
  { categorySlug: 'world', name: 'BBC News', feedUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { categorySlug: 'world', name: 'Al Jazeera', feedUrl: 'https://www.aljazeera.com/xml/rss/all.xml' },
  // Positive
  { categorySlug: 'positive', name: 'Good News Network', feedUrl: 'https://www.goodnewsnetwork.org/feed/' },
  { categorySlug: 'positive', name: 'Positive News', feedUrl: 'https://www.positive.news/feed/' },
] as const;
```

> Note: feed URLs are best-effort starters and editable in the DB anytime; per-feed failures are tolerated by the pipeline (Task 8).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/news-app && npx vitest run test/seed.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the idempotent seed runner `apps/news-app/src/db/seed.ts`**

```ts
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
```

- [ ] **Step 6: Run the seed against local DB and verify**

Run (repo root): `DATABASE_URL=postgres://news:news@localhost:5433/news npx nx run news-app:db:seed`
Expected: prints `seed complete`.
Verify: `docker-compose exec news-db psql -U news -d news -c 'select slug from categories order by position;'` → poland, world, positive.
Run the seed a second time — expect no duplicate rows in `sources` (idempotent).

- [ ] **Step 7: Commit**

```bash
git add apps/news-app/src/db/seed-data.ts apps/news-app/src/db/seed.ts apps/news-app/test/seed.test.ts
git commit -m "feat(news-app): seed categories and default sources"
```

---

## Phase 2 — Generation pipeline (checkpoint: `npm run generate -- --dry-run` prints 3 picks per category; full run publishes an edition)

### Task 5: RSS fetch + normalize + collect candidates

**Files:**
- Create: `apps/news-app/src/lib/rss.ts`
- Test: `apps/news-app/test/rss.test.ts`
- Create fixture: `apps/news-app/test/fixtures/reuters.xml`

**Interfaces:**
- Produces:
  - type `Candidate = { title: string; summary: string; link: string; sourceName: string; publishedAt: Date | null }`
  - `normalizeItems(items, sourceName): Candidate[]` (pure; maps rss-parser items)
  - `withinWindow(c: Candidate, now: Date, hours = 36): boolean`
  - `fetchFeed(feedUrl: string, sourceName: string, timeoutMs = 8000): Promise<Candidate[]>` (network; on error returns `[]`)
  - `collectCandidates(feeds: {feedUrl:string;sourceName:string}[], now: Date): Promise<{candidates: Candidate[]; feedsFetched: number}>`

- [ ] **Step 1: Add fixture `apps/news-app/test/fixtures/reuters.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Reuters World</title>
  <item>
    <title>Sample headline one</title>
    <description>First summary text.</description>
    <link>https://reuters.com/world/article-one</link>
    <pubDate>Sat, 28 Jun 2026 09:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Sample headline two</title>
    <description>Second summary text.</description>
    <link>https://reuters.com/world/article-two</link>
    <pubDate>Sat, 28 Jun 2026 10:00:00 GMT</pubDate>
  </item>
</channel></rss>
```

- [ ] **Step 2: Write failing test `apps/news-app/test/rss.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import Parser from 'rss-parser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeItems, withinWindow } from '../src/lib/rss';

const xml = readFileSync(join(__dirname, 'fixtures/reuters.xml'), 'utf-8');

describe('rss normalize', () => {
  it('maps rss items to candidates', async () => {
    const parsed = await new Parser().parseString(xml);
    const cands = normalizeItems(parsed.items, 'Reuters');
    expect(cands).toHaveLength(2);
    expect(cands[0]).toMatchObject({
      title: 'Sample headline one',
      link: 'https://reuters.com/world/article-one',
      sourceName: 'Reuters',
    });
    expect(cands[0].publishedAt instanceof Date).toBe(true);
  });

  it('withinWindow filters by recency', () => {
    const now = new Date('2026-06-28T12:00:00Z');
    const fresh = { title: 't', summary: 's', link: 'l', sourceName: 'r', publishedAt: new Date('2026-06-28T09:00:00Z') };
    const stale = { ...fresh, publishedAt: new Date('2026-06-25T09:00:00Z') };
    expect(withinWindow(fresh, now, 36)).toBe(true);
    expect(withinWindow(stale, now, 36)).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/news-app && npx vitest run test/rss.test.ts`
Expected: FAIL — cannot find `../src/lib/rss`.

- [ ] **Step 4: Implement `apps/news-app/src/lib/rss.ts`**

```ts
import Parser from 'rss-parser';

export type Candidate = {
  title: string;
  summary: string;
  link: string;
  sourceName: string;
  publishedAt: Date | null;
};

const parser = new Parser();

export function normalizeItems(items: any[], sourceName: string): Candidate[] {
  return (items ?? [])
    .map((it) => ({
      title: (it.title ?? '').trim(),
      summary: (it.contentSnippet ?? it.content ?? it.summary ?? '').toString().trim(),
      link: (it.link ?? '').trim(),
      sourceName,
      publishedAt: it.isoDate ? new Date(it.isoDate) : (it.pubDate ? new Date(it.pubDate) : null),
    }))
    .filter((c) => c.title && c.link);
}

export function withinWindow(c: Candidate, now: Date, hours = 36): boolean {
  if (!c.publishedAt) return false;
  const ageMs = now.getTime() - c.publishedAt.getTime();
  return ageMs >= 0 && ageMs <= hours * 3600 * 1000;
}

export async function fetchFeed(feedUrl: string, sourceName: string, timeoutMs = 8000): Promise<Candidate[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(feedUrl, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return [];
    const text = await res.text();
    const parsed = await parser.parseString(text);
    return normalizeItems(parsed.items, sourceName);
  } catch {
    return [];
  }
}

export async function collectCandidates(
  feeds: { feedUrl: string; sourceName: string }[],
  now: Date,
): Promise<{ candidates: Candidate[]; feedsFetched: number }> {
  const results = await Promise.all(
    feeds.map(async (f) => {
      const items = await fetchFeed(f.feedUrl, f.sourceName);
      return { ok: items.length > 0, items };
    }),
  );
  const candidates = results
    .flatMap((r) => r.items)
    .filter((c) => withinWindow(c, now));
  const feedsFetched = results.filter((r) => r.ok).length;
  return { candidates, feedsFetched };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd apps/news-app && npx vitest run test/rss.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/news-app/src/lib/rss.ts apps/news-app/test/rss.test.ts apps/news-app/test/fixtures/reuters.xml
git commit -m "feat(news-app): rss fetch and normalization"
```

---

### Task 6: Dedupe candidates (URL + fuzzy title)

**Files:**
- Create: `apps/news-app/src/lib/dedupe.ts`
- Test: `apps/news-app/test/dedupe.test.ts`

**Interfaces:**
- Consumes: `Candidate` from `rss.ts`.
- Produces: `dedupeCandidates(candidates: Candidate[]): Candidate[]` (removes exact-URL dupes and near-identical titles; keeps earliest-seen).

- [ ] **Step 1: Write failing test `apps/news-app/test/dedupe.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { dedupeCandidates } from '../src/lib/dedupe';
import type { Candidate } from '../src/lib/rss';

const c = (over: Partial<Candidate>): Candidate => ({
  title: 't', summary: 's', link: 'https://a.com/1', sourceName: 'X', publishedAt: null, ...over,
});

describe('dedupeCandidates', () => {
  it('removes exact duplicate URLs', () => {
    const out = dedupeCandidates([c({ link: 'https://a.com/1' }), c({ link: 'https://a.com/1' })]);
    expect(out).toHaveLength(1);
  });

  it('removes near-identical titles from different sources', () => {
    const out = dedupeCandidates([
      c({ link: 'https://a.com/1', title: 'Poland signs new trade deal' }),
      c({ link: 'https://b.com/2', title: 'Poland Signs New Trade Deal!' }),
    ]);
    expect(out).toHaveLength(1);
  });

  it('keeps distinct stories', () => {
    const out = dedupeCandidates([
      c({ link: 'https://a.com/1', title: 'Election results announced' }),
      c({ link: 'https://b.com/2', title: 'Weather forecast for the week' }),
    ]);
    expect(out).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/news-app && npx vitest run test/dedupe.test.ts`
Expected: FAIL — cannot find `../src/lib/dedupe`.

- [ ] **Step 3: Implement `apps/news-app/src/lib/dedupe.ts`**

```ts
import type { Candidate } from './rss';

function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// token Jaccard similarity
function similar(a: string, b: string): number {
  const sa = new Set(normTitle(a).split(' ').filter(Boolean));
  const sb = new Set(normTitle(b).split(' ').filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const seenUrls = new Set<string>();
  const kept: Candidate[] = [];
  for (const c of candidates) {
    if (seenUrls.has(c.link)) continue;
    if (kept.some((k) => similar(k.title, c.title) >= 0.8)) continue;
    seenUrls.add(c.link);
    kept.push(c);
  }
  return kept;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/news-app && npx vitest run test/dedupe.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/news-app/src/lib/dedupe.ts apps/news-app/test/dedupe.test.ts
git commit -m "feat(news-app): candidate deduplication"
```

---

### Task 7: Gemini selection/translation with Zod validation + source_url guard

**Files:**
- Create: `apps/news-app/src/lib/schemas.ts`
- Create: `apps/news-app/src/lib/gemini.ts`
- Test: `apps/news-app/test/gemini.test.ts`

**Interfaces:**
- Consumes: `Candidate` from `rss.ts`.
- Produces:
  - `picksSchema` (Zod): array of `{ source_url, source_name, translations: { en:{headline,body}, pl:{...}, ru:{...} } }`
  - type `Pick = z.infer<typeof picksSchema>[number]`
  - `buildPrompt(categorySlug: string, candidates: Candidate[]): string`
  - `validatePicks(raw: unknown, candidates: Candidate[]): Pick[]` — parses with Zod, enforces exactly 3 picks, and that every `source_url` is one of `candidates[].link` (drops/throws otherwise)
  - `selectAndTranslate(categorySlug, candidates, opts?: { generate?: GenerateFn }): Promise<Pick[]>` where `GenerateFn = (prompt: string) => Promise<string>` (injectable for tests; default calls Gemini). Retries once on invalid JSON.

- [ ] **Step 1: Write failing test `apps/news-app/test/gemini.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { validatePicks, selectAndTranslate, buildPrompt } from '../src/lib/gemini';
import type { Candidate } from '../src/lib/rss';

const cands: Candidate[] = [
  { title: 'A', summary: 'sa', link: 'https://x.com/a', sourceName: 'X', publishedAt: null },
  { title: 'B', summary: 'sb', link: 'https://x.com/b', sourceName: 'X', publishedAt: null },
  { title: 'C', summary: 'sc', link: 'https://x.com/c', sourceName: 'X', publishedAt: null },
];

const validPick = (url: string) => ({
  source_url: url, source_name: 'X',
  translations: {
    en: { headline: 'h', body: 'b' },
    pl: { headline: 'h', body: 'b' },
    ru: { headline: 'h', body: 'b' },
  },
});

describe('validatePicks', () => {
  it('accepts 3 valid picks whose urls are candidates', () => {
    const raw = [validPick('https://x.com/a'), validPick('https://x.com/b'), validPick('https://x.com/c')];
    expect(validatePicks(raw, cands)).toHaveLength(3);
  });

  it('rejects a hallucinated source_url', () => {
    const raw = [validPick('https://evil.com/z'), validPick('https://x.com/b'), validPick('https://x.com/c')];
    expect(() => validatePicks(raw, cands)).toThrow();
  });

  it('rejects when not exactly 3 picks', () => {
    expect(() => validatePicks([validPick('https://x.com/a')], cands)).toThrow();
  });
});

describe('selectAndTranslate', () => {
  it('retries once on invalid JSON then succeeds', async () => {
    let calls = 0;
    const generate = async () => {
      calls++;
      if (calls === 1) return 'not json';
      return JSON.stringify([validPick('https://x.com/a'), validPick('https://x.com/b'), validPick('https://x.com/c')]);
    };
    const picks = await selectAndTranslate('world', cands, { generate });
    expect(calls).toBe(2);
    expect(picks).toHaveLength(3);
  });

  it('buildPrompt includes neutral-tone rules and candidate urls', () => {
    const p = buildPrompt('world', cands);
    expect(p).toMatch(/neutral/i);
    expect(p).toContain('https://x.com/a');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/news-app && npx vitest run test/gemini.test.ts`
Expected: FAIL — cannot find `../src/lib/gemini`.

- [ ] **Step 3: Implement `apps/news-app/src/lib/schemas.ts`**

```ts
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
```

- [ ] **Step 4: Implement `apps/news-app/src/lib/gemini.ts`**

```ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Candidate } from './rss';
import { picksSchema, type Pick } from './schemas';

export type GenerateFn = (prompt: string) => Promise<string>;

export function buildPrompt(categorySlug: string, candidates: Candidate[]): string {
  const list = candidates
    .map((c, i) => `${i + 1}. [${c.sourceName}] ${c.title}\n   url: ${c.link}\n   summary: ${c.summary}`)
    .join('\n');
  return `You are editing a neutral daily news digest (category: ${categorySlug}).
Pick the 3 MOST SIGNIFICANT stories from the candidates below — not the most sensational.
Rewrite each in a NEUTRAL, FACTUAL tone: no opinion, no editorializing, no clickbait.
Use ONLY facts present in the provided candidate items. Do not invent details.
The source_url MUST be copied exactly from one of the candidates below.
Provide each story in English (en), Polish (pl) and Russian (ru). Body ≈ 2 short paragraphs.

Return STRICT JSON only (no markdown), an array of exactly 3 objects:
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
  if (picks.length !== 3) throw new Error(`expected 3 picks, got ${picks.length}`);
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
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd apps/news-app && npx vitest run test/gemini.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/news-app/src/lib/schemas.ts apps/news-app/src/lib/gemini.ts apps/news-app/test/gemini.test.ts
git commit -m "feat(news-app): gemini selection/translation with zod validation"
```

---

### Task 8: Persistence layer

**Files:**
- Create: `apps/news-app/src/lib/persist.ts`
- Test: covered indirectly via `generate.test.ts` (Task 9) using a fake db; no separate test here.

**Interfaces:**
- Consumes: `getDb`, `schema`; `Pick` from `schemas.ts`.
- Produces:
  - type `CategoryPicks = { categoryId: string; picks: Pick[] }`
  - `persistStories(db, editionId, categoryPicks: CategoryPicks[]): Promise<number>` — inserts stories + translations, returns count of stories created.
  - `createEdition(db, trigger, dateStr): Promise<string>` — inserts a `draft` edition, returns id.
  - `finalizeEdition(db, editionId, status, publishedAt): Promise<void>`
  - `writeLog(db, row): Promise<void>` — inserts a `generation_logs` row.

- [ ] **Step 1: Implement `apps/news-app/src/lib/persist.ts`**

```ts
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
  await db.update(editions).set({ status, publishedAt }).where(
    (await import('drizzle-orm')).eq(editions.id, editionId),
  );
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
```

> Note: `finalizeEdition` uses `eq`; replace the inline dynamic import with a top-level `import { eq } from 'drizzle-orm';` — kept inline above only to keep the snippet self-contained. Implement it as a top-level import:

```ts
import { eq } from 'drizzle-orm';
// ...
export async function finalizeEdition(db: Db, editionId: string, status: string, publishedAt: Date | null): Promise<void> {
  await db.update(editions).set({ status, publishedAt }).where(eq(editions.id, editionId));
}
```

- [ ] **Step 2: Type-check compiles**

Run: `cd apps/news-app && npx tsc --noEmit`
Expected: no errors in `persist.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/news-app/src/lib/persist.ts
git commit -m "feat(news-app): edition persistence helpers"
```

---

### Task 9: `generateEdition` orchestration + status transitions + logging

**Files:**
- Create: `apps/news-app/src/lib/generate.ts`
- Test: `apps/news-app/test/generate.test.ts`

**Interfaces:**
- Consumes: `collectCandidates` (rss), `dedupeCandidates`, `selectAndTranslate` (gemini), `persist.ts` helpers, `getDb`, schema.
- Produces:
  - type `GenerateResult = { editionId: string | null; status: 'success'|'partial'|'failed'; storiesCreated: number; feedsFetched: number; itemsConsidered: number; durationMs: number; details: Record<string, { stories: number; error?: string }> }`
  - type `GenerateDeps` (all injectable for tests): `{ db, now, collect, dedupe, select }` matching the real signatures.
  - `generateEdition(args: { trigger: 'cron'|'manual'; dryRun?: boolean; deps?: Partial<GenerateDeps> }): Promise<GenerateResult>`

**Status rules:** every enabled category produced 3 valid stories → `published` (set `publishedAt`); some but not all → `partial`; none → `failed`. On `partial`/`failed` the edition is NOT published, so the previous published edition stays live.

- [ ] **Step 1: Write failing test `apps/news-app/test/generate.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { generateEdition } from '../src/lib/generate';
import type { Candidate } from '../src/lib/rss';

// Minimal fake db capturing writes
function fakeDb() {
  const state: any = { editions: [], stories: [], translations: [], logs: [] };
  const cats = [
    { id: 'cat-poland', slug: 'poland', position: 1, enabled: true, labels: {} },
    { id: 'cat-world', slug: 'world', position: 2, enabled: true, labels: {} },
  ];
  const srcs = [
    { id: 's1', categoryId: 'cat-poland', name: 'PAP', feedUrl: 'u1', enabled: true },
    { id: 's2', categoryId: 'cat-world', name: 'Reuters', feedUrl: 'u2', enabled: true },
  ];
  const db: any = {
    _state: state, _cats: cats, _srcs: srcs,
    select: () => ({ from: (tbl: any) => ({
      where: () => Promise.resolve(tbl.__name === 'sources' ? srcs : cats),
      then: (r: any) => Promise.resolve(tbl.__name === 'categories' ? cats : srcs).then(r),
    }) }),
  };
  return db;
}

const cand = (link: string): Candidate => ({ title: link, summary: 's', link, sourceName: 'X', publishedAt: new Date() });
const pick = (url: string) => ({ source_url: url, source_name: 'X', translations: {
  en: { headline: 'h', body: 'b' }, pl: { headline: 'h', body: 'b' }, ru: { headline: 'h', body: 'b' } } });

describe('generateEdition (dry-run via injected deps)', () => {
  it('returns 3 picks per enabled category and status success', async () => {
    const deps = {
      loadCategories: async () => [
        { id: 'cat-poland', slug: 'poland', position: 1 },
        { id: 'cat-world', slug: 'world', position: 2 },
      ],
      loadSources: async (categoryId: string) => [{ feedUrl: 'u', sourceName: 'X', categoryId }],
      collect: async () => ({ candidates: [cand('https://x/a'), cand('https://x/b'), cand('https://x/c')], feedsFetched: 1 }),
      dedupe: (c: Candidate[]) => c,
      select: async () => [pick('https://x/a'), pick('https://x/b'), pick('https://x/c')],
    };
    const res = await generateEdition({ trigger: 'manual', dryRun: true, deps: deps as any });
    expect(res.status).toBe('success');
    expect(res.storiesCreated).toBe(6); // 2 categories x 3
    expect(res.editionId).toBeNull(); // dry-run does not persist
  });

  it('marks partial when one category fails', async () => {
    const deps = {
      loadCategories: async () => [
        { id: 'cat-poland', slug: 'poland', position: 1 },
        { id: 'cat-world', slug: 'world', position: 2 },
      ],
      loadSources: async (categoryId: string) => [{ feedUrl: 'u', sourceName: 'X', categoryId }],
      collect: async () => ({ candidates: [cand('https://x/a'), cand('https://x/b'), cand('https://x/c')], feedsFetched: 1 }),
      dedupe: (c: Candidate[]) => c,
      select: async (slug: string) => {
        if (slug === 'world') throw new Error('gemini failed');
        return [pick('https://x/a'), pick('https://x/b'), pick('https://x/c')];
      },
    };
    const res = await generateEdition({ trigger: 'manual', dryRun: true, deps: deps as any });
    expect(res.status).toBe('partial');
    expect(res.details.world.error).toMatch(/gemini failed/);
  });

  it('marks failed when all categories fail', async () => {
    const deps = {
      loadCategories: async () => [{ id: 'cat-poland', slug: 'poland', position: 1 }],
      loadSources: async (categoryId: string) => [{ feedUrl: 'u', sourceName: 'X', categoryId }],
      collect: async () => ({ candidates: [], feedsFetched: 0 }),
      dedupe: (c: Candidate[]) => c,
      select: async () => { throw new Error('no candidates'); },
    };
    const res = await generateEdition({ trigger: 'manual', dryRun: true, deps: deps as any });
    expect(res.status).toBe('failed');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/news-app && npx vitest run test/generate.test.ts`
Expected: FAIL — cannot find `../src/lib/generate`.

- [ ] **Step 3: Implement `apps/news-app/src/lib/generate.ts`**

```ts
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { categories, sources } from '../db/schema';
import { collectCandidates, dedupeCandidates, type Candidate } from './rss';
import { dedupeCandidates as _unused } from './dedupe'; // see note
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

  const fullCategories = cats.filter((c) => details[c.slug]?.stories === 3).length;
  let status: GenerateResult['status'];
  if (fullCategories === cats.length && cats.length > 0) status = 'success';
  else if (fullCategories === 0) status = 'failed';
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
```

> Note: remove the erroneous `import { dedupeCandidates as _unused } from './dedupe';` line — `dedupeCandidates` is re-exported from `rss`? It is NOT. Fix the imports so `dedupeCandidates` comes from `./dedupe` and `collectCandidates`/`Candidate` from `./rss`:
> ```ts
> import { collectCandidates, type Candidate } from './rss';
> import { dedupeCandidates } from './dedupe';
> ```
> Delete the duplicate/aliased import. Verify no unused imports remain.

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/news-app && npx vitest run test/generate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the whole unit suite**

Run: `cd apps/news-app && npx vitest run`
Expected: all tests pass (seed, rss, dedupe, gemini, generate).

- [ ] **Step 6: Commit**

```bash
git add apps/news-app/src/lib/generate.ts apps/news-app/test/generate.test.ts
git commit -m "feat(news-app): generateEdition orchestration with status transitions"
```

---

### Task 10: CLI `generate` script (`npm run generate`, `--dry-run`)

**Files:**
- Create: `apps/news-app/scripts/generate.ts`

**Interfaces:**
- Consumes: `generateEdition`.
- Produces: a runnable script; prints the JSON result; `--dry-run` passes `dryRun: true`.

- [ ] **Step 1: Implement `apps/news-app/scripts/generate.ts`**

```ts
import { generateEdition } from '../src/lib/generate';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const res = await generateEdition({ trigger: 'manual', dryRun });
  console.log(JSON.stringify(res, null, 2));
  if (res.status === 'failed') process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Dry-run against real feeds + local DB**

Pre-req: `docker-compose up -d news-db` and migrations+seed already applied.
Run (repo root): `DATABASE_URL=postgres://news:news@localhost:5433/news GEMINI_API_KEY=<key> npx nx run news-app:generate -- --dry-run`
Expected: prints a JSON result. (Network/LLM dependent — if a feed is down it's tolerated; if Gemini key is absent it errors clearly.)

> The implementer should obtain a Gemini key from the user/secret store; do NOT read `.env`. If no key is available, note this and verify the dry-run path with `--dry-run` plus an injected fake is already covered by Task 9 tests.

- [ ] **Step 3: Commit**

```bash
git add apps/news-app/scripts/generate.ts
git commit -m "feat(news-app): generate CLI script with --dry-run"
```

---

### Task 11: Cron API route (`POST /api/cron/generate`, CRON_SECRET-guarded)

**Files:**
- Create: `apps/news-app/src/pages/api/cron/generate.ts`
- Create: `apps/news-app/vercel.json`

**Interfaces:**
- Consumes: `generateEdition`.
- Produces: an Astro API route; responds `401` without the correct `Authorization: Bearer <CRON_SECRET>` (or `x-cron-secret` header); on success returns the `GenerateResult` JSON.

- [ ] **Step 1: Implement `apps/news-app/src/pages/api/cron/generate.ts`**

```ts
import type { APIRoute } from 'astro';
import { generateEdition } from '../../../lib/generate';

export const prerender = false;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  const header = request.headers.get('x-cron-secret');
  return auth === `Bearer ${secret}` || header === secret;
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const res = await generateEdition({ trigger: 'cron' });
  return new Response(JSON.stringify(res), {
    status: res.status === 'failed' ? 500 : 200,
    headers: { 'content-type': 'application/json' },
  });
};
```

- [ ] **Step 2: Create `apps/news-app/vercel.json`**

```json
{
  "crons": [{ "path": "/api/cron/generate", "schedule": "0 0 * * *" }]
}
```

> Vercel Cron sends a request with `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set in the project env — this matches the guard above.

- [ ] **Step 3: Verify guard locally**

Run: `cd apps/news-app && (astro dev &) ; sleep 5`
Run: `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4205/api/cron/generate`
Expected: `401`.
Run: `curl -s -o /dev/null -w "%{http_code}" -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:4205/api/cron/generate` (with env set)
Expected: `200` or `500` (not `401`). Stop the dev server afterward.

- [ ] **Step 4: Commit**

```bash
git add apps/news-app/src/pages/api/cron/generate.ts apps/news-app/vercel.json
git commit -m "feat(news-app): cron generate endpoint guarded by CRON_SECRET"
```

---

## Phase 3 — Read API + Frontend (checkpoint: page renders latest published edition; tabs + language switch client-side; empty state when none)

### Task 12: Read model + `GET /api/edition/latest`

**Files:**
- Create: `apps/news-app/src/lib/read.ts`
- Create: `apps/news-app/src/pages/api/edition/latest.ts`
- Test: `apps/news-app/test/read.test.ts`

**Interfaces:**
- Consumes: `getDb`, schema.
- Produces:
  - type `EditionPayload = { editionDate: string; publishedAt: string | null; categories: { slug: string; labels: {en,pl,ru}; stories: { sourceName: string; sourceUrl: string; translations: { en:{headline,body}; pl:{...}; ru:{...} } }[] }[] } | null`
  - `assembleEdition(rows): EditionPayload` — pure shaping function (tested)
  - `getLatestPublishedEdition(db?): Promise<EditionPayload>` — queries latest `published` edition, enabled categories only, ordered.

- [ ] **Step 1: Write failing test `apps/news-app/test/read.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { assembleEdition } from '../src/lib/read';

const rows = {
  edition: { editionDate: '2026-06-28', publishedAt: '2026-06-28T00:05:00Z' },
  categories: [
    { id: 'c2', slug: 'world', position: 2, enabled: true, labels: { en: 'World', pl: 'Świat', ru: 'Мир' } },
    { id: 'c1', slug: 'poland', position: 1, enabled: true, labels: { en: 'Poland', pl: 'Polska', ru: 'Польша' } },
    { id: 'c3', slug: 'hidden', position: 4, enabled: false, labels: { en: 'X', pl: 'X', ru: 'X' } },
  ],
  stories: [
    { id: 's1', categoryId: 'c1', position: 1, sourceName: 'PAP', sourceUrl: 'https://pap/1' },
  ],
  translations: [
    { storyId: 's1', lang: 'en', headline: 'EN', body: 'b' },
    { storyId: 's1', lang: 'pl', headline: 'PL', body: 'b' },
    { storyId: 's1', lang: 'ru', headline: 'RU', body: 'b' },
  ],
};

describe('assembleEdition', () => {
  it('orders categories by position, excludes disabled, embeds 3 langs', () => {
    const out = assembleEdition(rows as any)!;
    expect(out.categories.map((c) => c.slug)).toEqual(['poland', 'world']); // hidden excluded, ordered
    const poland = out.categories[0];
    expect(poland.stories[0].translations.en.headline).toBe('EN');
    expect(Object.keys(poland.stories[0].translations).sort()).toEqual(['en', 'pl', 'ru']);
  });

  it('returns null when no edition', () => {
    expect(assembleEdition(null as any)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/news-app && npx vitest run test/read.test.ts`
Expected: FAIL — cannot find `../src/lib/read`.

- [ ] **Step 3: Implement `apps/news-app/src/lib/read.ts`**

```ts
import { and, desc, eq } from 'drizzle-orm';
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
    ? await db.select().from(storyTranslations)
        .where(and(...[/* in() */])) // replaced below
    : [];

  // Use inArray for translations:
  return assembleEdition({
    edition: {
      editionDate: edition.editionDate,
      publishedAt: edition.publishedAt ? edition.publishedAt.toISOString() : null,
    },
    categories: cats.map((c) => ({ id: c.id, slug: c.slug, position: c.position, enabled: c.enabled, labels: c.labels as any })),
    stories: storyRows.map((s) => ({ id: s.id, categoryId: s.categoryId, position: s.position, sourceName: s.sourceName, sourceUrl: s.sourceUrl })),
    translations: transRows.map((t) => ({ storyId: t.storyId, lang: t.lang as Lang, headline: t.headline, body: t.body })),
  });
}
```

> Fix the translations query to use `inArray` (the `and(...[])` placeholder is wrong). Implement as:
> ```ts
> import { inArray } from 'drizzle-orm';
> const transRows = storyIds.length
>   ? await db.select().from(storyTranslations).where(inArray(storyTranslations.storyId, storyIds))
>   : [];
> ```
> Add `inArray` to the `drizzle-orm` import and remove the `and(...[])` placeholder line.

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/news-app && npx vitest run test/read.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement the API route `apps/news-app/src/pages/api/edition/latest.ts`**

```ts
import type { APIRoute } from 'astro';
import { getLatestPublishedEdition } from '../../../lib/read';

export const prerender = false;

export const GET: APIRoute = async () => {
  const payload = await getLatestPublishedEdition();
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
```

- [ ] **Step 6: Commit**

```bash
git add apps/news-app/src/lib/read.ts apps/news-app/src/pages/api/edition/latest.ts apps/news-app/test/read.test.ts
git commit -m "feat(news-app): read model and GET /api/edition/latest"
```

---

### Task 13: Public page (server load + embedded payload) and client switching

**Files:**
- Modify: `apps/news-app/src/pages/index.astro` (replace placeholder)
- Create: `apps/news-app/src/components/Digest.tsx` is NOT used (avoid adding React); instead use a small inline `<script>` island in the `.astro` file for tab/language switching.

**Interfaces:**
- Consumes: `getLatestPublishedEdition` server-side.
- Produces: HTML with the full edition embedded as JSON; client script toggles tabs/languages from that payload, persists language to `localStorage` + URL `?lang=`, tab to URL hash.

- [ ] **Step 1: Replace `apps/news-app/src/pages/index.astro`**

```astro
---
import { getLatestPublishedEdition } from '../lib/read';
const edition = await getLatestPublishedEdition();
---
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>News Digest</title>
    <style>
      :root { color-scheme: light dark; }
      body { font-family: system-ui, sans-serif; margin: 0; background: #f4f4f5; }
      main { max-width: 640px; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
      header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
      .langs button, .tabs button { border: 0; background: transparent; cursor: pointer; padding: .4rem .7rem; border-radius: 999px; font: inherit; }
      .langs button[aria-pressed="true"], .tabs button[aria-pressed="true"] { background: #18181b; color: #fff; }
      .tabs { display: flex; gap: .25rem; margin-bottom: 1rem; }
      article { background: #fff; border-radius: 12px; padding: 1rem 1.1rem; margin-bottom: .8rem; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
      article h2 { margin: 0 0 .5rem; font-size: 1.05rem; }
      article p { margin: 0 0 .6rem; line-height: 1.5; color: #27272a; }
      .src { font-size: .8rem; }
      .src a { color: #2563eb; text-decoration: none; }
      footer { margin-top: 1.5rem; font-size: .8rem; color: #71717a; text-align: center; }
      .empty { text-align: center; padding: 3rem 1rem; color: #52525b; }
    </style>
  </head>
  <body>
    <main>
      {edition ? (
        <>
          <header>
            <strong>News Digest</strong>
            <div class="langs" id="langs">
              <button data-lang="en">EN</button>
              <button data-lang="pl">PL</button>
              <button data-lang="ru">RU</button>
            </div>
          </header>
          <div class="tabs" id="tabs"></div>
          <div id="stories"></div>
          <footer id="meta"></footer>
          <script type="application/json" id="edition-data" set:html={JSON.stringify(edition)}></script>
        </>
      ) : (
        <div class="empty">
          <h1>News Digest</h1>
          <p>Today’s edition is being prepared. Please check back soon.</p>
        </div>
      )}
    </main>

    <script is:inline>
      const el = document.getElementById('edition-data');
      if (el) {
        const data = JSON.parse(el.textContent);
        const cats = data.categories;
        const LANGS = ['en', 'pl', 'ru'];

        const params = new URLSearchParams(location.search);
        let lang = params.get('lang') || localStorage.getItem('news-lang')
          || (navigator.language || 'pl').slice(0, 2);
        if (!LANGS.includes(lang)) lang = 'pl';
        let active = (location.hash || '#' + (cats[0]?.slug || '')).slice(1);
        if (!cats.some((c) => c.slug === active)) active = cats[0]?.slug;

        const tabsEl = document.getElementById('tabs');
        const storiesEl = document.getElementById('stories');
        const metaEl = document.getElementById('meta');
        const langsEl = document.getElementById('langs');

        function render() {
          tabsEl.innerHTML = '';
          cats.forEach((c) => {
            const b = document.createElement('button');
            b.textContent = c.labels[lang];
            b.setAttribute('aria-pressed', String(c.slug === active));
            b.onclick = () => { active = c.slug; location.hash = c.slug; render(); };
            tabsEl.appendChild(b);
          });
          langsEl.querySelectorAll('button').forEach((b) =>
            b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
          const cat = cats.find((c) => c.slug === active);
          storiesEl.innerHTML = '';
          (cat?.stories || []).forEach((s) => {
            const a = document.createElement('article');
            const t = s.translations[lang];
            const h = document.createElement('h2'); h.textContent = t.headline;
            a.appendChild(h);
            t.body.split('\n\n').forEach((para) => {
              const p = document.createElement('p'); p.textContent = para; a.appendChild(p);
            });
            const src = document.createElement('div'); src.className = 'src';
            const link = document.createElement('a');
            link.href = s.sourceUrl; link.textContent = s.sourceName;
            link.target = '_blank'; link.rel = 'noopener';
            src.appendChild(link); a.appendChild(src);
            storiesEl.appendChild(a);
          });
          metaEl.textContent = 'Edition: ' + data.editionDate +
            (data.publishedAt ? ' · updated ' + new Date(data.publishedAt).toLocaleTimeString() : '');
        }

        langsEl.querySelectorAll('button').forEach((b) => {
          b.onclick = () => {
            lang = b.dataset.lang;
            localStorage.setItem('news-lang', lang);
            const p = new URLSearchParams(location.search); p.set('lang', lang);
            history.replaceState(null, '', location.pathname + '?' + p.toString() + location.hash);
            render();
          };
        });
        render();
      }
    </script>
  </body>
</html>
```

- [ ] **Step 2: Build to verify the page compiles**

Run: `cd apps/news-app && npx astro build`
Expected: build succeeds (no template/type errors).

- [ ] **Step 3: Manual smoke (with a published edition in the local DB)**

Pre-req: run a full (non-dry-run) `npx nx run news-app:generate` with valid env so a `published` edition exists.
Run: `cd apps/news-app && (astro dev &) ; sleep 5 ; curl -s http://localhost:4205/ | grep -c 'edition-data'`
Expected: `1` (payload embedded). If no edition exists, expect the "being prepared" copy instead. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/news-app/src/pages/index.astro
git commit -m "feat(news-app): reading page with client tab/language switching"
```

---

### Task 14: Admin logs endpoint + CLI

**Files:**
- Create: `apps/news-app/src/lib/logs.ts`
- Create: `apps/news-app/src/pages/api/admin/logs.ts`
- Create: `apps/news-app/scripts/logs.ts`

**Interfaces:**
- Consumes: `getDb`, schema.
- Produces:
  - `recentLogs(db?, limit = 20): Promise<GenerationLog[]>`
  - `GET /api/admin/logs` (CRON_SECRET-guarded) returning recent logs JSON
  - CLI `scripts/logs.ts` printing recent logs.

- [ ] **Step 1: Implement `apps/news-app/src/lib/logs.ts`**

```ts
import { desc } from 'drizzle-orm';
import { getDb } from '../db/client';
import { generationLogs, type GenerationLog } from '../db/schema';

export async function recentLogs(db = getDb(), limit = 20): Promise<GenerationLog[]> {
  return db.select().from(generationLogs).orderBy(desc(generationLogs.runAt)).limit(limit);
}
```

- [ ] **Step 2: Implement `apps/news-app/src/pages/api/admin/logs.ts`**

```ts
import type { APIRoute } from 'astro';
import { recentLogs } from '../../../lib/logs';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('x-cron-secret');
  const auth = request.headers.get('authorization');
  if (!secret || (header !== secret && auth !== `Bearer ${secret}`)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const logs = await recentLogs();
  return new Response(JSON.stringify(logs), { status: 200, headers: { 'content-type': 'application/json' } });
};
```

- [ ] **Step 3: Implement `apps/news-app/scripts/logs.ts`**

```ts
import { recentLogs } from '../src/lib/logs';

async function main() {
  const logs = await recentLogs();
  for (const l of logs) {
    console.log(`${l.runAt?.toISOString?.() ?? l.runAt} | ${l.status} | trigger=${l.trigger} | stories=${l.storiesCreated} | feeds=${l.feedsFetched} | ${l.durationMs}ms${l.error ? ' | ERROR: ' + l.error : ''}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Verify CLI runs**

Run (repo root): `DATABASE_URL=postgres://news:news@localhost:5433/news npx nx run news-app:logs`
Expected: prints recent log rows (or nothing if none yet) without error.

- [ ] **Step 5: Commit**

```bash
git add apps/news-app/src/lib/logs.ts apps/news-app/src/pages/api/admin/logs.ts apps/news-app/scripts/logs.ts
git commit -m "feat(news-app): generation logs endpoint and CLI"
```

---

### Task 15: README + final verification

**Files:**
- Create: `apps/news-app/README.md`

**Interfaces:** none.

- [ ] **Step 1: Write `apps/news-app/README.md`**

```markdown
# news-app

Minimal daily news digest (Astro + Postgres + Drizzle + Gemini).

## Local dev
1. `npm run db:up` — start local Postgres (port 5433).
2. `cp apps/news-app/.env.example apps/news-app/.env` and fill `GEMINI_API_KEY`, `CRON_SECRET`.
3. `npm run db:migrate && npm run db:seed`.
4. `npm run generate` — produce a real edition (or `npm run generate -- --dry-run`).
5. `npx nx serve news-app` — open http://localhost:4205.

## Inspecting runs
- `npm run news:logs` — recent generation logs.
- `GET /api/admin/logs` (header `x-cron-secret`) — same data over HTTP.

## Deploy (Vercel)
- Project env: `DATABASE_URL` (Neon), `GEMINI_API_KEY`, `CRON_SECRET`.
- `vercel.json` schedules `POST /api/cron/generate` at 00:00 UTC.
```

- [ ] **Step 2: Full test suite**

Run: `cd apps/news-app && npx vitest run`
Expected: all unit tests pass.

- [ ] **Step 3: Lint + typecheck**

Run: `cd apps/news-app && npx tsc --noEmit`
Expected: no type errors.
Run (repo root): `npx nx lint news-app` (if an eslint config resolves for the project; otherwise skip and note).

- [ ] **Step 4: Build**

Run: `cd apps/news-app && npx astro build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/news-app/README.md
git commit -m "docs(news-app): local dev and deploy readme"
```

---

## Self-Review (planner checklist results)

**Spec coverage:**
- Architecture (one Astro project, API routes, Postgres/Drizzle, Vercel Cron, Gemini) → Tasks 1, 2, 11.
- Data model (6 tables, decisions: history kept / categories table / jsonb labels / translations as rows / sources in DB) → Task 3.
- Generation pipeline (fetch → select → summarize/translate → persist + log; per-feed tolerance; Zod; source_url guard; retry; status transitions; previous-published-stays-live) → Tasks 5–11.
- Trusted-source enforcement (candidates only from `sources`) → Tasks 4, 9 (`loadSources`) + 7 (url-must-be-candidate guard).
- Frontend (server load + embedded payload, instant client tab/lang switch, localStorage+URL, empty state, CDN cache) → Tasks 12, 13.
- Read API contract → Task 12.
- Local dev (Docker Postgres, env, commands, logs) → Tasks 1, 2, 4, 10, 14, 15.
- Cost/hosting → no code (documented in README/spec).
- Testing strategy (pipeline primary target, read API shape, frontend switching) → Tasks 5–9, 12 (frontend switching verified via build/manual smoke; pure logic is in the inline island — acceptable per spec's "minimal JS").

**Placeholder scan:** Two snippets intentionally contain a wrong line followed by an explicit "fix this" note (Task 8 `finalizeEdition` dynamic import; Task 9 duplicate dedupe import; Task 12 `read.ts` translations query). Each has the corrected code inline immediately after. These are call-outs, not unresolved placeholders.

**Type consistency:** `Candidate`, `Pick`, `CategoryPicks`, `GenerateResult`, `EditionPayload` names are used consistently across tasks. `selectAndTranslate(slug, candidates, opts)` signature matches its use in `generate.ts` deps. `getLatestPublishedEdition`/`assembleEdition` names match between Task 12 and Task 13.

**Known risk to flag at execution:** Astro 5 + `@astrojs/vercel` + Nx run-commands and the exact dependency version floors (Astro 5.x, drizzle-orm 0.36, drizzle-kit 0.28) should be confirmed against latest at install time; if `astro add vercel` is preferred over manual config, the implementer may use it. RSS feed URLs in the seed are best-effort and may need adjustment when first run.
