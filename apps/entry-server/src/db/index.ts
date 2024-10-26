import { MongoClient, ServerApiVersion } from 'mongodb';

const mongoDbUri =
  process.env.MODE !== 'offline'
    ? process.env.DB_URI
    : 'mongodb://host.docker.internal/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.1.1';

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
    } catch (e) {
      console.log('test', e);
    } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
    }
  }
  run().catch(console.dir);

  return client;
};
