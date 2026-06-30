# news-app

Minimal daily news digest (Astro + Postgres + Drizzle + Gemini). 3 tabs (Poland / World / Positive) × up to 5 stories × 3 languages (EN / PL / RU), one edition generated per day from curated RSS feeds, summarized and translated by Gemini.

## Local dev

1. `npm run db:up` — start local Postgres (Docker, port 5433).
2. `cp apps/news-app/.env.example apps/news-app/.env` and fill `GEMINI_API_KEY` and `CRON_SECRET`.
3. `npm run db:migrate && npm run db:seed` — apply schema and seed categories + default sources.
4. `npx nx run news-app:generate` — produce a real edition (add `-- --dry-run` to print picks without writing). Reads `DATABASE_URL`/`GEMINI_API_KEY` from `.env`, so it targets the local DB. (For prod, use `npm run news:generate`, which reads `.env.local`.)
5. `npx nx serve news-app` — open http://localhost:4205.

> Note: the Nx targets read `DATABASE_URL` from the environment (or `.env`). The dev DB URL is `postgres://news:news@localhost:5433/news`.

## Inspecting runs

- `npm run news:logs` — print recent `generation_logs` rows.
- `GET /api/admin/logs` (header `x-cron-secret: <CRON_SECRET>`) — same data over HTTP.

## Endpoints

- `GET /` — the public reading page (server-rendered, client-side tab/language switching).
- `GET /api/edition/latest` — latest published edition as JSON (CDN-cacheable).
- `POST /api/cron/generate` — run generation; guarded by `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`.
- `GET /api/admin/logs` — recent generation logs (same guard).

## Deploy (Vercel)

- Project env: `DATABASE_URL` (Neon), `GEMINI_API_KEY`, `CRON_SECRET`.
- `vercel.json` schedules `POST /api/cron/generate` at `0 0 * * *` (00:00 UTC). Vercel sends the `CRON_SECRET` as a Bearer token.

## Stack notes

- **Astro 5** (`output: 'server'`) with `@astrojs/vercel` adapter. Integrated into Nx via `nx:run-commands` targets (no `@nx/astro` plugin).
- **Drizzle ORM** + `postgres` (postgres.js). Works against both local Docker Postgres and Neon with the same schema/migrations.
- **Gemini** `gemini-2.5-flash` for selection + translation. Output is validated with Zod and every `source_url` must be one of the fetched candidates (no hallucinated links).
- Scripts (`generate`, `seed`, `logs`) run via `tsx`.
