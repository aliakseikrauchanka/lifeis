import { Context } from 'telegraf';
import axios from 'axios';
import { config } from '../config';
import { tryConsume } from '../lib/daily-rate-limit';

export async function handleText(ctx: Context) {
  const msg = ctx.message ?? ctx.channelPost;
  if (!msg || !('text' in msg) || typeof msg.text !== 'string') return;
  if ('from' in msg && msg.from?.is_bot) return;

  const text = msg.text.trim();
  if (!text || text.startsWith('/')) return;

  const chatId = msg.chat.id;

  if (config.allowedChatIds && !config.allowedChatIds.has(chatId)) return;

  const limit = config.transcriptionDailyLimit;
  if (limit > 0 && !tryConsume(chatId, limit)) return;

  try {
    const response = await axios.post(
      `${config.beUrl}/api/telegram/translate-text`,
      { text },
      {
        headers: {
          Authorization: `Bearer ${config.telegramBotApiKey}`,
          'X-Telegram-Chat-Id': String(chatId),
        },
      },
    );

    const data = response.data as {
      language?: 'pl' | 'other';
      corrected?: string;
      russian?: string;
      explanation?: string;
      polish?: string;
    };

    let reply = '';
    if (data.language === 'pl') {
      const corrected = data.corrected?.trim() ?? '';
      const russian = data.russian?.trim() ?? '';
      const explanation = data.explanation?.trim() ?? '';
      const parts: string[] = [];
      if (corrected) parts.push(corrected);
      if (russian) parts.push(`--- Russian ---\n${russian}`);
      if (explanation) parts.push(`--- Explanation ---\n${explanation}`);
      reply = parts.join('\n\n');
    } else {
      reply = data.polish?.trim() ?? '';
    }

    if (!reply) return;

    await ctx.reply(reply, { reply_parameters: { message_id: msg.message_id } });
  } catch (err) {
    console.error('[text-handler] translation failed:', err);
  }
}
