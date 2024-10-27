import { Router, Request } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { MongoClient, ObjectId } from 'mongodb';
import { GenerativeModel } from '@google/generative-ai';
import OpenAI from 'openai';

const router = Router();

interface IAgentBasic {
  name: string;
  prefix: string;
  type: string;
}

interface IAgent extends IAgentBasic {
  ownerId: string;
  type: 'agent';
  isArchived?: boolean;
}

interface IAgentTemplate extends IAgentBasic {
  creatorId: string;
  type: 'template';
}

type IAgentDocument = Document & IAgent & IAgentTemplate;

export const createAgentsRoutes = (client: MongoClient, geminiModel: GenerativeModel, openAiModel: OpenAI) => {
  const router = Router();

  router.get('/', verifyAccessToken, async (req, res) => {
    const agents = await client
      .db('lifeis')
      .collection('agents')
      .find({
        $or: [{ ownerId: res.locals.userId }, { type: 'template' }],
      })
      .toArray();
    res.send({ agents });
  });

  router.post('/:id/:make-template', verifyAccessToken, async (req, res) => {
    console.log('debug', 'make-template');
    const agentId = req.params.id;

    const foundAgent: IAgent = await client
      .db('lifeis')
      .collection<IAgentDocument>('agents')
      .findOne({ _id: new ObjectId(agentId), ownerId: res.locals.userId });

    const { name, prefix } = foundAgent;

    const newAgent: IAgentTemplate = {
      type: 'template',
      prefix,
      name: `${name} template`,
      creatorId: res.locals.userId,
    };
    const newAgentRaw = await client.db('lifeis').collection('agents').insertOne(newAgent);
    res.status(200).send(newAgentRaw);
  });

  router.post('/:id/:clone', verifyAccessToken, async (req, res) => {
    const agentId = req.params.id;

    const foundAgent: IAgentTemplate = await client
      .db('lifeis')
      .collection<IAgentDocument>('agents')
      .findOne({ _id: new ObjectId(agentId) });

    const { name, prefix } = foundAgent;

    const newAgent: IAgent = {
      type: 'agent',
      prefix,
      name,
      ownerId: res.locals.userId,
    };
    const newAgentRaw = await client.db('lifeis').collection('agents').insertOne(newAgent);
    res.status(200).send(newAgentRaw);
  });

  router.post('/:id', verifyAccessToken, async (req: Request, res) => {
    const agentId = req.params.id;

    const foundAgent: IAgent | IAgentTemplate = await client
      .db('lifeis')
      .collection<IAgentDocument>('agents')
      .findOne({ _id: new ObjectId(agentId), $or: [{ ownerId: res.locals.userId }, { creatorId: res.locals.userId }] });

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
      .findOne({ _id: new ObjectId(agentId) });

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

    const foundAgent: IAgent = await client
      .db('lifeis')
      .collection<IAgentDocument>('agents')
      .findOne({ _id: new ObjectId(agentId), $or: [{ ownerId: res.locals.userId }, { creatorId: res.locals.userId }] });

    if (!foundAgent) {
      return res.status(404).send({ message: 'agent not found' });
    }

    const updatedAgent = await client
      .db('lifeis')
      .collection<IAgent | IAgentTemplate>('agents')
      .updateOne(
        { _id: new ObjectId(agentId), ownerId: res.locals.userId },
        {
          $set: { foundAgent, ...req.body },
        },
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
      .deleteOne({
        _id: new ObjectId(agentId),
        $or: [{ ownerId: res.locals.userId }, { creatorId: res.locals.userId }],
      });

    if (deleteResult.deletedCount == 0) {
      return res.status(404).send({ message: 'agent not found' });
    }

    if (deleteResult.deletedCount > 1) {
      return res.status(500).send({ message: 'something went wrong' });
    }
    1;
    res.status(200).send({ message: 'agent deleted' });
  });

  router.post('/', verifyAccessToken, async (req, res) => {
    const { name, prefix } = req.body;

    const newAgent: IAgent = {
      type: 'agent',
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
