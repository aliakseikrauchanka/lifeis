import { DEFAULT_TRANSCRIPTION_DAILY_LIMIT } from './constants';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    if (name === 'TELEGRAM_BOT_TOKEN') {
      throw new Error(
        `Missing TELEGRAM_BOT_TOKEN. Get it from @BotFather on Telegram: open Telegram → search @BotFather → /newbot → follow prompts. See apps/telegram-bot/SETUP.md`
      );
    }
    if (name === 'TELEGRAM_BOT_API_KEY') {
      throw new Error(
        `Missing TELEGRAM_BOT_API_KEY. Generate with: openssl rand -hex 32. Use same value in entry-server. See apps/telegram-bot/SETUP.md`
      );
    }
    throw new Error(`Missing required env: ${name}. See apps/telegram-bot/SETUP.md`);
  }
  return val;
}

function parseAllowedChatIds(): Set<number> | null {
  const raw = process.env.TELEGRAM_ALLOWED_CHAT_IDS?.trim();
  if (!raw) return null; // null = allow all
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));
  return ids.length > 0 ? new Set(ids) : null;
}

function parseDailyLimit(): number {
  const raw = process.env.TRANSCRIPTION_DAILY_LIMIT?.trim();
  if (!raw) return DEFAULT_TRANSCRIPTION_DAILY_LIMIT;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) || n < 0 ? DEFAULT_TRANSCRIPTION_DAILY_LIMIT : n;
}

export const config = {
  telegramBotToken: requireEnv('TELEGRAM_BOT_TOKEN'),
  telegramBotApiKey: requireEnv('TELEGRAM_BOT_API_KEY'),
  beUrl: requireEnv('BE_URL').replace(/\/$/, ''),
  language: process.env.TRANSCRIPTION_LANGUAGE || '',
  allowedChatIds: parseAllowedChatIds(),
  transcriptionDailyLimit: parseDailyLimit(),
};
