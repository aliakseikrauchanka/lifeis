import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { IDiaryLog, IDiaryResponseLog } from '../domain';
import { MongoClient } from 'mongodb';
import { GenerativeModel } from '@google/generative-ai';

export const createLogsRoutes = (client: MongoClient, geminiModel: GenerativeModel) => {
  const router = Router();

  router.post('/', verifyAccessToken, async (req, res) => {
    const message = req.body.message;
    const logsCollection = await client.db('lifeis').collection('logs');

    const baskets = await client.db('lifeis').collection('baskets').find().toArray();
    const basketsNames = baskets.map((basket) => basket.name);

    const prompt = `What basket does message "${message}" belong out of the following baskets: ${basketsNames.join(
      ', ',
    )}. As a result please provide only name of matched basket without modifying case and without newlines at the end`;

    console.log({ prompt });

    const resultBasket = await geminiModel.generateContent(prompt);
    // TODO: for some reason resultBasket name contains /n in the end.
    // So I need to do trim to remove unnecessary stuff
    const matchedBasketName = await resultBasket.response.text().trim();

    let finalMatchedBasket = 'unspecified'; // default basket if no match found
    if (basketsNames.includes(matchedBasketName)) {
      finalMatchedBasket = matchedBasketName;
    }

    const log: IDiaryLog = {
      message,
      timestamp: Date.now(),
      basket_id: baskets.find((basket) => basket.name === finalMatchedBasket)._id,
    };

    logsCollection.insertOne(log);
    res.status(200).send({ message: 'log submitted' });
  });

  router.get('/', verifyAccessToken, async (_, res) => {
    const baskets = await client.db('lifeis').collection('baskets').find().toArray();
    client
      .db('lifeis')
      .collection('logs')
      .find()
      .toArray()
      .then((dbLogs) => {
        const logs: IDiaryLog[] = dbLogs.map((dbLog) => ({
          id: dbLog._id.toString(),
          message: dbLog.message,
          timestamp: dbLog.timestamp,
          basket_id: dbLog.basket_id.toString(),
        }));

        const responseLogs: IDiaryResponseLog[] = logs.map((log) => {
          return {
            id: log.id,
            message: log.message,
            timestamp: log.timestamp,
            basket_name: baskets.find((basket) => basket._id.toString() === log.basket_id.toString()).name,
          };
        });

        res.send({ logs: responseLogs });
      });
  });

  return router;
};
