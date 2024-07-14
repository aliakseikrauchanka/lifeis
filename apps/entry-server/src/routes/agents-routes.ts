import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MongoClient, ObjectId, WithId } from 'mongodb';

const router = Router();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// TODO: pass mongodb agent and return routes with it's help

interface IAgent {
  name: string;
  prefix: string;
}

// TODO: need to add gemini model as a parameter
export const createAgentsRoutes = (client: MongoClient) => {
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
