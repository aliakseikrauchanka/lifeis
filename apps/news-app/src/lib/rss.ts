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
