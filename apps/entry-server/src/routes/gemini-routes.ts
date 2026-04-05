import { GenerativeModel } from '@google/generative-ai';
import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';

export const createGeminiRoutes = (geminiModel: GenerativeModel) => {
  async function getGeminiTranslationToPolish(text: string) {
    // The Gemini 1.5 models are versatile and work with both text-only and multimodal prompts
    const prompt = `Translate to polish: ${text}`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  const routes = Router();

  routes.post('/translate-to-polish', verifyAccessToken, async (req, res) => {
    const translation = await getGeminiTranslationToPolish(req.body.message);
    res.send({ translation });
  });

  // SECURITY FIX: Allowlist for BCP-47 language codes accepted by the TTS endpoint.
  // Without this, an attacker could inject an arbitrary string into the Google TTS
  // API request body via the ?l= query parameter.
  const ALLOWED_TTS_LANGUAGE_CODES = new Set([
    'ru-RU', 'en-US', 'en-GB', 'lt-LT', 'pl-PL', 'de-DE', 'fr-FR', 'es-ES',
    'uk-UA', 'zh-CN', 'ja-JP', 'ko-KR', 'it-IT', 'pt-BR', 'pt-PT', 'nl-NL',
  ]);

  routes.post('/text-to-speech', verifyAccessToken, async (req, res) => {
    const rawLang = (req.query.l as string) || 'ru-RU';

    // SECURITY FIX: Validate language code against an allowlist before use.
    if (!ALLOWED_TTS_LANGUAGE_CODES.has(rawLang)) {
      return res.status(400).json({ error: 'Unsupported language code' });
    }
    const languageCode = rawLang;

    // SECURITY FIX: Validate message is a non-empty string and cap its length to
    // prevent token-stuffing / cost abuse on the Google TTS API.
    const message = req.body.message;
    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'message must be a non-empty string' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'message exceeds maximum length of 2000 characters' });
    }

    const raw = JSON.stringify({
      input: {
        text: message,
      },
      voice: {
        languageCode: languageCode === 'lt-LT' ? `${languageCode}-Wavenet-A` : languageCode,
        // ssmlGender: 'NEUTRAL',
      },
      audioConfig: {
        audioEncoding: 'MP3',
      },
    });

    const requestOptions = {
      method: 'POST',
      body: raw,
    };

    const url = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + process.env.GOOGLE_CLOUD_API_KEY;

    try {
      const respone = await fetch(url, requestOptions);
      const responseJson = await respone.json();
      res.send(responseJson);
    } catch (e) {
      console.error('error', e);
      res.send({ error: e }).status(500);
    }
  });

  return routes;
};
