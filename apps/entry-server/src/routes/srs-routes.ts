import { Router } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import OpenAI from 'openai';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { schedule, Rating } from '../helpers/srs-scheduler';

const VALID_RATINGS = new Set<Rating>(['again', 'hard', 'good', 'easy']);
const ALLOWED_LANGUAGE_CODES = new Set(['pl', 'ru-RU', 'en-US', 'de-DE', 'fr-FR', 'sr-RS', 'fi', 'es']);
const MAX_TRANSCRIPT_LENGTH = 2000;
const CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const getSrsRoutes = (client: MongoClient, openAiModel: OpenAI) => {
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

  // POST /sentence-training/generate — pick N due words (same language), generate story
  router.post('/sentence-training/generate', verifyAccessToken, async (req, res) => {
    try {
      const sentenceCountRaw = Number(req.body?.sentenceCount);
      const levelRaw = typeof req.body?.level === 'string' ? req.body.level : '';
      const translationIdsRaw = req.body?.translationIds;
      const hasExplicitIds = Array.isArray(translationIdsRaw) && translationIdsRaw.length > 0;

      if (!Number.isInteger(sentenceCountRaw) || sentenceCountRaw < 1 || sentenceCountRaw > 3) {
        return res.status(400).json({ message: 'sentenceCount must be an integer between 1 and 3' });
      }
      if (!CEFR_LEVELS.has(levelRaw)) {
        return res.status(400).json({ message: 'level must be one of A1, A2, B1, B2, C1, C2' });
      }

      const sentenceCount = sentenceCountRaw;
      const level = levelRaw;
      const userId = res.locals.userId;

      let picked: Array<{ translation: { _id: ObjectId; original: string; translation: string; originalLanguage: string; translationLanguage: string } }>;
      let originalLanguage: string;
      let translationLanguage: string;

      if (hasExplicitIds) {
        if (translationIdsRaw.length > 5) {
          return res.status(400).json({ message: 'Maximum 5 translationIds' });
        }
        const objectIds: ObjectId[] = [];
        for (const id of translationIdsRaw) {
          try {
            objectIds.push(new ObjectId(String(id)));
          } catch {
            return res.status(400).json({ message: `Invalid translationId: ${id}` });
          }
        }
        const cards = await srsCollection
          .aggregate([
            { $match: { owner_id: userId, translation_id: { $in: objectIds } } },
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
        if (cards.length !== objectIds.length) {
          return res.status(404).json({ message: 'One or more translations are not enrolled' });
        }
        originalLanguage = cards[0].translation.originalLanguage;
        translationLanguage = cards[0].translation.translationLanguage;
        const mismatched = cards.some(
          (c) =>
            c.translation.originalLanguage !== originalLanguage ||
            c.translation.translationLanguage !== translationLanguage,
        );
        if (mismatched) {
          return res.status(400).json({ message: 'All selected translations must share the same language pair' });
        }
        picked = cards as typeof picked;
      } else {
        const wordCountRaw = Number(req.body?.wordCount);
        if (!Number.isInteger(wordCountRaw) || wordCountRaw < 1 || wordCountRaw > 5) {
          return res.status(400).json({ message: 'wordCount must be an integer between 1 and 5' });
        }
        const dueCards = await srsCollection
          .aggregate([
            { $match: { owner_id: userId, due_at: { $lte: Date.now() } } },
            { $sample: { size: 50 } },
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

        if (dueCards.length === 0) {
          return res.status(404).json({ message: 'No due cards available' });
        }

        originalLanguage = dueCards[0].translation.originalLanguage;
        translationLanguage = dueCards[0].translation.translationLanguage;
        const sameLang = dueCards.filter(
          (c) =>
            c.translation.originalLanguage === originalLanguage &&
            c.translation.translationLanguage === translationLanguage,
        );
        if (sameLang.length < wordCountRaw) {
          return res
            .status(404)
            .json({ message: `Need at least ${wordCountRaw} due cards in the same language (have ${sameLang.length})` });
        }
        picked = sameLang.slice(0, wordCountRaw) as typeof picked;
      }

      const words = picked.map((c) => ({
        translationId: c.translation._id.toString(),
        original: c.translation.original,
        translation: c.translation.translation,
      }));

      const wordList = words.map((w) => w.original).join(', ');

      const sentencesClause =
        sentenceCount === 1
          ? 'exactly one short sentence'
          : `exactly ${sentenceCount} short sentences that read as consecutive lines of a short story (same subject/scene; each sentence directly continues the previous one — no topic jump)`;

      const completion = await openAiModel.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Return a JSON object with:
- "story": a single string in ${originalLanguage} consisting of ${sentencesClause}. Match CEFR language level ${level} — use vocabulary and grammar typical for a ${level} learner. The story must use all the given words (each at least once). Join sentences with a single space, no numbering or bullets.
- "translation": the same story translated into ${translationLanguage} as a single natural string (no numbering, no bullets).
No extra fields.`,
          },
          { role: 'user', content: wordList },
        ],
      });
      const raw = completion.choices[0].message.content ?? '{}';
      const parsed = JSON.parse(raw);
      const story: string = typeof parsed.story === 'string' ? parsed.story.trim() : '';
      const translation: string = typeof parsed.translation === 'string' ? parsed.translation.trim() : '';

      res.json({ words, story, translation, originalLanguage, translationLanguage });
    } catch (error) {
      console.error('Error generating sentence training:', error);
      res.status(500).json({ message: 'Error generating sentence training' });
    }
  });

  // POST /sentence-training/check — score transcript vs target, return translations
  router.post('/sentence-training/check', verifyAccessToken, async (req, res) => {
    try {
      const { story, transcript, originalLanguage, translationLanguage } = req.body;

      if (typeof story !== 'string' || story.length === 0 || story.length > MAX_TRANSCRIPT_LENGTH) {
        return res.status(400).json({ message: 'story must be a non-empty string' });
      }
      if (typeof transcript !== 'string' || transcript.length === 0 || transcript.length > MAX_TRANSCRIPT_LENGTH) {
        return res.status(400).json({ message: 'transcript must be a non-empty string' });
      }
      if (!ALLOWED_LANGUAGE_CODES.has(originalLanguage)) {
        return res.status(400).json({ message: 'Invalid originalLanguage code' });
      }
      if (!ALLOWED_LANGUAGE_CODES.has(translationLanguage)) {
        return res.status(400).json({ message: 'Invalid translationLanguage code' });
      }

      const completion = await openAiModel.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a warm, supportive language coach evaluating a recall attempt of a short target story in ${originalLanguage} (the user typed or spoke it from memory — STT errors are possible). Return JSON with:
- "score": integer 0-10 reflecting how closely the transcript matches the target (content, word order, completeness; ignore minor punctuation/case; STT errors are partial penalties).
- "grammarFeedback": **MUST be written in Russian (ru-RU) using the Cyrillic alphabet. Never Polish, English, or any other language — only Russian.** Analyse the user's transcript on its own, as standalone ${originalLanguage} text, regardless of whether it matches the target. Point out every spelling, case, gender, conjugation, agreement, preposition, and word-order mistake with the correct form. Use a polite, encouraging tone (e.g. start with a brief positive note, then list corrections kindly; address the user as "ты"). Do not mention the target story here. If the transcript is already fully correct, praise the user and say there is nothing to correct.
- "matchFeedback": **MUST be written in Russian (ru-RU) using the Cyrillic alphabet.** Briefly and supportively describe how close the attempt is to the target story (what was remembered, what was missed or different). Keep it kind and motivating — never discouraging. 1–2 sentences.
- "corrected": the user's transcript rewritten in ${originalLanguage} with all spelling and grammar mistakes fixed (preserve the user's intent and wording; only fix errors). Empty string only if the transcript is already fully correct.
No extra fields.`,
          },
          {
            role: 'user',
            content: `Target:\n${story}\n\nTranscript:\n${transcript}`,
          },
        ],
      });
      const raw = completion.choices[0].message.content ?? '{}';
      const parsed = JSON.parse(raw);
      const score = Math.max(0, Math.min(10, Math.round(Number(parsed.score) || 0)));
      const grammarFeedback = typeof parsed.grammarFeedback === 'string' ? parsed.grammarFeedback : '';
      const matchFeedback = typeof parsed.matchFeedback === 'string' ? parsed.matchFeedback : '';
      const corrected = typeof parsed.corrected === 'string' ? parsed.corrected : '';

      res.json({ score, grammarFeedback, matchFeedback, corrected });
    } catch (error) {
      console.error('Error checking sentence training:', error);
      res.status(500).json({ message: 'Error checking sentence training' });
    }
  });

  return router;
};
