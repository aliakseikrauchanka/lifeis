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

  routes.post('/text-to-speech', verifyAccessToken, async (req, res) => {
    const languageCode = req.query.l || 'ru-RU';
    const raw = JSON.stringify({
      input: {
        text: req.body.message,
      },
      voice: {
        languageCode,
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
