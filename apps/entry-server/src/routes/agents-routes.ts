import { Router, Request } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { MongoClient, ObjectId } from 'mongodb';
import { GenerateContentRequest, GoogleGenerativeAI, Part } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

import OpenAI from 'openai';
import multer from 'multer';
const fileManager = new GoogleAIFileManager(process.env.GOOGLE_API_KEY);

const deepSeek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const d = path.join(__dirname, 'uploads');
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
    cb(null, d);
  },
  filename: (req, file, cb) => {
    cb(null, 'image_upload.jpg');
  },
});

export const uploadMiddlewareFactory = multer({ storage, limits: { fileSize: 1024 * 1024 * 10 } });

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

interface IPinnedAgents {
  ownerId: string;
  agentIds: string[];
}

interface IAgentTemplate extends IAgentBasic {
  creatorId: string;
  type: 'template';
}

type IAgentDocument = Document & IAgent & IAgentTemplate;

const defaultGeminiModelName = 'gemini-1.5-flash-latest';
const defaultOpenAiModelName = 'gpt-4o-mini';
const allowedGeminiModelsNames = ['gemini-1.5-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-pro'];

export const createAgentsRoutes = (client: MongoClient, genAi: GoogleGenerativeAI, openAiModel: OpenAI) => {
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

  router.post('/pinned-agents-ids', [verifyAccessToken], async (req: Request, res) => {
    const { agentsIds } = req.body;

    const pinnedAgents: IPinnedAgents = await client
      .db('lifeis')
      .collection<IPinnedAgents>('pinned_agents')
      .findOne({ ownerId: res.locals.userId });

    if (pinnedAgents) {
      await client
        .db('lifeis')
        .collection<IPinnedAgents>('pinned_agents')
        .updateOne(
          { ownerId: res.locals.userId },
          {
            $set: { agentIds: agentsIds },
          },
        );
    } else {
      await client
        .db('lifeis')
        .collection<IPinnedAgents>('pinned_agents')
        .insertOne({ ownerId: res.locals.userId, agentIds: agentsIds });
    }

    res.status(200).send({ agentsIds });
  });

  router.get('/pinned-agents-ids', [verifyAccessToken], async (req: Request, res) => {
    const pinnedAgents = await client
      .db('lifeis')
      .collection<IPinnedAgents>('pinned_agents')
      .findOne({ ownerId: res.locals.userId });

    res.status(200).send({ agentsIds: pinnedAgents ? pinnedAgents.agentIds : [] });
  });

  router.post(
    '/parse-image',
    [verifyAccessToken, uploadMiddlewareFactory.single('image')],
    async (req: Request, res) => {
      // const directoryPath = path.join(__dirname, 'uploads', res.locals.userId);
      // if (!fs.existsSync(directoryPath)) {
      //   fs.mkdirSync(directoryPath);
      // }

      const filePath = path.join(__dirname, 'uploads', 'image_upload.jpg');
      // read file from filePath
      let imageBuffer;
      try {
        imageBuffer = fs.readFileSync(filePath);
        try {
          imageBuffer = await sharp(imageBuffer)
            .resize({
              width: 1200,
              // Example dimensions
              fit: sharp.fit.inside, // Or other fit options as needed
              withoutEnlargement: true, // Prevent upscaling
            })
            .jpeg({ quality: 100 }) // Adjust quality as needed
            .toBuffer();
          console.log('debug size', imageBuffer.length);

          // ... save resizedBuffer ...
        } catch (error) {
          // ... handle error ...
        }
      } catch (error) {
        console.log('error', error);
      }

      console.log('debug', filePath, req.file);

      let uploadResult;
      if (imageBuffer) {
        uploadResult = await fileManager.uploadFile(filePath, {
          mimeType: 'image/jpeg',
          displayName: 'Jetpack drawing',
        });
        console.log(`Uploaded file ${uploadResult.file.displayName} as: ${uploadResult.file.uri}`);
      }
      // View the response.

      let responseText: string;

      try {
        const geminiRequestBody: GenerateContentRequest | string | Array<string | Part> = ['Get text from the image'];
        if (uploadResult) {
          geminiRequestBody.push({
            fileData: {
              fileUri: uploadResult.file.uri,
              mimeType: uploadResult.file.mimeType,
            },
          });
        }

        const geminiModel = genAi.getGenerativeModel({ model: defaultGeminiModelName });
        const response = await geminiModel.generateContent(geminiRequestBody);
        try {
          uploadResult.file.url && fileManager.deleteFile(uploadResult.file.id);
          filePath && fs.unlinkSync(filePath);
        } catch (e) {
          console.log('error', e, 'error on deleting file');
        }

        responseText = response.response.text();
      } catch (e) {
        return res.status(500).send({
          message: e?.message || 'Something happened during request to AI service',
        });
      }

      return res.send({ answer: responseText });
    },
  );

  router.post('/:id', [verifyAccessToken, uploadMiddlewareFactory.single('image')], async (req: Request, res) => {
    const agentId = req.params.id;

    // create directory if not exists
    // const directoryPath = path.join(__dirname, 'uploads', res.locals.userId);
    // if (!fs.existsSync(directoryPath)) {
    //   fs.mkdirSync(directoryPath);
    // }
    const filePath = path.join(__dirname, 'uploads', 'image_upload.jpg');
    // read file from filePath
    let imageBuffer;
    try {
      imageBuffer = fs.readFileSync(filePath);
      try {
        imageBuffer = await sharp(imageBuffer)
          .resize({
            width: 1200,
            // Example dimensions
            fit: sharp.fit.inside, // Or other fit options as needed
            withoutEnlargement: true, // Prevent upscaling
          })
          .jpeg({ quality: 100 }) // Adjust quality as needed
          .toBuffer();
        console.log('debug size', imageBuffer.length);

        // ... save resizedBuffer ...
      } catch (error) {
        // ... handle error ...
      }
    } catch (error) {
      console.log('error', error);
    }

    console.log('debug', filePath, req.file);

    let uploadResult;
    if (imageBuffer) {
      uploadResult = await fileManager.uploadFile(filePath, {
        mimeType: 'image/jpeg',
        displayName: 'Jetpack drawing',
      });
      console.log(`Uploaded file ${uploadResult.file.displayName} as: ${uploadResult.file.uri}`);
    }
    // View the response.

    const foundAgent: IAgent | IAgentTemplate = await client
      .db('lifeis')
      .collection<IAgentDocument>('agents')
      .findOne({ _id: new ObjectId(agentId), $or: [{ ownerId: res.locals.userId }, { type: 'template' }] });

    if (!foundAgent) {
      return res.status(404).send({ message: 'agent not found' });
    }

    const { prefix } = foundAgent;

    const aiProvider = req.body.aiProvider ?? 'gemini'; // gemini is default

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
          model: defaultOpenAiModelName,
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
      } else if (aiProvider === 'deepseek-r1') {
        const response = await deepSeek.chat.completions.create({
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
          model: 'deepseek-chat',
        });

        responseText = response.choices[0].message.content;
      } else {
        const geminiRequestBody: GenerateContentRequest | string | Array<string | Part> = [prompt];
        if (uploadResult) {
          console.log('debug', 'uploading image', uploadResult.file.uri, uploadResult.file.mimeType);
          geminiRequestBody.push({
            fileData: {
              fileUri: uploadResult.file.uri,
              mimeType: uploadResult.file.mimeType,
            },
          });
        }
        const model = allowedGeminiModelsNames.includes(aiProvider) ? aiProvider : defaultGeminiModelName;
        const geminiModel = genAi.getGenerativeModel({ model });
        const response = await geminiModel.generateContent(geminiRequestBody);
        try {
          uploadResult.file.url && fileManager.deleteFile(uploadResult.file.id);
          filePath && fs.unlinkSync(filePath);
        } catch (e) {
          console.log('error', e, 'error on deleting file');
        }

        responseText = response.response.text();
      }
    } catch (e) {
      return res.status(500).send({
        message: e?.message || 'Something happened during request to AI service',
      });
    }

    // save entry to db
    //
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

    const agentHistory = (await agentHistoryDbItems.toArray()).reverse().slice(0, 100);

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
          $set: { ...foundAgent, ...req.body },
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
