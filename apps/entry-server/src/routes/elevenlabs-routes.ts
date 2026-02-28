import { Router } from 'express';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';

const routes = Router();

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

routes.get('/stt-token', verifyAccessToken, async (req, res) => {
  try {
    const token = await elevenlabs.tokens.singleUse.create('realtime_scribe');

    res.set({
      'Surrogate-Control': 'no-store',
      'Cache-Control': 's-maxage=0, no-store, no-cache, must-revalidate, proxy-revalidate',
      Expires: '0',
    });

    res.json(token);
  } catch {
    res.status(500).json({ error: 'Failed to create ElevenLabs token' });
  }
});

export default routes;
