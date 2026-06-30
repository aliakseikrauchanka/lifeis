# News Digest Site — Design

**Date:** 2026-06-27
**Status:** Approved (brainstorming complete) — ready for implementation plan

## Overview

A minimal, infopiguła.pl-style news site: a single centered panel that shows a small daily digest of neutral, fact-based news. Three tabs (Poland / World / "Positives"), three stories per tab, available in three languages (EN / PL / RU). One edition is generated automatically each day from a curated set of trusted RSS feeds, summarized and translated by an LLM, and served as a near-static, fast-loading page.

Scope is deliberately small (MVP): the public reading panel plus a daily generation pipeline with logging. No user accounts, no favorites, no ratings, no admin UI.

## Goals

- Central reading panel matching the infopiguła "middle panel" layout.
- 3 tabs × 3 stories, switchable instantly.
- 3 languages (EN / PL / RU), switchable instantly.
- One edition generated per day at 00:00 UTC, automatically.
- Neutral, no-hype, fact-based tone; stories only from approved sources.
- Logging to confirm the daily job ran and to debug it.
- Runs effectively free; trivially runnable locally.

## Non-goals (MVP)

- Authentication, registration, favorites.
- Star ratings / scoring.
- Admin UI (feeds are edited directly in the DB; logs are read via a script/JSON endpoint).
- More than once-per-day generation.

## 1. Architecture

A single self-contained **Astro project** (`apps/news-app` in the Nx monorepo) holding both the frontend pages and the backend API routes. It deploys as one Vercel project, fully isolated from `entry-server`.

- **Frontend** — Astro pages (server output). The page loads the latest published edition from the DB and renders it. Tabs + language switching happen client-side: the whole edition (≤9 stories × 3 languages) is tiny, so it ships in one payload and switching is instant.
- **Backend** — Astro API routes (`src/pages/api/...`). No separate service to deploy.
- **Database** — Postgres. **Neon** (serverless) in production; plain **Postgres in Docker** locally (added to the existing `docker-compose`). **Drizzle ORM** for schema + migrations — identical schema in both environments.
- **Scheduler** — **Vercel Cron** calls `POST /api/cron/generate` at `0 0 * * *` (00:00 UTC), protected by a `CRON_SECRET` header. Locally the same logic runs via `npm run generate` (no waiting for cron).
- **LLM** — Google **Gemini** (`gemini-2.5-flash` or current Flash).

Two clean, independently testable units:

1. **Generation pipeline** — fetch RSS → select → summarize/translate → persist + log. Runs from both cron and the local script.
2. **Read API + Astro page** — serve the latest published edition.

**Why one Astro project over a separate Node service:** the requirements are "all on Vercel" + "easy to run locally." One Astro project gives a single deploy, a single dev command, and no second backend to maintain.

## 2. Data model (Postgres / Drizzle)

Six tables. An **edition** is one generation run's bundle of **stories** (up to 9: enabled categories × 3); each story has 3 **translations**; every run writes a **generation_logs** row; **categories** and **sources** are configuration.

```
categories
  id          uuid pk
  slug        text unique     -- stable key: 'poland' | 'world' | 'positive'
  position    smallint        -- tab order in the UI
  enabled     boolean default true   -- disabled => skipped in generation + hidden in UI
  labels      jsonb           -- tab label per lang: {"en":"Poland","pl":"Polska","ru":"Польша"}
  created_at  timestamptz

editions                      -- one row per generation run (history kept)
  id            uuid pk
  edition_date  date          -- the day it's for (UTC); NOT unique
  status        text          -- 'draft' | 'published' | 'partial' | 'failed'
  trigger       text          -- 'cron' | 'manual'
  created_at    timestamptz
  published_at  timestamptz null
  -- "current" edition = latest row where status='published', ordered by published_at desc

stories
  id            uuid pk
  edition_id    uuid fk -> editions.id (cascade delete)
  category_id   uuid fk -> categories.id
  position      smallint      -- 1..3 within the tab
  source_name   text          -- badge, e.g. "Reuters"
  source_url    text          -- link to original article
  published_at  timestamptz null   -- original article time
  -- unique(edition_id, category_id, position)

story_translations
  id            uuid pk
  story_id      uuid fk -> stories.id (cascade delete)
  lang          text          -- 'en' | 'pl' | 'ru'
  headline      text
  body          text
  -- unique(story_id, lang)

generation_logs               -- "did it run?" visibility
  id               uuid pk
  run_at           timestamptz
  trigger          text       -- 'cron' | 'manual'
  status           text       -- 'success' | 'partial' | 'failed'
  edition_id       uuid null fk -> editions.id
  feeds_fetched    int        -- how many feeds responded
  items_considered int        -- candidate articles seen
  stories_created  int        -- 9 on full success
  duration_ms      int
  error            text null   -- stack/message if failed
  details          jsonb null  -- per-category breakdown

sources                       -- feed config (in DB so no redeploy to change)
  id           uuid pk
  category_id  uuid fk -> categories.id
  name         text           -- badge label
  feed_url     text           -- RSS/Atom URL
  enabled      boolean default true
```

