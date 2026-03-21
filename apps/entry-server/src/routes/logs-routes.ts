import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { IDiaryLog, IDiaryResponseLog } from '../domain';
import { MongoClient, ObjectId } from 'mongodb';
import { GenerativeModel } from '@google/generative-ai';
import { addYears, endOfToday } from 'date-fns';
import { buildLogsChatPrompt } from '../prompts/logs-prompts';
import { createClient } from '@deepgram/sdk';
import fs from 'fs';
import { safeUnlink } from '../helpers/fs';
import { resolveBasketForMessage } from '../helpers/basket-resolver';
import multer from 'multer';
import path from 'path';

export const createLogsRoutes = (client: MongoClient, geminiModel: GenerativeModel) => {
  const router = Router();

  router.post('/', verifyAccessToken, async (req, res) => {
    const message = req.body.message;
    const basketId = req.body.basket_id;
    const userId = res.locals.userId;
    const logsCollection = await client.db('lifeis').collection('logs');

    const baskets = (await client.db('lifeis').collection('baskets').find().toArray()) as {
      _id: ObjectId;
      name: string;
    }[];
    const basket_id = await resolveBasketForMessage(baskets, message, basketId, geminiModel);

    const log: IDiaryLog = {
      message,
      timestamp: Date.now(),
      basket_id,
      owner_id: userId,
    };

    logsCollection.insertOne(log);
    res.status(200).send({ message: 'log submitted' });
  });

  // DELETE log by id
  router.delete('/:id', verifyAccessToken, async (req, res) => {
    const logId = req.params.id;
    const userId = res.locals.userId;
    const logsCollection = await client.db('lifeis').collection('logs');
    // SECURITY FIX: Added owner_id to filter so users can only delete their own logs (IDOR fix)
    const result = await logsCollection.deleteOne({ _id: new ObjectId(logId), owner_id: userId });
    if (result.deletedCount === 1) {
      res.status(200).send({ message: 'Log deleted' });
    } else {
      res.status(404).send({ message: 'Log not found' });
    }
  });

  router.get('/', verifyAccessToken, async (req, res) => {
    // from, to in query params in ISO format; basket_id for filtering by basket
    const userId = res.locals.userId;
    const from = req.query.from as string;
    const to = req.query.to as string;
    const basketId = req.query.basket_id as string;
    let filter: Record<string, unknown> = {
      owner_id: userId,
    };
    if (basketId) {
      filter.basket_id = new ObjectId(basketId);
    }
    if (from || to) {
      const timestampFilter: { $gte?: number; $lt?: number } = {};
      // From not selected → treat as earliest possible; To not selected → treat as +50 years
      if (from) {
        timestampFilter.$gte = new Date(from).getTime();
      } else {
        timestampFilter.$gte = 0; // Unix epoch (earliest)
      }
      if (to) {
        const toDate = new Date(to);
        const toEndOfDay = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
        timestampFilter.$lt = toEndOfDay.getTime();
      } else {
        timestampFilter.$lt = addYears(endOfToday(), 50).getTime();
      }
      filter = { ...filter, timestamp: timestampFilter };
    }
    const baskets = await client.db('lifeis').collection('baskets').find().toArray();
    client
      .db('lifeis')
      .collection('logs')
      .find(filter)
      .sort({ timestamp: -1 })
      .toArray()
      .then((dbLogs) => {
        const logs: IDiaryLog[] = dbLogs.map((dbLog) => ({
          id: dbLog._id.toString(),
          message: dbLog.message,
          timestamp: dbLog.timestamp,
          basket_id: dbLog.basket_id.toString(),
          owner_id: dbLog.owner_id.toString(),
        }));

        const responseLogs: IDiaryResponseLog[] = logs.map((log) => {
          const foundBasket = baskets.find((basket) => basket._id.toString() === log.basket_id.toString());

          return {
            id: log.id,
            message: log.message,
            timestamp: log.timestamp,
            basket_name: foundBasket?.name || 'removed',
            owner_id: log.owner_id,
          };
        });

        res.send({ logs: responseLogs });
      });
  });

  // PATCH log message and optionally basket_id by log id
  router.patch('/:id', verifyAccessToken, async (req, res) => {
    const logId = req.params.id;
    const userId = res.locals.userId;
    const { message, basket_id } = req.body;
    if (message === undefined) {
      return res.status(400).send({ message: 'message is required' });
    }
    const logsCollection = await client.db('lifeis').collection('logs');
    const update: { message: string; basket_id?: ObjectId } = { message };
    if (basket_id) {
      update.basket_id = new ObjectId(basket_id);
    }
    // SECURITY FIX: Added owner_id to filter so users can only update their own logs (IDOR fix)
    const result = await logsCollection.updateOne({ _id: new ObjectId(logId), owner_id: userId }, { $set: update });
    if (result.matchedCount === 1) {
      res.status(200).send({ message: 'Log updated' });
    } else {
      res.status(404).send({ message: 'Log not found' });
    }
  });

  // POST /chat - ask bot questions about logs in a selected period
  router.post('/chat', verifyAccessToken, async (req, res) => {
    try {
      const userId = res.locals.userId;
      const { question, from, to, basket_id, messages } = req.body;
      if (!question || typeof question !== 'string') {
        return res.status(400).send({ message: 'question is required' });
      }
      const previousMessages = Array.isArray(messages)
        ? (messages as { role: string; content: string }[])
            .filter((m) => m?.role && m?.content && ['user', 'assistant'].includes(m.role))
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        : [];

      let filter: Record<string, unknown> = { owner_id: userId };
      if (basket_id) {
        filter.basket_id = new ObjectId(basket_id);
      }
      if (from || to) {
        const timestampFilter: { $gte?: number; $lt?: number } = {};
        if (from) {
          timestampFilter.$gte = new Date(from).getTime();
        } else {
          timestampFilter.$gte = 0;
        }
        if (to) {
          const toDate = new Date(to);
          const toEndOfDay = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
          timestampFilter.$lt = toEndOfDay.getTime();
        } else {
          timestampFilter.$lt = addYears(endOfToday(), 50).getTime();
        }
        filter = { ...filter, timestamp: timestampFilter };
      }

      const baskets = await client.db('lifeis').collection('baskets').find().toArray();
      const dbLogs = await client.db('lifeis').collection('logs').find(filter).sort({ timestamp: -1 }).toArray();

      const logs: IDiaryResponseLog[] = dbLogs.map((dbLog) => {
        const foundBasket = baskets.find((b) => b._id.toString() === dbLog.basket_id.toString());
        return {
          id: dbLog._id.toString(),
          message: dbLog.message,
          timestamp: dbLog.timestamp,
          basket_name: foundBasket?.name || 'removed',
          owner_id: dbLog.owner_id.toString(),
        };
      });

      const logsContext = logs
        .map(
          (l) =>
            `[${new Date(l.timestamp).toLocaleDateString(undefined, { timeZone: 'UTC' })}] (${l.basket_name}): ${
              l.message
            }`,
        )
        .join('\n');

      const todayUtc = new Date().toISOString().slice(0, 10);
      const prompt = buildLogsChatPrompt(logsContext, question, todayUtc, previousMessages);

      // SECURITY FIX: Removed console.log of full prompt — it contained user PII (diary entries)

      const result = await geminiModel.generateContent(prompt);
      const answer = result.response.text();

      res.status(200).send({ answer });
    } catch (e) {
      console.error('Logs chat error:', e);
      res.status(500).send({ message: (e as Error)?.message || 'Failed to get answer' });
    }
  });

  // POST /transcribe-audio - upload multiple WAV files, transcribe, create logs
  const wavStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const d = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
      cb(null, d);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  });
  const wavUpload = multer({
    storage: wavStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (
        file.mimetype === 'audio/wav' ||
        file.mimetype === 'audio/wave' ||
        file.originalname.endsWith('.wav') ||
        file.originalname.endsWith('.WAV')
      ) {
        cb(null, true);
      } else {
        cb(new Error('Only WAV files are allowed'));
      }
    },
  });

  router.post('/transcribe-audio', verifyAccessToken, wavUpload.array('audio', 20), async (req, res) => {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    const userId = res.locals.userId;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).send({ message: 'No files uploaded' });
    }

    const basketId = req.body.basket_id;
    const timestampsRaw = req.body.timestamps;
    let timestamps: Record<string, string> = {};
    if (typeof timestampsRaw === 'string') {
      try {
        timestamps = (JSON.parse(timestampsRaw) as Record<string, string>) ?? {};
      } catch {
        // ignore malformed JSON
      }
    }
    const baskets = (await client.db('lifeis').collection('baskets').find().toArray()) as {
      _id: ObjectId;
      name: string;
    }[];
    const logsCollection = await client.db('lifeis').collection('logs');

    const results: { filename: string; message: string; timestamp: number; error?: string }[] = [];

    for (const file of files) {
      try {
        const isoDate = timestamps[file.originalname];
        const timestamp = isoDate ? new Date(isoDate).getTime() : Date.now();

        // Transcribe with Deepgram
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(fs.readFileSync(file.path), {
          model: 'nova-3',
          smart_format: true,
          language: 'ru',
        });

        if (error) throw error;

        const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';

        if (!transcript.trim()) {
          results.push({ filename: file.originalname, message: '', timestamp, error: 'Empty transcription' });
          continue;
        }

        const basket_id = await resolveBasketForMessage(baskets, transcript, basketId, geminiModel);

        const log: IDiaryLog = {
          message: transcript,
          timestamp,
          basket_id,
          owner_id: userId,
        };

        await logsCollection.insertOne(log);
        results.push({ filename: file.originalname, message: transcript, timestamp });
      } catch (err) {
        results.push({
          filename: file.originalname,
          message: '',
          timestamp: Date.now(),
          error: (err as Error).message,
        });
      } finally {
        safeUnlink(file.path);
      }
    }

    res.status(200).send({ results });
  });

  // PATCH log basket_id by log id (legacy/standalone basket update)
  router.patch('/:id/basket', verifyAccessToken, async (req, res) => {
    const logId = req.params.id;
    const userId = res.locals.userId;
    const { basket_id } = req.body;
    if (!basket_id) {
      return res.status(400).send({ message: 'basket_id is required' });
    }
    const logsCollection = await client.db('lifeis').collection('logs');
    // SECURITY FIX: Added owner_id to filter so users can only update their own logs (IDOR fix)
    const result = await logsCollection.updateOne(
      { _id: new ObjectId(logId), owner_id: userId },
      { $set: { basket_id: new ObjectId(basket_id) } },
    );
    if (result.modifiedCount === 1) {
      res.status(200).send({ message: 'Log basket_id updated' });
    } else {
      res.status(404).send({ message: 'Log not found or not authorized' });
    }
  });
  return router;
};
