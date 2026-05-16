import { Context } from 'telegraf';
import FormData from 'form-data';
import https from 'https';
import axios from 'axios';
import { config } from '../config';
import { tryConsume } from '../lib/daily-rate-limit';
import { MAX_IMAGE_BYTES } from '../constants';

interface PhotoSize {
  file_id: string;
  width: number;
  height: number;
}

function getLargestPhotoFileId(msg: Record<string, unknown>): string | null {
  if (!msg || typeof msg !== 'object' || !('photo' in msg) || !Array.isArray(msg.photo)) {
    return null;
  }
  const photos = msg.photo as PhotoSize[];
  if (photos.length === 0) return null;
  const largest = photos.reduce((max, p) => (p.width * p.height > max.width * max.height ? p : max));
  return largest.file_id;
}

export async function handleImage(ctx: Context) {
  const msg = ctx.message ?? ctx.channelPost;
  const fileId = msg ? getLargestPhotoFileId(msg as unknown as Record<string, unknown>) : null;
  if (!fileId) {
    return;
  }

  const chatId = msg!.chat.id;

  if (config.allowedChatIds && !config.allowedChatIds.has(chatId)) {
    await ctx.reply(
      `This chat is not allowed. Chat ID: ${chatId}, allowed chat IDs: ${Array.from(config.allowedChatIds).join(', ')}`,
    );
    return;
  }

  const limit = config.transcriptionDailyLimit;
  if (limit > 0 && !tryConsume(chatId, limit)) {
    await ctx.reply(
      `Daily limit reached (${limit} request${limit === 1 ? '' : 's'} per day). Resets at midnight UTC.`,
    );
    return;
  }

  const statusMsg = await ctx.reply('Reading image...');

  try {
    const botToken = config.telegramBotToken;
    const file = await ctx.telegram.getFile(fileId);
    const filePath = file.file_path;
    if (!filePath) {
      throw new Error('Could not get file path');
    }

    const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
      https
        .get(url, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        })
        .on('error', reject);
    });

    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg',
    });

    const parseUrl = `${config.beUrl}/api/telegram/parse-image`;

    const response = await axios.post(parseUrl, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${config.telegramBotApiKey}`,
        'X-Telegram-Chat-Id': String(chatId),
      },
      maxBodyLength: MAX_IMAGE_BYTES,
      maxContentLength: MAX_IMAGE_BYTES,
    });

    const { text, translation } = response.data as { text?: string; translation?: string };
    const cleanText = text?.trim() ?? '';
    const cleanTranslation = translation?.trim() ?? '';

    let reply: string;
    if (!cleanText) {
      reply = '(No text detected)';
    } else if (cleanTranslation) {
      reply = `${cleanText}\n\n--- Polish ---\n${cleanTranslation}`;
    } else {
      reply = cleanText;
    }

    await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, reply);
  } catch (err) {
    console.error(err);
    const message =
      axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message
        : err instanceof Error
          ? err.message
          : 'Image parsing failed';
    await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `Error: ${message}`);
  }
}
