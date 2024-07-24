import express, { json } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import RateLimit from 'express-rate-limit';

import { verifyAccessToken } from './middlewares/verify-access.middleware';

import authRoutes from './routes/auth-routes';
import { createLogsRoutes } from './routes/logs-routes';
import geminiRoutes from './routes/gemini-routes';
import openaiRoutes from './routes/openai-routes';

import { getMongoDbClient } from './db';
import insightsRoutes from './routes/insights-routes';
import { createAgentsRoutes } from './routes/agents-routes';

const client = getMongoDbClient();

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

// Set up rate limiter: maximum of twenty requests per minute
const limiter = RateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
  validate: { xForwardedForHeader: false },
});
app.use(limiter);
app.use(compression());
app.use(cors());
app.use(json());
app.use(helmet());

app.use('/api/auth', authRoutes);
app.use('/api/logs', createLogsRoutes(client));
app.use('/api/agents/', createAgentsRoutes(client));
app.use('/api/gemini', geminiRoutes);
app.use('/api/openai', openaiRoutes);
app.use('/api/insights', insightsRoutes);

app.get('/api/ping', verifyAccessToken, (req, res) => {
  res.send({ message: 'pong' });
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
