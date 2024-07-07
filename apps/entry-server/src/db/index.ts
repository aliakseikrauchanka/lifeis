import { MongoClient, ServerApiVersion } from 'mongodb';

// const uri = 'mongodb+srv://aliakseikrauchankadev:<password>@cluster0.5d0hu5r.mongodb.net/?retryWrites=true&w=majority';

const mongoDbUri =
  process.env.DB_URI ??
  'mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.1.1';

export const getMongoDbClient = () => {
  const client = new MongoClient(mongoDbUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  async function run() {
    try {
      // Connect the client to the server (optional starting in v4.7)
      await client.connect();
      // Send a ping to confirm a successful connection
      await client.db('admin').command({ ping: 1 });
      console.log('debug, you successfully connected to MongoDB!');
    } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
    }
  }
  run().catch(console.dir);

  return client;
};
