import { Router, Request } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { MongoClient, ObjectId } from 'mongodb';
import { GenerativeModel } from '@google/generative-ai';

const router = Router();

interface IAgent {
  name: string;
  prefix: string;
  ownerId: string;
}

type IAgentDocument = Document & IAgent;

export const createAgentsRoutes = (client: MongoClient, geminiModel: GenerativeModel) => {
  const router = Router();

  router.get('/', verifyAccessToken, async (req, res) => {
    const agents = await client
      .db('lifeis')
      .collection('agents')
      .find({
        ownerId: res.locals.userId,
      })
      .toArray();
    res.send({ agents });
  });

  router.post('/:id', verifyAccessToken, async (req: Request, res) => {
    const agentId = req.params.id;

    const foundAgent = await client
      .db('lifeis')
      .collection<IAgentDocument>('agents')
      .findOne({ _id: new ObjectId(agentId), ownerId: res.locals.userId });

    if (!foundAgent) {
      return res.status(404).send({ message: 'agent not found' });
    }

    const { prefix } = foundAgent;

    // make request to gemini
    const prompt = `${prefix} ${req.body.message}`;
    const result = await geminiModel.generateContent(prompt);

    const responseText = result.response.text();

    // save entry to db
    await client
      .db('lifeis')
      .collection('agent_history')
      .insertOne({
        agentId: new ObjectId(agentId),
        prompt,
        response: responseText,
        timestamp: new Date(),
      });

    return res.send({ answer: responseText });
  });

  router.get('/:id/history', verifyAccessToken, async (req: Request, res) => {
    const agentId = req.params.id;

    const foundAgent = await client
      .db('lifeis')
      .collection<IAgentDocument>('agents')
      .findOne({ _id: new ObjectId(agentId), ownerId: res.locals.userId });

    if (!foundAgent) {
      return res.status(404).send({ message: 'agent not found' });
    }

    const agentHistoryDbItems = await client
      .db('lifeis')
      .collection<IAgentDocument>('agent_history')
      .find({ agentId: new ObjectId(agentId) });

    const agentHistory = (await agentHistoryDbItems.toArray()).reverse();

    return res.send({ history: agentHistory });
  });

  router.put('/:id', verifyAccessToken, async (req: Request, res) => {
    const agentId = req.params.id;

    const { name, prefix } = req.body;

    const updatedAgent = await client
      .db('lifeis')
      .collection<IAgentDocument>('agents')
      .updateOne(
        { _id: new ObjectId(agentId), ownerId: res.locals.userId },
        { $set: { name, prefix, ownerId: res.locals.userId } },
      );

    if (!updatedAgent) {
      return res.status(404).send({ message: 'agent not found' });
    }

    return res.status(200).send({ agent: updatedAgent });
  });

  router.delete('/:id', verifyAccessToken, async (req, res) => {
    const agentId = req.params.id;

    const deleteResult = await client
      .db('lifeis')
      .collection('agents')
      .deleteOne({ _id: new ObjectId(agentId), ownerId: res.locals.userId });

    if (deleteResult.deletedCount == 0) {
      return res.status(404).send({ message: 'agent not found' });
    }

    if (deleteResult.deletedCount > 1) {
      return res.status(500).send({ message: 'something went wrong' });
    }

    res.status(200).send({ message: 'agent deleted' });
  });

  router.post('/', verifyAccessToken, async (req, res) => {
    const { name, prefix } = req.body;

    const newAgent: IAgent = {
      name,
      prefix,
      ownerId: res.locals.userId,
    };
    const newAgentRaw = await client.db('lifeis').collection('agents').insertOne(newAgent);
    res.status(200).send(newAgentRaw);
  });

  return router;
};

export default router;
