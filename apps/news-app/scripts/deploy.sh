#!/usr/bin/env bash
#
# Deploy news-app to Vercel production using the verified prebuilt flow.
#
# Vercel's remote build auto-detects Nx and produces an empty output (every route
# 404s), so we build locally and upload the prebuilt Build Output API result.
# The `--prebuilt` deploy looks for the output at the repo-root `.vercel/output`,
# so we copy it there first. See DEPLOY.md for the full rationale.
#
# A `--prebuilt` deploy ALSO ignores `vercel.json`, so the `crons` defined there
# are never registered unless we inject them into the Build Output config.json.
# Without this step the daily generation cron is silently dropped. We copy the
# crons from apps/news-app/vercel.json so it stays the single source of truth.
#
# Usage: apps/news-app/scripts/deploy.sh [extra vercel flags, e.g. --yes]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

echo "==> Building news-app locally (nx build)..."
npx nx build news-app

echo "==> Staging build output at repo-root .vercel/output..."
rm -rf .vercel/output
cp -R apps/news-app/.vercel/output .vercel/output

echo "==> Injecting crons into prebuilt config.json (--prebuilt ignores vercel.json)..."
node -e '
  const fs = require("fs");
  const outPath = ".vercel/output/config.json";
  const vercelJson = JSON.parse(fs.readFileSync("apps/news-app/vercel.json", "utf8"));
  const crons = vercelJson.crons || [];
  const cfg = JSON.parse(fs.readFileSync(outPath, "utf8"));
  cfg.crons = crons;
  fs.writeFileSync(outPath, JSON.stringify(cfg, null, 2) + "\n");
  console.log("    registered crons:", JSON.stringify(crons));
'

echo "==> Deploying prebuilt output to production..."
vercel deploy --prebuilt --prod "$@"
