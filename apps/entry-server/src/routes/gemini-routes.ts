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

  return routes;
};
