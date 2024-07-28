import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { MongoClient, ObjectId } from 'mongodb';
import { GenerativeModel } from '@google/generative-ai';

const router = Router();

// TODO: pass mongodb agent and return routes with it's help

interface IAgent {
  name: string;
  prefix: string;
}

// TODO: need to add gemini model as a parameter
export const createAgentsRoutes = (client: MongoClient, geminiModel: GenerativeModel) => {
  const router = Router();

  // TODO: create separate endpoint to submit message
  // router.get('/:id/submit', verifyAccessToken, async (req, res) => {
  //   const { name, prefix } = req.body;
  // });

  router.get('/', verifyAccessToken, async (req, res) => {
    const agents = await client.db('lifeis').collection('gemini_agents').find({}).toArray();
    res.send({ agents });
  });

  router.post('/:id', verifyAccessToken, async (req, res) => {
    const agentId = req.params.id;

    const foundAgent = await client
      .db('lifeis')
      .collection('gemini_agents')
      .findOne({ _id: new ObjectId(agentId) });

    if (!foundAgent) {
      return res.status(404).send({ message: 'agent not found' });
    }

    // TODO: add type to contain _id
    const { prefix } = foundAgent as any;

    const prompt = `${prefix} ${req.body.message}`;
    const result = await geminiModel.generateContent(prompt);

    const response = await result.response;

    const responseText = response.text();
    res.send({ answer: responseText });
  });

  router.delete('/:id', verifyAccessToken, async (req, res) => {
    const agentId = req.params.id;

    // const collection = );

    // const foundAgent = collection.findOne({ _id: new ObjectId(agentId) });

    // if (!foundAgent) {
    //   return res.status(404).send({ message: 'agent not found' });
    // }

    const deleteResult = await client
      .db('lifeis')
      .collection('gemini_agents')
      .deleteOne({ _id: new ObjectId(agentId) });

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
    };
    const newAgentRaw = await client.db('lifeis').collection('gemini_agents').insertOne(newAgent);
    res.status(200).send(newAgentRaw);
  });

  return router;
};

export default router;
