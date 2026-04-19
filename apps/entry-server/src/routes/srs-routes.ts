import { Router } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { schedule, Rating } from '../helpers/srs-scheduler';
import { deepSeek } from '../utils/deepseek';

const VALID_RATINGS = new Set<Rating>(['again', 'hard', 'good', 'easy']);
const ALLOWED_LANGUAGE_CODES = new Set(['pl', 'ru-RU', 'en-US', 'de-DE', 'fr-FR', 'sr-RS', 'fi', 'es']);
const LANGUAGE_NAMES: Record<string, string> = {
  pl: 'Polish',
  'ru-RU': 'Russian',
  'en-US': 'English',
  'de-DE': 'German',
  'fr-FR': 'French',
  'sr-RS': 'Serbian',
  fi: 'Finnish',
  es: 'Spanish',
};
function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code;
}
const MAX_TRANSCRIPT_LENGTH = 2000;
const CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const TRAINING_MODEL = 'deepseek-chat';

/**
 * Builds a MongoDB $match filter constraining translations to those that are
 * between the user's native and training languages (in either direction).
 * Returns:
 *  - null if the caller didn't provide a pair (no filtering),
 *  - 'invalid' if the provided values are not valid language codes,
 *  - the $match object otherwise.
 * If both languages are equal, no filter is applied.
 */
function buildLanguagePairFilter(
  nativeLanguage: unknown,
  trainingLanguage: unknown,
): Record<string, unknown> | null | 'invalid' {
  if (nativeLanguage === undefined && trainingLanguage === undefined) return null;
  if (typeof nativeLanguage !== 'string' || typeof trainingLanguage !== 'string') return 'invalid';
  if (!ALLOWED_LANGUAGE_CODES.has(nativeLanguage) || !ALLOWED_LANGUAGE_CODES.has(trainingLanguage)) {
    return 'invalid';
  }
  if (nativeLanguage === trainingLanguage) return null;
  return {
    $or: [
      {
        'translation.originalLanguage': trainingLanguage,
        'translation.translationLanguage': nativeLanguage,
      },
      {
        'translation.originalLanguage': nativeLanguage,
        'translation.translationLanguage': trainingLanguage,
      },
    ],
  };
}

/**
 * If a trainingLanguage is provided and the card's translationLanguage matches it
 * (i.e. stored reversed relative to how the user wants to train), swap the
 * original/translation fields so that `original` is always the training-side text.
 */
function normalizePickedForTraining<T extends { translation: { original: string; translation: string; originalLanguage: string; translationLanguage: string } }>(
  picked: T[],
  trainingLanguage: unknown,
): { picked: T[]; originalLanguage: string; translationLanguage: string } {
  if (picked.length === 0) {
    return { picked, originalLanguage: '', translationLanguage: '' };
  }
  const validTraining =
    typeof trainingLanguage === 'string' && ALLOWED_LANGUAGE_CODES.has(trainingLanguage)
      ? trainingLanguage
      : null;
  const needsSwap =
    validTraining !== null &&
    picked[0].translation.originalLanguage !== validTraining &&
    picked[0].translation.translationLanguage === validTraining;
  if (needsSwap) {
    const normalized = picked.map((c) => ({
      ...c,
      translation: {
        ...c.translation,
        original: c.translation.translation,
        translation: c.translation.original,
        originalLanguage: c.translation.translationLanguage,
        translationLanguage: c.translation.originalLanguage,
      },
    })) as T[];
    return {
      picked: normalized,
      originalLanguage: normalized[0].translation.originalLanguage,
      translationLanguage: normalized[0].translation.translationLanguage,
    };
  }
  return {
    picked,
    originalLanguage: picked[0].translation.originalLanguage,
    translationLanguage: picked[0].translation.translationLanguage,
  };
}

