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

interface TelegramDocument {
  file_id: string;
  mime_type?: string;
  file_size?: number;
  file_name?: string;
}

interface ImageSource {
  fileId: string;
  mimeType: string;
  fileSize?: number;
  filename: string;
}

function getImageSource(msg: Record<string, unknown>): ImageSource | null {
  if (!msg || typeof msg !== 'object') return null;

  if ('photo' in msg && Array.isArray(msg.photo) && msg.photo.length > 0) {
    const photos = msg.photo as PhotoSize[];
    const largest = photos.reduce((max, p) => (p.width * p.height > max.width * max.height ? p : max));
    return { fileId: largest.file_id, mimeType: 'image/jpeg', filename: 'image.jpg' };
  }

  if ('document' in msg && msg.document && typeof msg.document === 'object') {
    const doc = msg.document as TelegramDocument;
    if (doc.file_id && doc.mime_type?.startsWith('image/')) {
      return {
        fileId: doc.file_id,
        mimeType: doc.mime_type,
        fileSize: doc.file_size,
        filename: doc.file_name || `image.${doc.mime_type.split('/')[1] || 'jpg'}`,
      };
    }
  }

  return null;
}

export async function handleImage(ctx: Context) {
  const msg = ctx.message ?? ctx.channelPost;
  const source = msg ? getImageSource(msg as unknown as Record<string, unknown>) : null;
  if (!source) {
    return;
  }

  const chatId = msg!.chat.id;

  if (typeof source.fileSize === 'number' && source.fileSize > MAX_IMAGE_BYTES) {
    await ctx.reply(`Image too large (${source.fileSize} bytes). Limit: ${MAX_IMAGE_BYTES} bytes.`);
    return;
  }

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
    const file = await ctx.telegram.getFile(source.fileId);
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
      filename: source.filename,
      contentType: source.mimeType,
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
