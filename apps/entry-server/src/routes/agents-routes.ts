import { Router, Request } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { MongoClient, ObjectId } from 'mongodb';
import { GenerativeModel } from '@google/generative-ai';
import OpenAI from 'openai';

const router = Router();

interface IAgent {
  name: string;
  prefix: string;
  ownerId: string;
}

type IAgentDocument = Document & IAgent;

export const createAgentsRoutes = (client: MongoClient, geminiModel: GenerativeModel, openAiModel: OpenAI) => {
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

    const aiProvider = req.body.aiProvider === 'openai' ? 'openai' : 'gemini'; // gemini is default

    let prompt: string;
    if (prefix.indexOf('{}') > -1) {
      prompt = prefix.replace('{}', req.body.message);
    } else {
      prompt = `${prefix} ${req.body.message}`;
    }

    let responseText: string;

    try {
      if (aiProvider === 'openai') {
        const response = await openAiModel.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ],
        });
        responseText = response.choices[0].message.content;
      } else {
        const response = await geminiModel.generateContent(prompt);
        responseText = response.response.text();
      }
    } catch (e) {
      return res.status(500).send({
        message: e?.message || 'Something happened during request to AI service',
      });
    }

    // save entry to db
    await client
      .db('lifeis')
      .collection('agent_history')
      .insertOne({
        agentId: new ObjectId(agentId),
        prompt,
        prefix: prefix,
        message: req.body.message,
        response: responseText,
        timestamp: new Date(),
        agentType: aiProvider,
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
