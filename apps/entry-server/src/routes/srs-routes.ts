import { Router } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { schedule, Rating } from '../helpers/srs-scheduler';

const VALID_RATINGS = new Set<Rating>(['again', 'hard', 'good', 'easy']);

export const getSrsRoutes = (client: MongoClient) => {
  const router = Router();
  const db = client.db('lifeis');
  const srsCollection = db.collection('translation_srs');
  const translationsCollection = db.collection('translations');

  // Ensure indexes (idempotent)
  srsCollection.createIndex({ owner_id: 1, translation_id: 1 }, { unique: true });
  srsCollection.createIndex({ owner_id: 1, due_at: 1 });

  // GET /due — cards due for review
  router.get('/due', verifyAccessToken, async (req, res) => {
    try {
      const userId = res.locals.userId;
      const cards = await srsCollection
        .aggregate([
          { $match: { owner_id: userId, due_at: { $lte: Date.now() } } },
          { $sort: { due_at: 1 } },
          { $limit: 50 },
          {
            $lookup: {
              from: 'translations',
              localField: 'translation_id',
              foreignField: '_id',
              as: 'translation',
            },
          },
          { $unwind: '$translation' },
        ])
        .toArray();

      res.json({ cards });
    } catch (error) {
      console.error('Error fetching due cards:', error);
      res.status(500).json({ message: 'Error fetching due cards' });
    }
  });

  // GET /enrolled — all enrolled cards with SRS state
  router.get('/enrolled', verifyAccessToken, async (req, res) => {
    try {
      const userId = res.locals.userId;
      const cards = await srsCollection
        .aggregate([
          { $match: { owner_id: userId } },
          {
            $lookup: {
              from: 'translations',
              localField: 'translation_id',
              foreignField: '_id',
              as: 'translation',
            },
          },
          { $unwind: '$translation' },
        ])
        .toArray();

      res.json({ cards });
    } catch (error) {
      console.error('Error fetching enrolled cards:', error);
      res.status(500).json({ message: 'Error fetching enrolled cards' });
    }
  });

  // POST /review — grade a card
  router.post('/review', verifyAccessToken, async (req, res) => {
    try {
      const { translationId, rating } = req.body;

      if (!translationId || !rating) {
        return res.status(400).json({ message: 'translationId and rating are required' });
      }
      if (!VALID_RATINGS.has(rating)) {
        return res.status(400).json({ message: 'rating must be one of: again, hard, good, easy' });
      }

      const userId = res.locals.userId;
      let objectId: ObjectId;
      try {
        objectId = new ObjectId(translationId);
      } catch {
        return res.status(400).json({ message: 'Invalid translationId' });
      }

      const card = await srsCollection.findOne({ owner_id: userId, translation_id: objectId });
      if (!card) {
        return res.status(404).json({ message: 'Card not found. Enroll the translation first.' });
      }

      const now = Date.now();
      const updated = schedule(
        {
          interval_days: card.interval_days,
          ease: card.ease,
          reps: card.reps,
          lapses: card.lapses,
        },
        rating,
        now,
      );

      await srsCollection.updateOne(
        { _id: card._id },
        {
          $set: {
            interval_days: updated.interval_days,
            ease: updated.ease,
            reps: updated.reps,
            lapses: updated.lapses,
            due_at: updated.due_at,
            updated_at: now,
          },
        },
      );

      res.json({ ...updated, translationId });
    } catch (error) {
      console.error('Error reviewing card:', error);
      res.status(500).json({ message: 'Error reviewing card' });
    }
  });

  // POST /enroll — add a translation to the SRS deck
  router.post('/enroll', verifyAccessToken, async (req, res) => {
    try {
      const { translationId } = req.body;
      if (!translationId) {
        return res.status(400).json({ message: 'translationId is required' });
      }

      let objectId: ObjectId;
      try {
        objectId = new ObjectId(translationId);
      } catch {
        return res.status(400).json({ message: 'Invalid translationId' });
      }

      const userId = res.locals.userId;

      // Verify translation exists and belongs to user
      const translation = await translationsCollection.findOne({ _id: objectId, owner_id: userId });
      if (!translation) {
        return res.status(404).json({ message: 'Translation not found' });
      }

      const now = Date.now();
      const result = await srsCollection.updateOne(
        { owner_id: userId, translation_id: objectId },
        {
          $setOnInsert: {
            owner_id: userId,
            translation_id: objectId,
            due_at: now,
            interval_days: 0,
            ease: 2.5,
            reps: 0,
            lapses: 0,
            created_at: now,
            updated_at: now,
          },
        },
        { upsert: true },
      );

      res.status(result.upsertedCount ? 201 : 200).json({ enrolled: true });
    } catch (error) {
      console.error('Error enrolling translation:', error);
      res.status(500).json({ message: 'Error enrolling translation' });
    }
  });

  // POST /enroll/batch — enroll multiple translations at once
  router.post('/enroll/batch', verifyAccessToken, async (req, res) => {
    try {
      const { translationIds } = req.body;
      if (!Array.isArray(translationIds) || translationIds.length === 0) {
        return res.status(400).json({ message: 'translationIds array is required' });
      }
      if (translationIds.length > 500) {
        return res.status(400).json({ message: 'Maximum 500 items per batch' });
      }

      const userId = res.locals.userId;
      const objectIds: ObjectId[] = [];
      for (const id of translationIds) {
        try {
          objectIds.push(new ObjectId(id));
        } catch {
          // skip invalid ids
        }
      }

      if (objectIds.length === 0) {
        return res.status(400).json({ message: 'No valid translationIds provided' });
      }

      // Verify translations exist and belong to user
      const validTranslations = await translationsCollection
        .find({ _id: { $in: objectIds }, owner_id: userId })
        .project({ _id: 1 })
        .toArray();

      const validIds = validTranslations.map((t) => t._id);

      const now = Date.now();
      const ops = validIds.map((translationId) => ({
        updateOne: {
          filter: { owner_id: userId, translation_id: translationId },
          update: {
            $setOnInsert: {
              owner_id: userId,
              translation_id: translationId,
              due_at: now,
              interval_days: 0,
              ease: 2.5,
              reps: 0,
              lapses: 0,
              created_at: now,
              updated_at: now,
            },
          },
          upsert: true,
        },
      }));

      const result = await srsCollection.bulkWrite(ops);

      res.status(201).json({ enrolled: result.upsertedCount, existing: result.matchedCount });
    } catch (error) {
      console.error('Error batch enrolling:', error);
      res.status(500).json({ message: 'Error batch enrolling' });
    }
  });

  // DELETE /enroll/:translationId — remove from SRS deck
  router.delete('/enroll/:translationId', verifyAccessToken, async (req, res) => {
    try {
      let objectId: ObjectId;
      try {
        objectId = new ObjectId(req.params.translationId);
      } catch {
        return res.status(400).json({ message: 'Invalid translationId' });
      }

      const userId = res.locals.userId;
      await srsCollection.deleteOne({ owner_id: userId, translation_id: objectId });

      res.json({ enrolled: false });
    } catch (error) {
      console.error('Error unenrolling translation:', error);
      res.status(500).json({ message: 'Error unenrolling translation' });
    }
  });

  return router;
};
