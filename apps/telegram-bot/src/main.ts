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
//
// NOTE: In Telegraf v4, bot.launch() does not resolve on successful start —
// it awaits the polling loop and only resolves/rejects when the bot stops or
// the loop errors. So we race the launch promise against a short "looks
// healthy" timeout: if it hasn't rejected within STARTUP_GRACE_MS, we treat
// it as a successful launch.
const MAX_LAUNCH_ATTEMPTS = 6;
const INITIAL_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;
const STARTUP_GRACE_MS = 3_000;

const isTelegramConflict = (err: unknown): boolean =>
  (err as { response?: { error_code?: number } })?.response?.error_code === 409;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function launchWithRetry(): Promise<void> {
  let delayMs = INITIAL_BACKOFF_MS;

  for (let attempt = 1; attempt <= MAX_LAUNCH_ATTEMPTS; attempt++) {
    // Best-effort: clear any webhook that may be set so polling can take over.
    await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {
      /* ignore — deleteWebhook is a safety net, not a requirement */
    });

    // Kick off launch but do NOT await it — it never resolves on success.
    // Capture the promise so we can detect early rejections and attach a
    // long-lived error handler after startup.
    const launchPromise = bot.launch({ dropPendingUpdates: true });

    // Swallow unhandled rejection warnings; we handle errors explicitly below.
    launchPromise.catch(() => {
      /* handled via race/background handler */
    });

    const startupOutcome = await Promise.race<'ok' | { error: unknown }>([
      launchPromise.then(() => 'ok' as const).catch((error) => ({ error })),
      sleep(STARTUP_GRACE_MS).then(() => 'ok' as const),
    ]);

    if (startupOutcome === 'ok') {
      // Launch is running (or already stopped cleanly). Attach a background
      // handler so late-arriving errors still crash the process and let
      // Railway restart us.
      launchPromise.catch((err) => {
        console.error('[telegram-bot] Polling loop crashed:', err);
        process.exit(1);
      });
      return;
    }

    const err = startupOutcome.error;
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
