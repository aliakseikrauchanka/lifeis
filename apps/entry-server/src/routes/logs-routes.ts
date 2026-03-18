import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { IDiaryLog, IDiaryResponseLog } from '../domain';
import { MongoClient, ObjectId } from 'mongodb';
import { GenerativeModel } from '@google/generative-ai';
import { addYears, endOfToday } from 'date-fns';

export const createLogsRoutes = (client: MongoClient, geminiModel: GenerativeModel) => {
  const router = Router();

  router.post('/', verifyAccessToken, async (req, res) => {
    const message = req.body.message;
    const basketId = req.body.basket_id;
    const userId = res.locals.userId;
    const logsCollection = await client.db('lifeis').collection('logs');

    const baskets = await client.db('lifeis').collection('baskets').find().toArray();
    let basket_id: (typeof baskets)[0]['_id'];

    if (basketId) {
      basket_id = new ObjectId(basketId);
    } else {
      const basketsNames = baskets.map((basket) => basket.name);
      const prompt = `What basket does message "${message}" belong out of the following baskets: ${basketsNames.join(
        ', ',
      )}. As a result please provide only name of matched basket without modifying case and without newlines at the end`;

      console.log({ prompt });

      const resultBasket = await geminiModel.generateContent(prompt);
      const matchedBasketName = await resultBasket.response.text().trim();

      let finalMatchedBasket = 'unspecified';
      if (basketsNames.includes(matchedBasketName)) {
        finalMatchedBasket = matchedBasketName;
      }

      basket_id = baskets.find((basket) => basket.name === finalMatchedBasket)?._id ?? baskets[0]?._id;
    }

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
    const logsCollection = await client.db('lifeis').collection('logs');
    const result = await logsCollection.deleteOne({ _id: new ObjectId(logId) });
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
    const { message, basket_id } = req.body;
    if (message === undefined) {
      return res.status(400).send({ message: 'message is required' });
    }
    const logsCollection = await client.db('lifeis').collection('logs');
    const update: { message: string; basket_id?: ObjectId } = { message };
    if (basket_id) {
      update.basket_id = new ObjectId(basket_id);
    }
    const result = await logsCollection.updateOne({ _id: new ObjectId(logId) }, { $set: update });
    if (result.matchedCount === 1) {
      res.status(200).send({ message: 'Log updated' });
    } else {
      res.status(404).send({ message: 'Log not found' });
    }
  });

  // PATCH log basket_id by log id (legacy/standalone basket update)
  router.patch('/:id/basket', verifyAccessToken, async (req, res) => {
    const logId = req.params.id;
    const { basket_id } = req.body;
    if (!basket_id) {
      return res.status(400).send({ message: 'basket_id is required' });
    }
    const logsCollection = await client.db('lifeis').collection('logs');
    const result = await logsCollection.updateOne(
      { _id: new ObjectId(logId) },
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
