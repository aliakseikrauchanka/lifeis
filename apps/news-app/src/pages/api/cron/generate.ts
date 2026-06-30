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

const handler: APIRoute = async ({ request }) => {
  if (!authorized(request)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const res = await generateEdition({ trigger: 'cron' });
  return new Response(JSON.stringify(res), {
    status: res.status === 'failed' ? 500 : 200,
    headers: { 'content-type': 'application/json' },
  });
};

// Vercel Cron invokes the path with GET (and auto-adds the CRON_SECRET bearer);
// POST is kept for manual triggering. Both share the same authorized handler.
export const GET = handler;
export const POST = handler;
