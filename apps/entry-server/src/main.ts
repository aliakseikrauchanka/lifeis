import express, { json } from 'express';
import cors from 'cors';

import { verifyAccessToken } from './hooks/verify-access.middleware';

import authRoutes from './routes/auth-routes';
import geminiRoutes from './routes/gemini-routes';
import openaiRoutes from './routes/openai-routes';
import { createLogsRoutes } from './routes/logs-routes';

import { getMongoDbClient } from './db';

const client = getMongoDbClient();

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
app.use(cors());
app.use(json());

app.use('/api/auth', authRoutes);
app.use('/api/logs', createLogsRoutes(client));
app.use('/api/gemini', geminiRoutes);
app.use('/api/openai', openaiRoutes);

app.get('/api/ping', verifyAccessToken, (req, res) => {
  res.send({ message: 'pong' });
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
