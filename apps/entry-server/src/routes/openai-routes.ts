import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { getFilePath, mp3FilePath, uploadMiddlewareFactory } from '../utils/audio-upload';
import { Translation } from 'openai/resources/audio/translations';
import fs, { unlinkSync } from 'fs';
import { convertFile } from '../utils/ffmpeg-converter';
import OpenAI from 'openai';

const routes = Router();
const openai = new OpenAI();

routes.post('/transcribe', verifyAccessToken, uploadMiddlewareFactory.single('audio'), async (req, res) => {
  const sendFileToTransribeOpenAI = async (filePath: string): Promise<Translation> => {
    const transcription = await openai.audio.translations.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
    });
    // remove files
    unlinkSync(filePath);
    return transcription;
  };

  const filePath = getFilePath(req.headers.mime);
  const stats = fs.statSync(filePath);
  console.log(`File size is of ${filePath} is ${stats.size} bytes`);

  if (req.headers.mime === 'audio/mp3;') {
    const translation = await sendFileToTransribeOpenAI(filePath);
    unlinkSync(filePath);
    res.send(translation);
  }
  const filePathMp3 = mp3FilePath;
  convertFile(filePath, filePathMp3, () => {
    async function main() {
      const translation = await sendFileToTransribeOpenAI(filePathMp3);
      unlinkSync(filePath);
      res.send(translation);
    }

    main();
  });
});

routes.post('/describe-image', verifyAccessToken, async (req, res) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe ingridients (just names) that are used in this meal in numerated list ranged by weight, no additional description required',
          },
          {
            type: 'image_url',
            image_url: {
              url: 'https://images.immediate.co.uk/production/volatile/sites/30/2013/05/Aubergine-and-sesame-noodles-6138de6.jpg',
            },
          },
        ],
      },
    ],
  });

  res.status(200).send(response);
});

// OpenAI Assistant API
const assistantId = 'asst_xH1h4HyWEFulGnBrltEAGaJ9';
routes.post('/check-polish-grammar', verifyAccessToken, async (req, res) => {
  // const openai = new OpenAI();

  const message = req.body.message;

  // const newMessage = await openai.beta.threads.messages.create(
  //   threadId,
  //   { role: "user", content: message }
  // );

  // make run on latest message
  // await openai.beta.threads.runs.create(
  //   threadId,
  //   { assistant_id: assistantId }
  // );

  const run = await openai.beta.threads.createAndRun({
    assistant_id: assistantId,
    thread: {
      messages: [{ role: 'user', content: message }],
    },
  });

  res.status(200).send({ runId: run.id, threadId: run.thread_id });
});

routes.get('/thread/run', verifyAccessToken, async (req, res) => {
  const threadId = req.query.threadId as string;
  const runId = req.query.runId as string;
  try {
    const run = await openai.beta.threads.runs.retrieve(threadId, runId);
    res.status(200).send(run);
  } catch (e) {
    console.log('error happened', e);
  }
});

routes.get('/thread/messages', verifyAccessToken, async (req, res) => {
  const threadId = req.query.threadId as string;

  const messages = await openai.beta.threads.messages.list(threadId);

  res.status(200).send({ messages: messages.data.map((message) => message.content) });
});

export default routes;
