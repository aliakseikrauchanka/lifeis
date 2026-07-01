# Deploying news-app to Vercel

`news-app` is an **Astro 5 SSR** app (`output: 'server'` + `@astrojs/vercel` adapter) living inside the Nx monorepo. It uses **Postgres (Neon in prod) via Drizzle**, **Gemini** for generation, and a **daily Vercel Cron** that triggers edition generation.

This guide covers a first-time deploy and ongoing operations.

> **Monorepo caveat (read this first).** Because dependencies are hoisted to the
> repo-root `node_modules`, Vercel's remote build does **not** work out of the box
> for this app, and the verified deploy path is a **local build + prebuilt upload**
> (see [§3](#3-create-the-vercel-project)). Two non-obvious things make it work:
>
> 1. `astro.config.mjs` sets `vite.ssr.noExternal: true` (keeping `sharp` external)
>    so the serverless function is **self-contained**. Without it the function ships
>    with no `node_modules` and every request fails with `FUNCTION_INVOCATION_FAILED`.
> 2. The deploy uses `vercel deploy --prebuilt` from the **repo root**, because
>    Vercel's Nx auto-detection produces an empty build (404s on every route).

---

## 1. Prerequisites

- A [Vercel](https://vercel.com) account with access to this Git repository.
- A **Neon** (or any serverless Postgres) database — [neon.tech](https://neon.tech).
- A **Gemini API key** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
- A `CRON_SECRET` — generate one with:
  ```bash
  openssl rand -hex 32
  ```

---

## 2. Provision the database (Neon)

1. Create a Neon project and copy the **pooled connection string** (it looks like
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/news?sslmode=require`).
2. Keep it handy — it becomes `DATABASE_URL` in Vercel.

> The same Drizzle schema/migrations work against both local Docker Postgres and Neon, so no schema changes are needed.

---

## 3. Create the Vercel project

### One-time project setup

```bash
npm i -g vercel
cd apps/news-app
vercel link                 # create/select the "news-app" project
```

In the Vercel dashboard, set the project's **Root Directory** to `apps/news-app` so
it uses **`apps/news-app/vercel.json`** (the cron config) rather than the repo-root
`vercel.json` (which is a SPA rewrite for a different app).

### Verified deploy flow (local build → prebuilt upload)

Vercel's remote build auto-detects Nx and produces an **empty output** (every route
404s). So build locally and upload the prebuilt [Build Output API](https://vercel.com/docs/build-output-api)
result. Run all commands from the **repo root**:

```bash
# 1. Build locally (Astro + @astrojs/vercel → apps/news-app/.vercel/output)
npx nx build news-app

# 2. The repo-root .vercel link is where `--prebuilt` looks for the output,
#    so copy the build there.
rm -rf .vercel/output
cp -R apps/news-app/.vercel/output .vercel/output

# 3. Deploy the prebuilt output to production
vercel deploy --prebuilt --prod
```

> The repo root must be linked to the `news-app` project too:
> `cd <repo-root> && vercel link --project news-app`. Deploying with a plain
> `vercel --prod` (non-prebuilt) fails here — from `apps/news-app` it errors with a
> doubled path (`apps/news-app/apps/news-app`), and from the repo root Vercel's Nx
> detection builds nothing.

Add the environment variables (next section) before the first deploy.

---

## 4. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production, and Preview if you want preview deploys to work):

| Variable         | Description                                              |
| ---------------- | ------------------------------------------------------- |
| `DATABASE_URL`   | Neon pooled Postgres connection string.                 |
| `GEMINI_API_KEY` | Google Gemini API key (uses `gemini-2.5-flash`).        |
| `CRON_SECRET`    | Random secret guarding the generation/admin endpoints.  |

> Vercel automatically sends `CRON_SECRET` as `Authorization: Bearer <CRON_SECRET>` on scheduled cron invocations, which is exactly what `POST /api/cron/generate` checks.

---

## 5. Run database migrations

Vercel does **not** run migrations during the build. Apply them once (and after every schema change) from your machine, pointed at the production DB:

```bash
cd apps/news-app
DATABASE_URL='<neon-connection-string>' npm run db:migrate
DATABASE_URL='<neon-connection-string>' npm run db:seed   # seeds categories + default RSS sources
```

> Run the seed only on a fresh database. Re-running it on a populated DB may duplicate seed rows.

---

## 6. Generate the first edition

The public page (`GET /`) shows the latest published edition, so a fresh deploy needs one edition before it displays content.

**Option A — locally against prod DB:**
```bash
cd apps/news-app
DATABASE_URL='<neon-string>' GEMINI_API_KEY='<key>' npx tsx scripts/generate.ts
# add `--dry-run` to preview picks without writing
```
> Once `apps/news-app/.env.local` holds the prod `DATABASE_URL`/`GEMINI_API_KEY`,
> `npm run news:generate` does the same thing without inline vars.

**Option C — trigger the deployed endpoint** (server-side, same as the cron):
```bash
npm run news:trigger        # reads CRON_SECRET from .env.local
```

**Option B — trigger the deployed endpoint:**
```bash
curl -X POST https://<your-app>.vercel.app/api/cron/generate \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json"
```

> The `Content-Type: application/json` header is **required**. Astro 5's CSRF guard
> (`security.checkOrigin`, on by default) rejects form-style POSTs with no matching
> `Origin` ("Cross-site POST form submissions are forbidden"); it skips the check for
> JSON. Generation takes a few seconds (RSS fetch + Gemini).

---

## 7. Cron schedule

`apps/news-app/vercel.json` already configures the daily job:

```json
{ "crons": [{ "path": "/api/cron/generate", "schedule": "0 0 * * *" }] }
```

> **⚠️ `--prebuilt` deploys ignore `vercel.json`.** The verified deploy flow uses
> `vercel deploy --prebuilt`, which reads its configuration from the Build Output
> API `.vercel/output/config.json` — **not** from `vercel.json`. The Astro/Vercel
> adapter does not copy the `crons` array into that output, so a plain prebuilt
> deploy registers **no cron** and the daily generation silently never runs.
> `scripts/deploy.sh` fixes this by injecting the `crons` from `vercel.json` into
> `.vercel/output/config.json` before deploying. If you deploy by hand, replicate
> that step. After deploying, verify the job under **Project → Settings → Cron Jobs**.

> **⚠️ Vercel Cron invokes the path with `GET`**, not POST, and adds
> `Authorization: Bearer <CRON_SECRET>` automatically. The handler in
> `src/pages/api/cron/generate.ts` must therefore export a **`GET`** handler (it can
> share the same logic as `POST`). A POST-only endpoint will not be triggered by the
> scheduled job. GET is exempt from the CSRF check above, so no content-type header is
> needed for the cron itself.

> Cron Jobs require a Vercel **Pro** plan (Hobby allows a limited number of daily crons — check current plan limits).

---

## 8. Verify the deployment

- `GET https://<your-app>.vercel.app/` — public reading page renders the latest edition.
- `GET /api/edition/latest` — latest edition as JSON.
- `GET /api/admin/logs` with header `x-cron-secret: <CRON_SECRET>` — recent generation logs.

---

## 9. Endpoints reference

| Endpoint                 | Method | Auth                                                  | Purpose                          |
| ------------------------ | ------ | ----------------------------------------------------- | -------------------------------- |
| `/`                      | GET    | none                                                  | Public reading page (SSR).       |
| `/api/edition/latest`    | GET    | none                                                  | Latest published edition (JSON). |
| `/api/cron/generate`     | GET, POST | `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret` | Run generation (GET = cron, POST = manual). |
| `/api/admin/logs`        | GET    | `x-cron-secret: <CRON_SECRET>`                        | Recent generation logs.          |

---

## Deploy script

`scripts/deploy.sh` wraps the verified flow (build → copy output → prebuilt deploy).
Run it from anywhere in the repo:

```bash
apps/news-app/scripts/deploy.sh
```

## Troubleshooting

- **Every route 404s / `NOT_FOUND`; build log shows `Detected Nx … Build Completed [~45ms]`** — Vercel's remote Nx build produced nothing. Use the prebuilt flow in [§3](#3-create-the-vercel-project) (`scripts/deploy.sh`); do not rely on a plain `vercel --prod`.
- **`FUNCTION_INVOCATION_FAILED` / 500 on every route** — the serverless function is missing its `node_modules` (deps left as bare external imports). Ensure `astro.config.mjs` has `vite.ssr.noExternal: true`. A healthy `_render.func` is ~1.5 MB+; a broken one is ~250 KB. Verify with `find apps/news-app/.vercel/output/functions/_render.func -name node_modules` (should not be needed) and check the bundle has no bare `import "postgres"` etc.
- **`Cross-site POST form submissions are forbidden`** — Astro CSRF guard; add `-H "Content-Type: application/json"` to the curl (see [§6](#6-generate-the-first-edition)).
- **Deploy errors with a doubled path `apps/news-app/apps/news-app`** — you ran `vercel` from `apps/news-app` while Root Directory is also `apps/news-app`. Deploy from the **repo root** instead.
- **`vercel env pull` writes empty values** — the env vars were created as **Sensitive**, which are write-only and cannot be pulled. They still inject into deployments fine; for local migrate/seed/generate, pass the real `DATABASE_URL`/`GEMINI_API_KEY` directly (e.g. `source apps/news-app/.env.local`).
- **`url: ''` from `drizzle-kit` even after setting `DATABASE_URL`** — a stale **Nx daemon** is holding an old (empty) env. Run `npx nx reset`, or bypass Nx: `npx drizzle-kit migrate` / `npx tsx src/db/seed.ts` from `apps/news-app`.
- **Cron returns 401** — `CRON_SECRET` mismatch; redeploy after changing env vars so functions pick up the new value.
- **Daily cron never generates** — two independent causes: (1) `--prebuilt` deploys ignore `vercel.json`, so the `crons` must be injected into `.vercel/output/config.json` (handled by `scripts/deploy.sh`; check **Project → Settings → Cron Jobs** shows the job); (2) the endpoint must export a `GET` handler, since Vercel cron uses GET. See [§7](#7-cron-schedule).
- **Empty page on a fresh deploy** — no edition exists yet; run [§6](#6-generate-the-first-edition).
