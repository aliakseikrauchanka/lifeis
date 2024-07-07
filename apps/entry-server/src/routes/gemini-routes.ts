import { GoogleGenerativeAI } from '@google/generative-ai';
import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

export default routes;
