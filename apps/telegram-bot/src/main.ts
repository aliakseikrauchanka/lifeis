import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { message, channelPost } from 'telegraf/filters';
import { handleVoice } from './handlers/voice-handler';
import { config } from './config';

const bot = new Telegraf(config.telegramBotToken);

bot.on(message('voice'), handleVoice);
bot.on(message('audio'), handleVoice);
bot.on(channelPost('voice'), handleVoice);
bot.on(channelPost('audio'), handleVoice);

// Retry bot.launch() on 409 Conflict. This happens during rolling deploys
// when the previous instance is still long-polling; Telegram only allows one
// getUpdates consumer per bot token, so we back off until the old session
// expires and then take over cleanly.
const MAX_LAUNCH_ATTEMPTS = 6;
const INITIAL_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

const isTelegramConflict = (err: unknown): boolean =>
  (err as { response?: { error_code?: number } })?.response?.error_code === 409;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function launchWithRetry(): Promise<void> {
  let delayMs = INITIAL_BACKOFF_MS;

  for (let attempt = 1; attempt <= MAX_LAUNCH_ATTEMPTS; attempt++) {
    try {
      // Best-effort: clear any webhook that may be set so polling can take over.
      await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {
        /* ignore — deleteWebhook is a safety net, not a requirement */
      });
      await bot.launch({ dropPendingUpdates: true });
      return;
    } catch (err) {
      if (!isTelegramConflict(err) || attempt === MAX_LAUNCH_ATTEMPTS) {
        throw err;
      }
      console.warn(
        `[telegram-bot] 409 Conflict on launch attempt ${attempt}/${MAX_LAUNCH_ATTEMPTS}. ` +
          `Another instance is still polling. Retrying in ${delayMs / 1000}s...`,
      );
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, MAX_BACKOFF_MS);
    }
  }
}

launchWithRetry()
  .then(() => {
    console.log('[telegram-bot] Bot is running');
  })
  .catch((err) => {
    console.error('[telegram-bot] Failed to launch after retries:', err);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
