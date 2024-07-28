import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { getFilePath, mp3FilePath, uploadMiddlewareFactory } from '../utils/audio-upload';
import fs, { unlinkSync } from 'fs';
import { convertFile } from '../utils/ffmpeg-converter';

import { createClient } from '@deepgram/sdk';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const routes = Router();

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