function formatLanguagePairSuffix(nativeLanguage: unknown, trainingLanguage: unknown): string {
  if (
    typeof nativeLanguage === 'string' &&
    typeof trainingLanguage === 'string' &&
    ALLOWED_LANGUAGE_CODES.has(nativeLanguage) &&
    ALLOWED_LANGUAGE_CODES.has(trainingLanguage) &&
    nativeLanguage !== trainingLanguage
  ) {
    return ` for ${trainingLanguage} ↔ ${nativeLanguage}`;
  }
  return '';
}

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
        const langFilter = buildLanguagePairFilter(req.body?.nativeLanguage, req.body?.trainingLanguage);
        if (langFilter === 'invalid') {
          return res.status(400).json({ message: 'Invalid nativeLanguage or trainingLanguage' });
        }
        const pairSuffix = formatLanguagePairSuffix(req.body?.nativeLanguage, req.body?.trainingLanguage);
        const pipeline: Record<string, unknown>[] = [
          { $match: { owner_id: userId, due_at: { $lte: Date.now() } } },
          {
            $lookup: {
              from: 'translations',
              localField: 'translation_id',
              foreignField: '_id',
              as: 'translation',
            },
          },
          { $unwind: '$translation' },
        ];
        if (langFilter) pipeline.push({ $match: langFilter });
        pipeline.push({ $sample: { size: 50 } });
        const dueCards = await srsCollection.aggregate(pipeline).toArray();

        if (dueCards.length === 0) {
          return res.status(404).json({ message: `No due enrolled cards available${pairSuffix}` });
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
            .json({ message: `Need at least ${wordCountRaw} due enrolled cards in the same language${pairSuffix} (have ${sameLang.length})` });
        }
        picked = sameLang.slice(0, wordCountRaw) as typeof picked;
      }

      ({ picked, originalLanguage, translationLanguage } = normalizePickedForTraining(
        picked,
        req.body?.trainingLanguage,
      ));

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

      const completion = await deepSeek.chat.completions.create({
        model: TRAINING_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Return a JSON object with:
- "story": a single string written ONLY in ${languageName(originalLanguage)} (language code ${originalLanguage}). It MUST be ${sentencesClause}. Match CEFR language level ${level} — use vocabulary and grammar typical for a ${level} learner. The story must use all the given words (each at least once). Join sentences with a single space, no numbering or bullets. Do not mix other languages.
- "translation": the same story translated ONLY into ${languageName(translationLanguage)} (language code ${translationLanguage}) as a single natural string (no numbering, no bullets). Do not mix other languages.
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

      const completion = await deepSeek.chat.completions.create({
        model: TRAINING_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a warm, supportive language coach evaluating a recall attempt of a short target story in ${languageName(originalLanguage)} (language code ${originalLanguage}; the user typed or spoke it from memory — STT errors are possible). Return JSON with:
- "score": integer 0-10 reflecting how closely the transcript matches the target (content, word order, completeness; ignore minor punctuation/case; STT errors are partial penalties).
- "grammarFeedback": **MUST be written in Russian (ru-RU) using the Cyrillic alphabet. Never Polish, English, or any other language — only Russian.** Analyse the user's transcript on its own, as standalone ${languageName(originalLanguage)} text, regardless of whether it matches the target. Point out every spelling, case, gender, conjugation, agreement, preposition, and word-order mistake with the correct form. Use a polite, encouraging tone (e.g. start with a brief positive note, then list corrections kindly; address the user as "ты"). Do not mention the target story here. If the transcript is already fully correct, praise the user and say there is nothing to correct.
- "matchFeedback": **MUST be written in Russian (ru-RU) using the Cyrillic alphabet.** Briefly and supportively describe how close the attempt is to the target story (what was remembered, what was missed or different). Keep it kind and motivating — never discouraging. 1–2 sentences.
- "corrected": the user's transcript rewritten ONLY in ${languageName(originalLanguage)} (language code ${originalLanguage}) with all spelling and grammar mistakes fixed (preserve the user's intent and wording; only fix errors). Empty string only if the transcript is already fully correct.
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

  // POST /sentence-construction/generate — pick words (random or by ids), return just the words
  router.post('/sentence-construction/generate', verifyAccessToken, async (req, res) => {
    try {
      const levelRaw = typeof req.body?.level === 'string' ? req.body.level : '';
      const translationIdsRaw = req.body?.translationIds;
      const hasExplicitIds = Array.isArray(translationIdsRaw) && translationIdsRaw.length > 0;

      if (!CEFR_LEVELS.has(levelRaw)) {
        return res.status(400).json({ message: 'level must be one of A1, A2, B1, B2, C1, C2' });
      }
      const userId = res.locals.userId;

      let picked: Array<{ translation: { _id: ObjectId; original: string; translation: string; originalLanguage: string; translationLanguage: string } }>;
      let originalLanguage: string;
      let translationLanguage: string;

      if (hasExplicitIds) {
        if (translationIdsRaw.length > 10) {
          return res.status(400).json({ message: 'Maximum 10 translationIds' });
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
        if (!Number.isInteger(wordCountRaw) || wordCountRaw < 1 || wordCountRaw > 10) {
          return res.status(400).json({ message: 'wordCount must be an integer between 1 and 10' });
        }
        const langFilter = buildLanguagePairFilter(req.body?.nativeLanguage, req.body?.trainingLanguage);
        if (langFilter === 'invalid') {
          return res.status(400).json({ message: 'Invalid nativeLanguage or trainingLanguage' });
        }
        const pairSuffix = formatLanguagePairSuffix(req.body?.nativeLanguage, req.body?.trainingLanguage);
        // Sentence construction intentionally uses ONLY enrolled cards (not the full library).
        // We query translation_srs (enrolled cards), join translations for filtering/metadata.
        const pipeline: Record<string, unknown>[] = [
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
        ];
        if (langFilter) pipeline.push({ $match: langFilter });
        pipeline.push({ $sample: { size: 100 } });
        const sampled = await srsCollection.aggregate(pipeline).toArray();
        if (sampled.length === 0) {
          return res.status(404).json({ message: `No enrolled cards available${pairSuffix}` });
        }
        originalLanguage = sampled[0].translation.originalLanguage;
        translationLanguage = sampled[0].translation.translationLanguage;
        const sameLang = sampled.filter(
          (c) =>
            c.translation.originalLanguage === originalLanguage &&
            c.translation.translationLanguage === translationLanguage,
        );
        if (sameLang.length < wordCountRaw) {
          return res
            .status(404)
            .json({ message: `Need at least ${wordCountRaw} enrolled cards in the same language${pairSuffix} (have ${sameLang.length})` });
        }
        picked = sameLang.slice(0, wordCountRaw) as typeof picked;
      }

      ({ picked, originalLanguage, translationLanguage } = normalizePickedForTraining(
        picked,
        req.body?.trainingLanguage,
      ));

      const words = picked.map((c) => ({
        translationId: c.translation._id.toString(),
        original: c.translation.original,
        translation: c.translation.translation,
      }));

      res.json({ words, originalLanguage, translationLanguage });
    } catch (error) {
      console.error('Error generating sentence construction:', error);
      res.status(500).json({ message: 'Error generating sentence construction' });
    }
  });

  // POST /sentence-construction/check — grammar + CEFR-level-appropriate suggestions
  router.post('/sentence-construction/check', verifyAccessToken, async (req, res) => {
    try {
      const { userText, words, level, originalLanguage } = req.body;

      if (typeof userText !== 'string' || userText.length === 0 || userText.length > MAX_TRANSCRIPT_LENGTH) {
        return res.status(400).json({ message: 'userText must be a non-empty string' });
      }
      if (!Array.isArray(words) || words.length === 0 || words.length > 10) {
        return res.status(400).json({ message: 'words must be a non-empty array (max 10)' });
      }
      const wordOriginals: string[] = [];
      for (const w of words) {
        if (!w || typeof w.original !== 'string' || w.original.length === 0 || w.original.length > 200) {
          return res.status(400).json({ message: 'each word must have a non-empty original string' });
        }
        wordOriginals.push(w.original);
      }
      if (!CEFR_LEVELS.has(level)) {
        return res.status(400).json({ message: 'level must be one of A1, A2, B1, B2, C1, C2' });
      }
      if (!ALLOWED_LANGUAGE_CODES.has(originalLanguage)) {
        return res.status(400).json({ message: 'Invalid originalLanguage code' });
      }

      const completion = await deepSeek.chat.completions.create({
        model: TRAINING_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a warm, supportive language coach reviewing sentences the user wrote in ${languageName(originalLanguage)} (language code ${originalLanguage}) using a given set of words. Target CEFR level: ${level}. Return JSON with:
- "grammarFeedback": **MUST be in Russian (Cyrillic). Never Polish, English, or any other language.** Point out every spelling, case, gender, conjugation, agreement, preposition, and word-order mistake with the correct form. Polite, encouraging tone; address the user as "ты". If the text is correct, praise and say there is nothing to fix.
- "levelSuggestion": **MUST be in Russian (Cyrillic).** Suggest how to rewrite the user's text so it sounds more like CEFR ${level} — richer vocabulary, more idiomatic phrasing, grammar structures typical for ${level}. Explain briefly *why* each suggestion is more ${level}. Kind, supportive tone.
- "improved": the user's text rewritten ONLY in ${languageName(originalLanguage)} (language code ${originalLanguage}) to match CEFR ${level} (grammar-correct, more natural, ${level}-appropriate vocabulary and structures). Preserve meaning and keep using the same target words where possible.
- "usedWords": array of the original target words (from the given list) that appear in the user's text (case-insensitive, stem-tolerant match).
- "missingWords": array of the target words NOT found in the user's text.
No extra fields.`,
          },
          {
            role: 'user',
            content: `Target words: ${wordOriginals.join(', ')}\n\nUser's text:\n${userText}`,
          },
        ],
      });
      const raw = completion.choices[0].message.content ?? '{}';
      const parsed = JSON.parse(raw);
      const grammarFeedback = typeof parsed.grammarFeedback === 'string' ? parsed.grammarFeedback : '';
      const levelSuggestion = typeof parsed.levelSuggestion === 'string' ? parsed.levelSuggestion : '';
      const improved = typeof parsed.improved === 'string' ? parsed.improved : '';
      const usedWords = Array.isArray(parsed.usedWords) ? parsed.usedWords.filter((x: unknown) => typeof x === 'string') : [];
      const missingWords = Array.isArray(parsed.missingWords) ? parsed.missingWords.filter((x: unknown) => typeof x === 'string') : [];

      res.json({ grammarFeedback, levelSuggestion, improved, usedWords, missingWords });
    } catch (error) {
      console.error('Error checking sentence construction:', error);
      res.status(500).json({ message: 'Error checking sentence construction' });
    }
  });

  // POST /sentence-builder/generate — native sentence + shuffled training-language word buttons
  router.post('/sentence-builder/generate', verifyAccessToken, async (req, res) => {
    try {
      const levelRaw = typeof req.body?.level === 'string' ? req.body.level : '';
      if (!CEFR_LEVELS.has(levelRaw)) {
        return res.status(400).json({ message: 'level must be one of A1, A2, B1, B2, C1, C2' });
      }
      const nativeLanguage = typeof req.body?.nativeLanguage === 'string' ? req.body.nativeLanguage : '';
      const trainingLanguage = typeof req.body?.trainingLanguage === 'string' ? req.body.trainingLanguage : '';
      if (!ALLOWED_LANGUAGE_CODES.has(nativeLanguage) || !ALLOWED_LANGUAGE_CODES.has(trainingLanguage)) {
        return res.status(400).json({ message: 'Invalid nativeLanguage or trainingLanguage' });
      }
      if (nativeLanguage === trainingLanguage) {
        return res.status(400).json({ message: 'nativeLanguage and trainingLanguage must differ' });
      }

      const source = req.body?.source === 'library' ? 'library' : 'random';
      const userId = res.locals.userId;

      const tokenize = (s: string): string[] =>
        s
          .split(/\s+/)
          .map((t) => t.replace(/^[.,!?;:"'«»„“”()\-]+|[.,!?;:"'«»„“”()\-]+$/g, ''))
          .filter((t) => t.length > 0);

      const shuffle = <T,>(arr: T[]): T[] => {
        const out = [...arr];
        for (let i = out.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
      };

      if (source === 'library') {
        const langFilter = buildLanguagePairFilter(nativeLanguage, trainingLanguage);
        const pipeline: Record<string, unknown>[] = [
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
        ];
        if (langFilter && langFilter !== 'invalid') pipeline.push({ $match: langFilter });
        pipeline.push({ $sample: { size: 100 } });
        const sampled = (await srsCollection.aggregate(pipeline).toArray()) as Array<{
          translation: { _id: ObjectId; original: string; translation: string; originalLanguage: string; translationLanguage: string };
        }>;
        if (sampled.length === 0) {
          return res.status(404).json({ message: 'No enrolled cards available for this language pair' });
        }
        const normalized = sampled.map((c) => {
          if (c.translation.translationLanguage === trainingLanguage && c.translation.originalLanguage !== trainingLanguage) {
            return {
              translationId: c.translation._id.toString(),
              trainingText: c.translation.translation,
              nativeText: c.translation.original,
            };
          }
          return {
            translationId: c.translation._id.toString(),
            trainingText: c.translation.original,
            nativeText: c.translation.translation,
          };
        });
        const candidates = normalized.filter((c) => tokenize(c.trainingText).length >= 4);
        if (candidates.length === 0) {
          return res.status(404).json({
            message: 'No enrolled cards with sentences (4+ words) in the training language. Add longer phrases to your library.',
          });
        }
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        const words = tokenize(pick.trainingText);
        return res.json({
          trainingSentence: pick.trainingText,
          nativeSentence: pick.nativeText,
          words,
          shuffled: shuffle(words),
          originalLanguage: trainingLanguage,
          translationLanguage: nativeLanguage,
          source: 'library',
          translationId: pick.translationId,
        });
      }

      const completion = await deepSeek.chat.completions.create({
        model: TRAINING_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Generate one sentence for a ${levelRaw} learner. The sentence must contain BETWEEN 6 AND 12 words in ${languageName(trainingLanguage)} (language code ${trainingLanguage}). Return JSON with:
- "trainingSentence": the sentence ONLY in ${languageName(trainingLanguage)} (language code ${trainingLanguage}), written naturally with normal punctuation and capitalization, matching CEFR level ${levelRaw} vocabulary and grammar.
- "nativeSentence": the same sentence translated ONLY into ${languageName(nativeLanguage)} (language code ${nativeLanguage}), natural and idiomatic.
- "words": array of strings — the exact tokens of "trainingSentence" in order, one token per word. Strip outer punctuation from each token (commas, periods, question/exclamation marks), but keep internal apostrophes and hyphens intact. Preserve casing as it appears in the sentence.
No extra fields.`,
          },
          { role: 'user', content: `Level: ${levelRaw}` },
        ],
      });
      const raw = completion.choices[0].message.content ?? '{}';
      const parsed = JSON.parse(raw);
      const trainingSentence = typeof parsed.trainingSentence === 'string' ? parsed.trainingSentence.trim() : '';
      const nativeSentence = typeof parsed.nativeSentence === 'string' ? parsed.nativeSentence.trim() : '';
      const words = Array.isArray(parsed.words)
        ? parsed.words.filter((w: unknown) => typeof w === 'string' && w.length > 0)
        : [];
      if (!trainingSentence || !nativeSentence || words.length < 4) {
        return res.status(502).json({ message: 'Failed to generate a valid sentence' });
      }
      const shuffled = [...words];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      res.json({
        trainingSentence,
        nativeSentence,
        words,
        shuffled,
        originalLanguage: trainingLanguage,
        translationLanguage: nativeLanguage,
      });
    } catch (error) {
      console.error('Error generating sentence builder:', error);
      res.status(500).json({ message: 'Error generating sentence builder' });
    }
  });

  // POST /word-builder/generate — native word/phrase + training-language text to reconstruct letter-by-letter
  router.post('/word-builder/generate', verifyAccessToken, async (req, res) => {
    try {
      const levelRaw = typeof req.body?.level === 'string' ? req.body.level : '';
      if (!CEFR_LEVELS.has(levelRaw)) {
        return res.status(400).json({ message: 'level must be one of A1, A2, B1, B2, C1, C2' });
      }
      const nativeLanguage = typeof req.body?.nativeLanguage === 'string' ? req.body.nativeLanguage : '';
      const trainingLanguage = typeof req.body?.trainingLanguage === 'string' ? req.body.trainingLanguage : '';
      if (!ALLOWED_LANGUAGE_CODES.has(nativeLanguage) || !ALLOWED_LANGUAGE_CODES.has(trainingLanguage)) {
        return res.status(400).json({ message: 'Invalid nativeLanguage or trainingLanguage' });
      }
      if (nativeLanguage === trainingLanguage) {
        return res.status(400).json({ message: 'nativeLanguage and trainingLanguage must differ' });
      }

      const source = req.body?.source === 'library' ? 'library' : 'random';
      const userId = res.locals.userId;

      if (source === 'library') {
        const langFilter = buildLanguagePairFilter(nativeLanguage, trainingLanguage);
        const pipeline: Record<string, unknown>[] = [
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
        ];
        if (langFilter && langFilter !== 'invalid') pipeline.push({ $match: langFilter });
        pipeline.push({ $sample: { size: 100 } });
        const sampled = (await srsCollection.aggregate(pipeline).toArray()) as Array<{
          translation: { _id: ObjectId; original: string; translation: string; originalLanguage: string; translationLanguage: string };
        }>;
        if (sampled.length === 0) {
          return res.status(404).json({ message: 'No enrolled cards available for this language pair' });
        }
        const normalized = sampled.map((c) => {
          if (c.translation.translationLanguage === trainingLanguage && c.translation.originalLanguage !== trainingLanguage) {
            return {
              translationId: c.translation._id.toString(),
              trainingText: c.translation.translation,
              nativeText: c.translation.original,
            };
          }
          return {
            translationId: c.translation._id.toString(),
            trainingText: c.translation.original,
            nativeText: c.translation.translation,
          };
        });
        const candidates = normalized.filter((c) => c.trainingText.trim().length >= 2 && c.trainingText.length <= 40);
        if (candidates.length === 0) {
          return res.status(404).json({ message: 'No suitable enrolled cards (≤40 chars) for word builder' });
        }
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return res.json({
          trainingText: pick.trainingText,
          nativeText: pick.nativeText,
          originalLanguage: trainingLanguage,
          translationLanguage: nativeLanguage,
          source: 'library',
          translationId: pick.translationId,
        });
      }

      const completion = await deepSeek.chat.completions.create({
        model: TRAINING_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Generate one short word OR short phrase (1 to 4 words, total length between 3 and 30 characters) in ${languageName(trainingLanguage)} (language code ${trainingLanguage}) appropriate for a CEFR ${levelRaw} learner. Return JSON with:
- "trainingText": the word or phrase ONLY in ${languageName(trainingLanguage)} (language code ${trainingLanguage}), natural casing, no trailing punctuation.
- "nativeText": the same word/phrase translated ONLY into ${languageName(nativeLanguage)} (language code ${nativeLanguage}), natural and concise.
No extra fields.`,
          },
          { role: 'user', content: `Level: ${levelRaw}` },
        ],
      });
      const raw = completion.choices[0].message.content ?? '{}';
      const parsed = JSON.parse(raw);
      const trainingText = typeof parsed.trainingText === 'string' ? parsed.trainingText.trim() : '';
      const nativeText = typeof parsed.nativeText === 'string' ? parsed.nativeText.trim() : '';
      if (!trainingText || !nativeText || trainingText.length < 2 || trainingText.length > 40) {
        return res.status(502).json({ message: 'Failed to generate a valid word/phrase' });
      }
      res.json({
        trainingText,
        nativeText,
        originalLanguage: trainingLanguage,
        translationLanguage: nativeLanguage,
        source: 'random',
      });
    } catch (error) {
      console.error('Error generating word builder:', error);
      res.status(500).json({ message: 'Error generating word builder' });
    }
  });

  return router;
};
