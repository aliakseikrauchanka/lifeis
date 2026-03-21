import { Context } from 'telegraf';
import FormData from 'form-data';
import https from 'https';
import axios from 'axios';
import { config } from '../config';
import { tryConsume } from '../lib/daily-rate-limit';
import { MAX_AUDIO_BYTES } from '../constants';

function getVoiceOrAudioFileId(msg: Record<string, unknown>): string | null {
  if (msg && typeof msg === 'object') {
    if ('voice' in msg && msg.voice && typeof msg.voice === 'object' && 'file_id' in msg.voice) {
      return (msg.voice as { file_id: string }).file_id;
    }
    if ('audio' in msg && msg.audio && typeof msg.audio === 'object' && 'file_id' in msg.audio) {
      return (msg.audio as { file_id: string }).file_id;
    }
  }
  return null;
}

export async function handleVoice(ctx: Context) {
  const msg = ctx.message ?? ctx.channelPost;
  const fileId = msg ? getVoiceOrAudioFileId(msg as unknown as Record<string, unknown>) : null;
  if (!fileId) {
    return;
  }

  const chatId = msg!.chat.id;

  if (config.allowedChatIds && !config.allowedChatIds.has(chatId)) {
    await ctx.reply(`This chat is not allowed to use transcription. Chat ID: ${chatId}, allowed chat IDs: ${Array.from(config.allowedChatIds).join(', ')}`);
    return;
  }

  const limit = config.transcriptionDailyLimit;
  if (limit > 0 && !tryConsume(chatId, limit)) {
    await ctx.reply(
      `Daily limit reached (${limit} transcription${limit === 1 ? '' : 's'} per day). Resets at midnight UTC.`
    );
    return;
  }

  const statusMsg = await ctx.reply('Transcribing...');

  try {
    const botToken = config.telegramBotToken;
    const file = await ctx.telegram.getFile(fileId);
    const filePath = file.file_path;
    if (!filePath) {
      throw new Error('Could not get file path');
    }

    const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
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
    form.append('audio', audioBuffer, {
      filename: 'voice.ogg',
      contentType: 'audio/ogg',
    });

    const transcribeUrl = `${config.beUrl}/api/telegram/transcribe${config.language ? `?language=${encodeURIComponent(config.language)}` : ''}`;

    const response = await axios.post(transcribeUrl, form, {
      headers: {
        ...form.getHeaders(),
        MIME: 'audio/ogg',
        Authorization: `Bearer ${config.telegramBotApiKey}`,
        'X-Telegram-Chat-Id': String(chatId),
      },
      maxBodyLength: MAX_AUDIO_BYTES,
      maxContentLength: MAX_AUDIO_BYTES,
    });

    const { transcript } = response.data as { transcript?: string };

    await ctx.telegram.editMessageText(
      chatId,
      statusMsg.message_id,
      undefined,
      transcript?.trim() || '(Empty transcription)'
    );
  } catch (err) {
    console.error(err);
    const message =
      axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message
        : err instanceof Error
          ? err.message
          : 'Transcription failed';
    await ctx.telegram.editMessageText(
      chatId,
      statusMsg.message_id,
      undefined,
      `Error: ${message}`
    );
  }
}
