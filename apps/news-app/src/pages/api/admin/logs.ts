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
