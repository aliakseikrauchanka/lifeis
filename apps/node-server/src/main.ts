import express, { json } from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';

import { verifyAccessToken } from './hooks/verify-access.middleware';

import { MongoClient, ServerApiVersion } from 'mongodb';
import { IDiaryLog } from './domain';

// const uri = 'mongodb+srv://aliakseikrauchankadev:<password>@cluster0.5d0hu5r.mongodb.net/?retryWrites=true&w=majority';

const uri =
  process.env.DB_URI ??
  'mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.1.1';

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const d = path.join(__dirname, 'uploads');
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
    cb(null, d);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      // file.fieldname + '-' + Date.now() + path.extname(file.originalname)
      'record.mp4'
    );
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('You successfully connected to MongoDB!');
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
// what is this? I send reques to oauth from server on localhost:3000 and redirect to localhost:4201
// how does it work?
const REDIRECT_URL = process.env.REDIRECT_URL ?? 'http://localhost:4201';

const app = express();

app.use(cors());
app.use(json());

const upload = multer({ storage });

function convertFile(inputPath, outputPath, onSuccess) {
  console.log('input', inputPath, 'output', outputPath);
  ffmpeg(inputPath)
    .output(outputPath)
    .on('end', function () {
      console.log('Conversion Finished');
      onSuccess && onSuccess();
    })
    .on('error', function (err) {
      console.log('Conversion Error: ' + err.message);
    })
    .run();
}

app.post(
  '/api/transcribe',
  verifyAccessToken,
  upload.single('audio'),
  (_, res) => {
    const openai = new OpenAI();

    const files = fs.readdirSync(path.join(__dirname, 'uploads'));
    console.log('Files:', files);

    const filePath = path.join(__dirname, 'uploads', 'record.mp4');
    const filePathMp3 = path.join(__dirname, 'uploads', 'record.mp3');

    convertFile(filePath, filePathMp3, () => {
      async function main() {
        console.log('sending file to openai');
        const translation = await openai.audio.translations.create({
          file: fs.createReadStream(filePath),
          model: 'whisper-1',
        });
        res.send(translation);
        console.log('file was sent to openai');
      }

      main();
    });
  }
);

app.get('/api/ping', verifyAccessToken, (req, res) => {
  res.send({ message: 'pong' });
});

app.post('/api/logs', verifyAccessToken, async (req, res) => {
  const log: IDiaryLog = {
    message: req.body.message,
    timestamp: Date.now(),
  };
  await client.db('lifeis').collection('logs').insertOne(log);
  res.status(200).send({ message: 'log submitted' });
});

app.get('/api/logs', verifyAccessToken, (_, res) => {
  client
    .db('lifeis')
    .collection('logs')
    .find()
    .toArray()
    .then((dblogs) => {
      const logs: IDiaryLog[] = dblogs.map((dblog) => ({
        id: dblog._id.toString(),
        message: dblog.message,
        timestamp: dblog.timestamp,
      }));
      res.send({ logs });
    });
});

app.post('/api/auth/google', (req, res) => {
  console.log(req, JSON.stringify(req.body, null, 2));
  const { code } = req.body;
  console.log('code from client', code);
  const client_id = CLIENT_ID;
  const client_secret = CLIENT_SECRET;
  const redirect_uri = REDIRECT_URL;
  const grant_type = 'authorization_code';

  fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id,
      client_secret,
      redirect_uri,
      grant_type,
    }),
  })
    .then((response) => response.json())
    .then((tokens) => {
      console.log('tokens', JSON.stringify(tokens, null, 2));
      // Send the tokens back to the frontend, or store them securely and create a session
      res.json(tokens);
    })
    .catch((error) => {
      // Handle errors in the token exchange
      console.error('Token exchange error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