**Decisions baked in:**

- **History of regenerations kept.** `edition_date` is *not* unique. Each run (cron or manual) inserts a new `editions` row. Regenerations never overwrite — they become the new latest. The public read is always the latest `status='published'` edition. Full history retained for a possible archive view later.
- **Categories as their own table** with an `enabled` flag, so categories can be added/renamed/disabled without code changes. A disabled category is skipped in generation *and* hidden in the UI; an edition may therefore contain stories for only the enabled categories.
- **Category labels as `jsonb`** (`{en,pl,ru}`) rather than a separate translations table — they are short and rarely change, and this keeps tab labels editable in the DB without an extra join.
- **Translations as rows**, not columns — adding a 4th language later is just data, no migration.
- **`sources` lives in the DB** so feeds can be added/disabled without redeploying. Seeded from a defaults file on first migration.
- **`generation_logs`** is the verification channel: query it to confirm the 00:00 run happened, see counts, and read errors. The cron route also returns a summary JSON.
- **Failure behavior:** if a run fails or produces fewer than the expected stories, the edition is marked `partial`/`failed` and the public page keeps showing the last `published` edition — readers never see a broken or empty page.

## 3. Generation pipeline

One function, `generateEdition({ trigger })`, called by both Vercel Cron and the local `npm run generate` script. This is the most heavily tested unit.

**Flow:**

```
1. Start log timer. Load enabled categories + their enabled sources.
2. Create an edition row (status='draft', edition_date=today UTC, trigger).
3. For each enabled category, in parallel:
   a. Fetch all its RSS feeds (with timeout + per-feed try/catch).
   b. Collect items from the last ~36h; normalize {title, summary, link, source_name, published_at}.
   c. Dedupe (by URL + fuzzy title match).
   d. Send the candidate list to Gemini with a strict prompt (below).
   e. Gemini returns JSON: exactly 3 picks, each with source_url + headline/body in en/pl/ru.
   f. Validate against a Zod schema. Verify each source_url is one of the candidates (no hallucinated links).
4. Persist stories + translations for all categories.
5. If every enabled category produced 3 valid stories -> status='published', set published_at.
   Else -> status='partial' or 'failed'; the previous published edition stays live.
6. Write generation_logs row (counts, duration, per-category details, errors).
7. Return a JSON summary (the cron endpoint responds with it).
```

**Gemini prompt enforces the "no hype, fact-based, neutral" rules:**

