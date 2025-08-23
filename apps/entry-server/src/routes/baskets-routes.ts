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
      res.status(500).json({ message: 'Error fetching baskets', error });
    }
  });

  // Create a new basket
  router.post('/', verifyAccessToken, async (req, res) => {
    try {
      const name = req.body.name;
      console.log('req.body', req.body);
      if (!name) {
        return res.status(400).json({ message: 'Basket name is required' });
      }

      const basketsCollection = await client.db('lifeis').collection('baskets');

      const savedBasket = basketsCollection.insertOne({
        name,
      });
      res.status(201).json(savedBasket);
    } catch (error) {
      res.status(500).json({ message: 'Error creating basket', error });
    }
  });

  // DELETE basket by id
  router.delete('/:id', verifyAccessToken, async (req, res) => {
    const basketId = req.params.id;
    const basketsCollection = await client.db('lifeis').collection('baskets');
    const result = await basketsCollection.deleteOne({ _id: new ObjectId(basketId) });
    if (result.deletedCount === 1) {
      res.status(200).send({ message: 'Basket deleted' });
    } else {
      res.status(404).send({ message: 'Basket not found or not authorized' });
    }
  });

  return router;
};
