/**
 * sjp.pwn.pl Dictionary Scraper
 *
 * Scrapes the aggregator page https://sjp.pwn.pl/slowniki/<word>.html, which embeds — for
 * free, no login — the headword (base form), definitions, inflection, synonyms, etymology
 * and corpus examples for a Polish word. Parsing is done with jsdom against stable anchors
 * (`.znacz`, `.tytul .anchor-title`, `/slowniki/<syn>` synonym links, guillemet etymology).
 */
import { JSDOM } from 'jsdom';

export interface PwnDictionaryEntry {
  /** Base / initial form (lemma) of the word, as listed by PWN. */
  headword: string | null;
  /** Short inflection line, e.g. "kasować -suję, -sują". */
  inflection: string | null;
  /** Numbered dictionary senses. */
  definitions: string[];
  /** Synonyms listed on the aggregator page. */
  synonyms: string[];
  /** Etymology note, e.g. "‹łac. casso›". */
  etymology: string | null;
  /** Corpus usage examples (best-effort; PWN shows fragments). */
  examples: string[];
  /** Canonical PWN page for the word. */
  sourceUrl: string;
}

const BASE_URL = 'https://sjp.pwn.pl';
const MAX_DEFINITIONS = 15;
const MAX_SYNONYMS = 20;
const MAX_EXAMPLES = 5;
const MAX_FIELD_LENGTH = 600;

export interface PwnScraperConfig {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

function clean(s: string): string {
  return s
    .replace(/ /g, ' ') // &nbsp;
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(s: string, max = MAX_FIELD_LENGTH): string {
  return s.length > max ? s.slice(0, max) : s;
}

/** Builds the canonical aggregator URL for a word. */
export function pwnUrl(word: string): string {
  return `${BASE_URL}/slowniki/${encodeURIComponent(word.trim())}.html`;
}

/**
 * Parses the sjp.pwn.pl aggregator HTML into a structured entry.
 * Exported separately so it can be unit-tested against a saved fixture without network.
 * Returns null when the page has no usable dictionary content (e.g. "not found").
 */
export function parsePwnHtml(html: string, word: string): PwnDictionaryEntry | null {
  const doc = new JSDOM(html).window.document;

  // Headword: first dictionary title anchor.
  const titleEl = doc.querySelector('.tytul .anchor-title') ?? doc.querySelector('.tytul');
  const headword = titleEl?.textContent ? clean(titleEl.textContent) : null;

  // Definitions: <div class="znacz"><b>N.&nbsp;</b>«text»</div>. Strip number prefix and guillemets.
  const definitions: string[] = [];
  doc.querySelectorAll('.znacz').forEach((el) => {
    let text = clean(el.textContent ?? '');
    text = text.replace(/^\d+\.\s*/, '').replace(/^[«»]+|[«»]+$/g, '').trim();
    if (text.length >= 2 && definitions.length < MAX_DEFINITIONS) definitions.push(truncate(text));
  });

  // Synonyms: links to /slowniki/<syn> WITHOUT the ".html" suffix (related words use ".html").
  const synonyms: string[] = [];
  const seenSyn = new Set<string>();
  doc.querySelectorAll('a[href^="/slowniki/"]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (href.endsWith('.html')) return; // related words, not synonyms
    const text = clean(a.textContent ?? '');
    if (!text || /zobacz/i.test(text)) return; // generic "Zobacz w słowniku" links
    if (headword && text.toLocaleLowerCase() === headword.toLocaleLowerCase()) return;
    const key = text.toLocaleLowerCase();
    if (seenSyn.has(key)) return;
    seenSyn.add(key);
    if (synonyms.length < MAX_SYNONYMS) synonyms.push(truncate(text));
  });

  // Etymology: guillemet-wrapped note ‹...› anywhere in the body text.
  const bodyText = doc.body?.textContent ?? '';
  const etymMatch = bodyText.match(/‹[^›]+›/);
  const etymology = etymMatch ? truncate(clean(etymMatch[0])) : null;

  // Inflection: a span like "kasować -suję, -sują" — the lemma, whitespace, then a hyphen
  // directly attached to a lowercase ending. The hyphen-then-lowercase shape distinguishes
  // it from nav text such as "kasować - Znaczenie" (hyphen + space + capital).
  let inflection: string | null = null;
  if (headword) {
    const escaped = headword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const inflectionRe = new RegExp(`^${escaped}\\s+[-–]\\p{Ll}`, 'iu');
    const spans = Array.from(doc.querySelectorAll('span'));
    for (const span of spans) {
      const text = clean(span.textContent ?? '');
      if (inflectionRe.test(text) && !text.includes('‹') && text.length <= 120) {
        inflection = truncate(text);
        break;
      }
    }
  }

  // Examples: corpus fragments in `span.whitespace-pre-line`. Trim surrounding ellipses.
  const examples: string[] = [];
  doc.querySelectorAll('span.whitespace-pre-line').forEach((el) => {
    let text = clean(el.textContent ?? '');
    text = text.replace(/^[.…\s]+/, '').replace(/[.…\s]+$/, '').trim();
    if (text.length >= 5 && examples.length < MAX_EXAMPLES) examples.push(truncate(text));
  });

  // No usable content → treat as not found.
  if (
    !headword &&
    definitions.length === 0 &&
    synonyms.length === 0 &&
    !etymology &&
    examples.length === 0
  ) {
    return null;
  }

  return {
    headword,
    inflection,
    definitions,
    synonyms,
    etymology,
    examples,
    sourceUrl: pwnUrl(word),
  };
}

async function fetchHtml(url: string, timeout: number): Promise<{ ok: boolean; status: number; html: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    const html = response.ok ? await response.text() : '';
    return { ok: response.ok, status: response.status, html };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches and parses a Polish word from sjp.pwn.pl. Retries transient failures.
 * Returns the parsed entry, or null when the word isn't in the dictionary (404 / no content).
 */
export async function getPwnDictionaryEntry(
  word: string,
  config: PwnScraperConfig = {},
): Promise<PwnDictionaryEntry | null> {
  const trimmed = word.trim();
  if (!trimmed) return null;

  const maxRetries = config.maxRetries ?? 3;
  const retryDelay = config.retryDelay ?? 1500;
  const timeout = config.timeout ?? 15000;
  const url = pwnUrl(trimmed);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { ok, status, html } = await fetchHtml(url, timeout);
      if (status === 404) return null;
      if (!ok) throw new Error(`HTTP ${status}`);
      return parsePwnHtml(html, trimmed);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }
  throw lastError ?? new Error('Failed to fetch PWN dictionary entry');
}
