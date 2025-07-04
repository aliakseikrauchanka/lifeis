import express, { json, urlencoded } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import RateLimit from 'express-rate-limit';

import { verifyAccessToken } from './middlewares/verify-access.middleware';

import authRoutes from './routes/auth-routes';
import { createLogsRoutes } from './routes/logs-routes';
import { createGeminiRoutes } from './routes/gemini-routes';
import openaiRoutes from './routes/openai-routes';

import { getMongoDbClient } from './db';
import insightsRoutes from './routes/insights-routes';
import { createAgentsRoutes } from './routes/agents-routes';
import deepgramRoutes from './routes/deepgram-routes';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getBasketRoutes } from './routes/baskets-routes';
import OpenAI from 'openai';

// create mongo db client
const client = getMongoDbClient();

// create gemini model
const genAi = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const defaultGeminiModel = genAi.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
const openAiModel = new OpenAI();

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

// Set up rate limiter: maximum of twenty requests per minute
const limiter = RateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 150,
  validate: { xForwardedForHeader: false },
});
app.use(limiter);
app.use(compression());
app.use(
  cors({
    origin: [
      'https://lifeis-agents.vercel.app',
      'https://lifeis-logs.vercel.app',
      'http://localhost:4203',
      'http://localhost:4204',
      'https://qsl13trb-80.euw.devtunnels.ms',
    ],
    optionsSuccessStatus: 200,
  }),
);
app.use(json({ limit: '10mb' }));
app.use(urlencoded({ extended: true, limit: '10mb' }));
app.use(helmet());

app.use('/api/auth', authRoutes);
app.use('/api/logs', createLogsRoutes(client, defaultGeminiModel));
app.use('/api/agents/', createAgentsRoutes(client, genAi, openAiModel));
app.use('/api/insights', insightsRoutes);
app.use('/api/gemini', createGeminiRoutes(defaultGeminiModel));
app.use('/api/openai', openaiRoutes);
app.use('/api/deepgram', deepgramRoutes);
app.use('/api/baskets', getBasketRoutes(client));

app.get('/api/ping', verifyAccessToken, (req, res) => {
  res.send({ message: 'pong' });
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
