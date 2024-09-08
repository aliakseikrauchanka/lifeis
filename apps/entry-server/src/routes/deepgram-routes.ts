import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { getFilePath, mp3FilePath, uploadMiddlewareFactory } from '../utils/audio-upload';
import fs, { unlinkSync } from 'fs';
import { convertFile } from '../utils/ffmpeg-converter';

import { createClient, DeepgramError } from '@deepgram/sdk';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const routes = Router();

routes.get('/authenticate', async (req, res) => {
  // exit early so we don't request 70000000 keys while in devmode
  console.log('ENV', process.env.ENV);
  if (process.env.ENV === 'development') {
    return res.json({
      key: process.env.DEEPGRAM_API_KEY ?? '',
    });
  }

  const url = req.url;

  try {
    const { result: projectsResult } = await deepgram.manage.getProjects();

    const project = projectsResult?.projects[0];

    if (!project) {
      return res.json(new DeepgramError('Cannot find a Deepgram project. Please create a project first.'));
    }

    const { result: newKeyResult } = await deepgram.manage.createProjectKey(project.project_id, {
      comment: 'Temporary API key',
      scopes: ['usage:write'],
      tags: ['express'],
      time_to_live_in_seconds: 60,
    });

    console.log({ newKeyResult });

    res.set({
      'Surrogate-Control': 'no-store',
      'Cache-Control': 's-maxage=0, no-store, no-cache, must-revalidate, proxy-revalidate',
      Expires: '0',
    });

    res.json({ ...newKeyResult, url });
  } catch (error) {
    res.json(error);
  }
});

routes.post('/transcribe', verifyAccessToken, uploadMiddlewareFactory.single('audio'), async (req, res) => {
  const transcribeFile = async (filePath: string) => {
    // STEP 1: Create a Deepgram client using the API key

    // STEP 2: Call the transcribeFile method with the audio payload and options
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      // path to the audio file
      fs.readFileSync(filePath),
      // STEP 3: Configure Deepgram options for audio analysis
      {
        model: 'nova-2',
        smart_format: true,
        language: 'ru',
        detect_language: true,
      },
    );

    if (error) throw error;
    // STEP 4: Return the results
    if (!error) return result;
  };

  const filePath = getFilePath(req.headers.mime);
  const stats = fs.statSync(filePath);
  console.log(`File size is of ${filePath} is ${stats.size} bytes`);

  if (req.headers.mime === 'audio/mp3;') {
    const translation = await transcribeFile(filePath);
    unlinkSync(filePath);
    res.send(translation);
  }

  const filePathMp3 = mp3FilePath;
  convertFile(filePath, filePathMp3, () => {
    async function main() {
      const translation = await transcribeFile(filePathMp3);
      unlinkSync(filePath);
      res.send(translation);
    }

    main();
  });
});

export default routes;
