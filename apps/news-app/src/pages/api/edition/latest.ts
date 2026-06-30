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
