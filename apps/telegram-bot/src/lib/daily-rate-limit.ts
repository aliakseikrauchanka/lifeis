const store = new Map<string, { count: number; date: string }>();

function getTodayUtc(): string {
  return new Date().toISOString().slice(0, 10); // "2025-03-21"
}

/**
 * Check if chat can transcribe and consume one from quota.
 * Returns true if allowed, false if limit exceeded.
 */
export function tryConsume(chatId: number, limit: number): boolean {
  if (limit <= 0) return true; // 0 or negative = unlimited

  const key = String(chatId);
  const today = getTodayUtc();
  const entry = store.get(key);

  if (!entry || entry.date !== today) {
    store.set(key, { count: 1, date: today });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

/**
 * Get remaining transcriptions for a chat today (without consuming).
 */
export function getRemaining(chatId: number, limit: number): number {
  if (limit <= 0) return Infinity;

  const key = String(chatId);
  const today = getTodayUtc();
  const entry = store.get(key);

  if (!entry || entry.date !== today) {
    return limit;
  }

  return Math.max(0, limit - entry.count);
}
