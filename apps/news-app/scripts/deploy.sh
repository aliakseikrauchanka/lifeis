#!/usr/bin/env bash
#
# Deploy news-app to Vercel production using the verified prebuilt flow.
#
# Vercel's remote build auto-detects Nx and produces an empty output (every route
# 404s), so we build locally and upload the prebuilt Build Output API result.
# The `--prebuilt` deploy looks for the output at the repo-root `.vercel/output`,
# so we copy it there first. See DEPLOY.md for the full rationale.
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

echo "==> Deploying prebuilt output to production..."
vercel deploy --prebuilt --prod "$@"
