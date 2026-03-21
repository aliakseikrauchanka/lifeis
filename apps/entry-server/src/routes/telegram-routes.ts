import { Router } from 'express';
import fs from 'fs';
import { createClient } from '@deepgram/sdk';
import { verifyTelegramBotKey, verifyTelegramChatId } from '../middlewares/verify-telegram-bot.middleware';
import { getFilePath, mp3FilePath, uploadMiddlewareFactory } from '../utils/audio-upload';
import { convertFile } from '../utils/ffmpeg-converter';
import { safeUnlink } from '../helpers/fs';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const routes = Router();

routes.post(
  '/transcribe',
  verifyTelegramBotKey,
  verifyTelegramChatId,
  uploadMiddlewareFactory.single('audio'),
  async (req, res) => {
    const languageParam = (req.query.language as string) || '';
    const hasExplicitLanguage = !!languageParam?.trim();

    const transcribeFile = async (filePath: string) => {
      const options: Parameters<typeof deepgram.listen.prerecorded.transcribeFile>[1] = {
        model: 'nova-3',
        smart_format: true,
        detect_language: !hasExplicitLanguage,
      };
      if (hasExplicitLanguage) {
        options.language = languageParam.trim();
      }

      const { result, error } = await deepgram.listen.prerecorded.transcribeFile(fs.readFileSync(filePath), options);

      if (error) throw error;
      return result;
    };

    const mime = req.headers.mime as string;
    if (!mime) {
      return res.status(400).json({ error: 'MIME header required' });
    }

    const filePath = getFilePath(mime);

    try {
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({ error: 'No audio file uploaded' });
      }

      let transcript = '';

      if (mime === 'audio/mp3;' || mime === 'audio/mpeg') {
        const result = await transcribeFile(filePath);
        transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
        safeUnlink(filePath);
      } else {
        const filePathMp3 = mp3FilePath;
        await new Promise<void>((resolve, reject) => {
          convertFile(filePath, filePathMp3, async () => {
            try {
              const result = await transcribeFile(filePathMp3);
              transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
            } catch (e) {
              reject(e);
              return;
            } finally {
              safeUnlink(filePath);
              safeUnlink(filePathMp3);
            }
            resolve();
          });
        });
      }

      res.json({ transcript });
    } catch (err) {
      console.error('[Telegram transcribe] Error:', err);
      safeUnlink(filePath);
      res.status(500).json({
        error: 'Transcription failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  },
);

export default routes;
