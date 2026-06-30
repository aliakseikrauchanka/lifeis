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
