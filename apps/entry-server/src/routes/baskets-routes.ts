import { Router } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';

export const getBasketRoutes = (client: MongoClient) => {
  const router = Router();

  // Get all baskets
  router.get('/', verifyAccessToken, async (req, res) => {
    try {
      const baskets = await client.db('lifeis').collection('baskets').find().toArray();
      res.json({ baskets });
    } catch (error) {
      // SECURITY FIX: Do not serialise the raw error object — it can contain MongoDB internals,
      // connection strings, or stack traces. Log server-side only.
      console.error('Error fetching baskets:', error);
      res.status(500).json({ message: 'Error fetching baskets' });
    }
  });

  // Create a new basket
  router.post('/', verifyAccessToken, async (req, res) => {
    try {
      const name = req.body.name;
      if (!name) {
        return res.status(400).json({ message: 'Basket name is required' });
      }

      const basketsCollection = client.db('lifeis').collection('baskets');

      const savedBasket = await basketsCollection.insertOne({
        name,
      });
      res.status(201).json(savedBasket);
    } catch (error) {
      // SECURITY FIX: Same as above — sanitise error response.
      console.error('Error creating basket:', error);
      res.status(500).json({ message: 'Error creating basket' });
    }
  });

  // DELETE basket by id
  router.delete('/:id', verifyAccessToken, async (req, res) => {
    const basketId = req.params.id;
    const basketsCollection = client.db('lifeis').collection('baskets');
    const result = await basketsCollection.deleteOne({ _id: new ObjectId(basketId) });
    if (result.deletedCount === 1) {
      res.status(200).send({ message: 'Basket deleted' });
    } else {
      res.status(404).send({ message: 'Basket not found or not authorized' });
    }
  });

  return router;
};