- Pick the 3 **most significant** stories — not the most sensational.
- Rewrite in a **neutral, factual tone**: no opinion, no editorializing, no clickbait (mirrors infopiguła's "bez opinii i neutralnie").
- **Use only facts present in the provided candidate items** — do not invent details; `source_url` must be copied from a candidate (re-enforced in code at step 3f).
- Output strict JSON only:
  `[{ source_url, source_name, translations: { en:{headline,body}, pl:{...}, ru:{...} } }, ...]`
- Body ≈ 2 short paragraphs (the infopiguła "pigułka" length).

**Trusted-source enforcement is structural, not just prompted:** candidates come *only* from the curated `sources` table. The LLM selects/rewrites from approved feeds and cannot pull from anywhere else.

**Reliability:**

- Per-feed failures are tolerated (recorded in `feeds_fetched`); one dead feed doesn't kill the run.
- The Gemini call is wrapped with one retry on invalid JSON.
- Re-running is safe: it just creates another edition; latest-published wins.
- The cron route is guarded by a `CRON_SECRET` header so only Vercel (or you, locally) can trigger it.

**Starter trusted sources to seed** (editable anytime in `sources`):

- **Poland:** PAP, Polskie Radio, Reuters (Poland), Notes from Poland
- **World:** Reuters, Associated Press, BBC News, Al Jazeera
- **Positive:** Good News Network, Reuters science/"Oddly", Positive News

## 4. Frontend (Astro page)

**Single page, instant interactions.** The page server-side loads the latest published edition (all enabled categories × 3 stories × 3 languages) in one DB query and ships it as initial HTML plus a small embedded JSON payload. Because the edition is tiny, **tab and language switching are pure client-side** — no refetch, no flicker.

```
Layout (centered column, like the screenshot's middle panel)
 |- Header: logo + language switcher (EN / PL / RU)
 |- Tab bar: built from enabled categories (labels from category.labels[lang])
 |     [ Polska ] [ Świat ] [ Pozytywy dla Kuby ]
 |- Story list (3 cards for the active tab)
 |     |- Headline (bold)
 |     |- Body (~2 paragraphs)
 |     |- Footer: source badge (e.g. "PAP") -> links to source_url
 |- Small footer: "Edition: <date> · updated <time>"
```

**Behavior:**

- **Language:** switching swaps rendered `headline`/`body`/tab labels from the already-loaded payload; persisted to `localStorage` + reflected in URL (`?lang=pl`) so a shared link keeps the language. Default language: URL → localStorage → browser `Accept-Language` → `pl`.
- **Tabs:** client-side toggle; active tab in URL hash (`#world`) so it's shareable and back-button friendly.
- **No edition yet / generation failed:** the page shows a friendly "Today's edition is being prepared" state instead of an error.

**Rendering mode (the "super quick" requirement):** Astro server output on Vercel, with the page response **CDN-cached** with a short revalidate (`s-maxage` of a few hours, or on-demand revalidation after each publish). Result: near-static, fast TTFB, always reflecting the latest published edition. Minimal JS — only the small tab/language switcher hydrates (Astro islands).

**Read API** (used by the page's loader; reusable later by an app):

- `GET /api/edition/latest` →
  `{ edition_date, categories: [{ slug, labels, stories: [{ source_name, source_url, translations: { en, pl, ru } }] }] }`

## 5. Local development

Goal: clone → one command → working site with real data, no waiting for cron.

- **Postgres locally** via the existing `docker-compose` (add a `news-db` Postgres service). Prod uses Neon — same Postgres, identical Drizzle schema/migrations.
- **Env:** `.env` with `DATABASE_URL`, `GEMINI_API_KEY`, `CRON_SECRET`. A committed `.env.example` documents them.
- **Commands** (wired as Nx targets):
  - `nx serve news-app` — Astro dev server (frontend + API routes).
  - `npm run db:up` — start the Postgres container.
  - `npm run db:migrate` / `db:seed` — Drizzle migrations + seed categories & default sources.
  - `npm run generate` — runs the same `generateEdition()` the cron calls, against the local DB, so you can produce a real edition on demand and iterate on prompts. `generate --dry-run` prints the picks without writing.
- **Inspecting logs:** `npm run logs` (or a small `/api/admin/logs` JSON guarded by `CRON_SECRET`) prints recent `generation_logs` rows — works identically locally and in prod. This is the "did the news get generated?" visibility requested.
- **Vercel Cron** config lives in `vercel.json`:
  `{ "crons": [{ "path": "/api/cron/generate", "schedule": "0 0 * * *" }] }`
  Cron fires only in prod; locally use `npm run generate`.

## 6. Cost / hosting tiers

For a personal, once-a-day, low-traffic site this runs at **$0/month in practice**.

- **Vercel (Hobby)** — free hosting, serverless functions, and Cron Jobs. Hobby cron is limited to **once per day**, which exactly matches the 00:00 UTC schedule. Caveats: Hobby is non-commercial only; cannot add more frequent generation without upgrading to Pro ($20/mo) or triggering generation another way.
- **Neon Postgres** — free tier (0.5 GB, autosuspend) is far more than enough; data is a few KB per edition. Scales to zero after inactivity → ~0.5s cold start on the first request after idle (negligible here).
- **RSS feeds** — free (public feeds).
- **Local dev (Docker Postgres)** — free.
- **Google Gemini API** — metered, but usage is tiny (≈3 calls/day: one per category). Stays within the free tier in practice. Could tip into paid only with frequent regeneration or large expansion.

**Bottom line:** the only metered piece is Gemini, and at one edition/day it stays inside the free tier.

## Testing strategy

- **Generation pipeline** is the primary test target: RSS normalization/dedupe, Gemini response validation (Zod), the source_url-must-be-a-candidate guard, and edition status transitions (published / partial / failed) including the "previous published edition stays live on failure" behavior. LLM and feed fetches are mocked.
- **Read API / payload shape** — `GET /api/edition/latest` returns enabled categories only, correct ordering, and all three languages.
- **Frontend** — language/tab switching operates purely on the loaded payload; empty/"being prepared" state renders when no published edition exists.
