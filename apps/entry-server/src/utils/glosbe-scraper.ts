/**
 * Glosbe Dictionary Scraper
 * Safely scrapes translations from glosbe.com with rate limiting, retries, and error handling
 */

interface GlosbeScraperConfig {
  fromLang?: string; // Source language code (default: 'pl')
  toLang?: string; // Target language code (default: 'ru')
  maxRetries?: number; // Maximum retry attempts (default: 3)
  retryDelay?: number; // Delay between retries in ms (default: 2000)
  requestDelay?: number; // Delay between requests in ms (default: 1500)
  timeout?: number; // Request timeout in ms (default: 30000)
  maxTranslations?: number; // Maximum number of translations to return (default: 5)
}

interface ScrapeResult {
  success: boolean;
  translations: string[];
  error?: string;
  word?: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class RateLimiter {
  private lastRequestTime = 0;
  private minDelay: number;

  constructor(minDelayMs: number) {
    this.minDelay = minDelayMs;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

export class GlosbeScraper {
  private config: Required<GlosbeScraperConfig>;
  private rateLimiter: RateLimiter;
  private requestCount = 0;
  private readonly baseUrl = 'https://glosbe.com';

  constructor(config: GlosbeScraperConfig = {}) {
    this.config = {
      fromLang: config.fromLang ?? 'pl',
      toLang: config.toLang ?? 'ru',
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 2000,
      requestDelay: config.requestDelay ?? 1500,
      timeout: config.timeout ?? 30000,
      maxTranslations: config.maxTranslations ?? 5,
    };

    this.rateLimiter = new RateLimiter(this.config.requestDelay);
  }

  /**
   * Scrape translation from Glosbe
   */
  async scrapeTranslation(word: string): Promise<ScrapeResult> {
    if (!word || word.trim().length === 0) {
      return {
        success: false,
        translations: [],
        error: 'Word cannot be empty',
      };
    }

    const encodedWord = encodeURIComponent(word.trim());
    const url = `${this.baseUrl}/${this.config.fromLang}/${this.config.toLang}/${encodedWord}`;

    // Wait for rate limiting
    await this.rateLimiter.waitIfNeeded();

    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.fetchAndParse(url, word);
        this.requestCount++;
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Glosbe scrape attempt ${attempt}/${this.config.maxRetries} failed:`, lastError.message);

        // Don't retry on certain errors (like 404 or 403)
        if (error instanceof Error) {
          if (error.message.includes('404') || error.message.includes('403') || error.message.includes('429')) {
            return {
              success: false,
              translations: [],
              error: error.message,
              word,
            };
          }
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.config.maxRetries) {
          const backoffDelay = this.config.retryDelay * attempt;
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }

    return {
      success: false,
      translations: [],
      error: lastError?.message ?? 'Unknown error after retries',
      word,
    };
  }

  /**
   * Fetch and parse the Glosbe page
   */
  private async fetchAndParse(url: string, word: string): Promise<ScrapeResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            translations: [],
            error: `Translation not found for "${word}"`,
            word,
          };
        }
        if (response.status === 403 || response.status === 429) {
          throw new Error(`Access denied or rate limited (${response.status}). Please wait before trying again.`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const translations = this.parseTranslations(html);

      if (translations.length === 0) {
        return {
          success: false,
          translations: [],
          error: `No translations found for "${word}"`,
          word,
        };
      }

      return {
        success: true,
        translations: translations.slice(0, this.config.maxTranslations),
        word,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.config.timeout}ms`);
        }
        throw error;
      }

      throw new Error('Unknown error during fetch');
    }
  }

  /**
   * Strip simple HTML tags (Glosbe cells sometimes include nested markup).
   */
  private stripHtmlTags(s: string): string {
    return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Parse translations from HTML
   * Glosbe lists source (left) and target (right) columns; generic "phrase" regexes
   * were matching the Russian column even for ru→pl. We read the target column:
   * <div lang="{toLang}" ... dir-aware-pl-2 ...> (right cell in "similar phrases" rows).
   */
  private parseTranslations(html: string): string[] {
    const translations = new Set<string>();
    const to = this.config.toLang;

    // Primary: target-language cells in two-column phrase rows (padding class dir-aware-pl-2).
    const rowPattern = new RegExp(
      `<div(?=[^>]*\\blang="${escapeRegex(to)}"\\b)(?=[^>]*\\bdir-aware-pl-2\\b)[^>]*>([\\s\\S]*?)</div>`,
      'gi',
    );
    let m: RegExpExecArray | null;
    while ((m = rowPattern.exec(html)) !== null) {
      const inner = m[1] ?? '';
      if (/icon-loading|googleTranslate_container|glosbeTranslate_container/i.test(inner)) continue;
      const plain = this.stripHtmlTags(inner);
      if (!plain || plain.length < 2) continue;
      for (const chunk of plain.split(/[·•|\n\r]+/)) {
        const part = chunk.trim();
        if (part.length >= 2 && this.isValidTranslation(part)) translations.add(part);
      }
    }

    // Fallback: data-translation / class-based (only keep script-appropriate hits)
    if (translations.size === 0) {
      const translationPatterns = [
        /<span[^>]*data-translation="([^"]+)"[^>]*>/gi,
        /<div[^>]*data-translation="([^"]+)"[^>]*>/gi,
        /<[^>]*class="[^"]*translation[^"]*"[^>]*>([^<]+)<\/[^>]+>/gi,
      ];
      for (const pattern of translationPatterns) {
        const matches = Array.from(html.matchAll(pattern));
        for (const match of matches) {
          const text = match[1]?.trim();
          if (text && this.isValidTranslation(text)) translations.add(text);
        }
      }
    }

    // Last resort: Russian-like segments only when the target language is Russian
    if (translations.size === 0 && to === 'ru') {
      const russianTextPattern = /[А-Яа-яЁё][А-Яа-яЁё\s,.-]{2,}/g;
      const russianMatches = html.match(russianTextPattern);
      if (russianMatches) {
        const filtered = russianMatches
          .map((text) => text.trim())
          .filter((text) => {
            if (text.length > 50) return false;
            const commonWords = ['словарь', 'перевод', 'пример', 'язык', 'глосбе', 'поиск'];
            return !commonWords.some((word) => text.toLowerCase().includes(word));
          })
          .slice(0, this.config.maxTranslations * 2);

        filtered.forEach((text) => translations.add(text));
      }
    }

    return Array.from(translations);
  }

  /**
   * Validate if a string is a valid translation for the requested target language
   */
  private isValidTranslation(text: string): boolean {
    if (!text || text.length < 2) return false;
    if (text.startsWith('<') || text.startsWith('&')) return false;

    const hasLatin = /\p{Script=Latin}/u.test(text);
    const hasCyrillic = /\p{Script=Cyrillic}/u.test(text);

    switch (this.config.toLang) {
      case 'ru':
        return hasCyrillic;
      case 'sr':
        return hasLatin || hasCyrillic;
      default:
        // pl, en, de, fr, fi, es — reject pure Cyrillic (usually leaked source column)
        if (hasCyrillic && !hasLatin) return false;
        return /\p{L}/u.test(text);
    }
  }

  /**
   * Get request statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      config: this.config,
    };
  }

  /**
   * Reset request counter
   */
  resetStats() {
    this.requestCount = 0;
  }
}

/**
 * Convenience function to create a scraper and get translation
 */
export async function getGlosbeTranslation(word: string, config?: GlosbeScraperConfig): Promise<ScrapeResult> {
  const scraper = new GlosbeScraper(config);
  return scraper.scrapeTranslation(word);
}
