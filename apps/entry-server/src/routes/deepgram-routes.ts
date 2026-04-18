import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { getFilePath, mp3FilePath, uploadMiddlewareFactory } from '../utils/audio-upload';
import fs from 'fs';
import { convertFile } from '../utils/ffmpeg-converter';

import { createClient, DeepgramError } from '@deepgram/sdk';
import { safeUnlink } from '../helpers/fs';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const routes = Router();

routes.get('/authenticate', verifyAccessToken, async (req, res) => {
  // exit early so we don't request 70000000 keys while in devmode
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

    res.set({
      'Surrogate-Control': 'no-store',
      'Cache-Control': 's-maxage=0, no-store, no-cache, must-revalidate, proxy-revalidate',
      Expires: '0',
    });

    res.json({ ...newKeyResult, url });
  } catch (_error) {
    console.error('Failed to create Deepgram temporary key', _error);
    res.status(500).json({ error: 'Failed to create Deepgram temporary key' });
  }
});

routes.post('/transcribe', verifyAccessToken, uploadMiddlewareFactory.single('audio'), async (req, res) => {
  const languageParam = req.query.language as string | undefined;
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
    if (!error) return result;
  };

  const filePath = getFilePath(req.headers.mime);
  const stats = fs.statSync(filePath);
  console.log(`File size is of ${filePath} is ${stats.size} bytes`);

  if (req.headers.mime === 'audio/mp3;') {
    const translation = await transcribeFile(filePath);
    safeUnlink(filePath);
    return res.send(translation);
  }

  const filePathMp3 = mp3FilePath;
  convertFile(filePath, filePathMp3, () => {
    async function main() {
      const translation = await transcribeFile(filePathMp3);
      res.send(translation);
      safeUnlink(filePath);
      safeUnlink(filePathMp3);
    }

    main();
  });
});

export default routes;
