import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { IDiaryLog } from '../domain';
import { MongoClient } from 'mongodb';

export const createLogsRoutes = (client: MongoClient) => {
  const router = Router();

  router.post('/', verifyAccessToken, async (req, res) => {
    const log: IDiaryLog = {
      message: req.body.message,
      timestamp: Date.now(),
    };
    await client.db('lifeis').collection('logs').insertOne(log);
    res.status(200).send({ message: 'log submitted' });
  });

  router.get('/', verifyAccessToken, (_, res) => {
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
        }));
        res.send({ logs });
      });
  });

  return router;
};
