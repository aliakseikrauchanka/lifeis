import { Router } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import OpenAI from 'openai';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { ITranslation } from '../domain';

// SECURITY FIX: Allowlist of accepted language codes.
// Used to validate user-supplied language fields before they are interpolated into
// OpenAI system prompts (prevents prompt injection) and before writing to MongoDB.
const ALLOWED_LANGUAGE_CODES = new Set(['pl', 'ru-RU', 'en-US', 'de-DE', 'fr-FR', 'sr-RS', 'fi', 'es']);

// SECURITY FIX: Maximum character lengths to prevent token-stuffing / prompt inflation.
const MAX_TEXT_LENGTH = 2000;
const MAX_TRANSLATION_LENGTH = 2000;
const MAX_LANG_CODE_LENGTH = 10;

export const getTranslationRoutes = (client: MongoClient, openAiModel: OpenAI) => {
  const router = Router();

  router.get('/', verifyAccessToken, async (req, res) => {
    try {
      const userId = res.locals.userId;
      const filter: Record<string, unknown> = { owner_id: userId };

      const originalLanguage = req.query.originalLanguage as string;
      const translationLanguage = req.query.translationLanguage as string;

      // SECURITY FIX: Validate query-param language codes against the allowlist before
      // including them in the MongoDB filter. An unvalidated string here could allow
      // an attacker to probe for documents by injecting unexpected filter values.
      if (originalLanguage) {
        if (!ALLOWED_LANGUAGE_CODES.has(originalLanguage)) {
          return res.status(400).json({ message: 'Invalid originalLanguage code' });
        }
        filter.originalLanguage = originalLanguage;
      }
      if (translationLanguage) {
        if (!ALLOWED_LANGUAGE_CODES.has(translationLanguage)) {
          return res.status(400).json({ message: 'Invalid translationLanguage code' });
        }
        filter.translationLanguage = translationLanguage;
      }

      const translations = await client
        .db('lifeis')
        .collection('translations')
        .find(filter)
        .sort({ timestamp: -1 })
        .toArray();

      res.json({ translations });
    } catch (error) {
      console.error('Error fetching translations:', error);
      res.status(500).json({ message: 'Error fetching translations' });
    }
  });

  router.post('/', verifyAccessToken, async (req, res) => {
    try {
      const { original, translation, originalLanguage, translationLanguage } = req.body;

      if (!original || !translation || !originalLanguage || !translationLanguage) {
        return res.status(400).json({
          message: 'original, translation, originalLanguage, and translationLanguage are required',
        });
      }

      // SECURITY FIX: Enforce maximum field lengths to prevent storing excessively large
      // strings and to guard against token-stuffing if these values are later used in prompts.
      if (typeof original !== 'string' || original.length > MAX_TEXT_LENGTH) {
        return res.status(400).json({ message: `original must be a string of at most ${MAX_TEXT_LENGTH} characters` });
      }
      if (typeof translation !== 'string' || translation.length > MAX_TRANSLATION_LENGTH) {
        return res.status(400).json({ message: `translation must be a string of at most ${MAX_TRANSLATION_LENGTH} characters` });
      }

      // SECURITY FIX: Validate language codes against the allowlist before writing to
      // MongoDB. This prevents storage of arbitrary strings and ensures consistency with
      // the codes the model is designed to handle.
      if (typeof originalLanguage !== 'string' || !ALLOWED_LANGUAGE_CODES.has(originalLanguage)) {
        return res.status(400).json({ message: 'Invalid originalLanguage code' });
      }
      if (typeof translationLanguage !== 'string' || !ALLOWED_LANGUAGE_CODES.has(translationLanguage)) {
        return res.status(400).json({ message: 'Invalid translationLanguage code' });
      }

      const userId = res.locals.userId;
      const doc: Omit<ITranslation, '_id'> = {
        original,
        translation,
        originalLanguage,
        translationLanguage,
        owner_id: userId,
        timestamp: Date.now(),
      };

      const result = await client.db('lifeis').collection('translations').insertOne(doc);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error creating translation:', error);
      res.status(500).json({ message: 'Error creating translation' });
    }
  });

  // PUT /:id — update a translation's original/translation text
  router.put('/:id', verifyAccessToken, async (req, res) => {
    try {
      let objectId: ObjectId;
      try {
        objectId = new ObjectId(req.params.id);
      } catch {
        return res.status(400).json({ message: 'Invalid translation id' });
      }

      const { original, translation } = req.body;
      if (!original && !translation) {
        return res.status(400).json({ message: 'At least one of original or translation is required' });
      }

      const update: Record<string, string> = {};
      if (original) {
        if (typeof original !== 'string' || original.length > MAX_TEXT_LENGTH) {
          return res.status(400).json({ message: `original must be a string of at most ${MAX_TEXT_LENGTH} characters` });
        }
        update.original = original;
      }
      if (translation) {
        if (typeof translation !== 'string' || translation.length > MAX_TRANSLATION_LENGTH) {
          return res.status(400).json({ message: `translation must be a string of at most ${MAX_TRANSLATION_LENGTH} characters` });
        }
        update.translation = translation;
      }

      const userId = res.locals.userId;
      const result = await client
        .db('lifeis')
        .collection('translations')
        .updateOne({ _id: objectId, owner_id: userId }, { $set: update });

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Translation not found' });
      }

      res.json({ updated: true });
    } catch (error) {
      console.error('Error updating translation:', error);
      res.status(500).json({ message: 'Error updating translation' });
    }
  });

  // DELETE /:id — remove a translation and its SRS card
  router.delete('/:id', verifyAccessToken, async (req, res) => {
    try {
      let objectId: ObjectId;
      try {
        objectId = new ObjectId(req.params.id);
      } catch {
        return res.status(400).json({ message: 'Invalid translation id' });
      }

      const userId = res.locals.userId;
      const db = client.db('lifeis');

      // Delete SRS card if it exists
      await db.collection('translation_srs').deleteOne({ owner_id: userId, translation_id: objectId });

      // Delete the translation itself
      const result = await db.collection('translations').deleteOne({ _id: objectId, owner_id: userId });
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Translation not found' });
      }

      res.json({ deleted: true });
    } catch (error) {
      console.error('Error deleting translation:', error);
      res.status(500).json({ message: 'Error deleting translation' });
    }
  });

  // POST /import — bulk import translations from LLN JSON format
  router.post('/import', verifyAccessToken, async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'items array is required' });
      }
      if (items.length > 500) {
        return res.status(400).json({ message: 'Maximum 500 items per import' });
      }

      // Map short LLN language codes to app codes
      const LANG_MAP: Record<string, string> = {
        pl: 'pl',
        ru: 'ru-RU',
        en: 'en-US',
        de: 'de-DE',
        fr: 'fr-FR',
        sr: 'sr-RS',
        fi: 'fi',
        es: 'es',
      };

      const userId = res.locals.userId;
      const now = Date.now();
      const docs: Omit<ITranslation, '_id'>[] = [];
      const skipped: string[] = [];

      for (const item of items) {
        const wordText = item.word?.text;
        const translations = item.wordTranslationsArr;
        if (!wordText || !Array.isArray(translations) || translations.length === 0) {
          skipped.push(item.key || 'unknown');
          continue;
        }

        const originalLanguage = LANG_MAP[item.langCode_G];
        const translationLanguage = LANG_MAP[item.translationLangCode_G];
        if (!originalLanguage || !translationLanguage) {
          skipped.push(wordText);
          continue;
        }
        if (!ALLOWED_LANGUAGE_CODES.has(originalLanguage) || !ALLOWED_LANGUAGE_CODES.has(translationLanguage)) {
          skipped.push(wordText);
          continue;
        }

        const original = String(wordText).slice(0, MAX_TEXT_LENGTH);
        const translation = String(translations[0]).slice(0, MAX_TRANSLATION_LENGTH);

        docs.push({
          original,
          translation,
          originalLanguage,
          translationLanguage,
          owner_id: userId,
          timestamp: now,
        });
      }

      // Filter out translations that already exist for this user
      let inserted = 0;
      let duplicates = 0;
      if (docs.length > 0) {
        const collection = client.db('lifeis').collection('translations');
        const existingTranslations = await collection
          .find({
            owner_id: userId,
            original: { $in: docs.map((d) => d.original) },
          })
          .project({ original: 1, originalLanguage: 1, translationLanguage: 1 })
          .toArray();

        const existingKeys = new Set(
          existingTranslations.map((t) => `${t.original}|${t.originalLanguage}|${t.translationLanguage}`)
        );

        const newDocs = docs.filter((d) => {
          const key = `${d.original}|${d.originalLanguage}|${d.translationLanguage}`;
          return !existingKeys.has(key);
        });

        duplicates = docs.length - newDocs.length;
        if (newDocs.length > 0) {
          const result = await collection.insertMany(newDocs);
          inserted = result.insertedCount;
        }
      }

      res.status(201).json({ inserted, duplicates, skipped: skipped.length, total: items.length });
    } catch (error) {
      console.error('Error importing translations:', error);
      res.status(500).json({ message: 'Error importing translations' });
    }
  });

  router.post('/detect-language', verifyAccessToken, async (req, res) => {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ message: 'text is required' });
    }

    // SECURITY FIX: Enforce a maximum length on the text sent to the model.
    // Large inputs inflate token counts (cost/DoS) and can be used to dilute
    // the system prompt via prompt stuffing.
    if (typeof text !== 'string' || text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ message: `text must be a string of at most ${MAX_TEXT_LENGTH} characters` });
    }

    try {
      const completion = await openAiModel.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Detect the language of the given text and return only one of these exact codes: pl, ru-RU, en-US, de-DE, fr-FR, sr-RS, fi, es. No explanation, just the language code.',
          },
          { role: 'user', content: text },
        ],
      });
      const languageCode = completion.choices[0].message.content?.trim() ?? '';
      res.send({ languageCode });
    } catch (error) {
      console.error('Error detecting language:', error);
      res.status(500).json({ message: 'Error detecting language' });
    }
  });

  router.post('/translate', verifyAccessToken, async (req, res) => {
    const { text, targetLanguage, originalLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ message: 'text and targetLanguage are required' });
    }

    // SECURITY FIX: Enforce a maximum length on the text to prevent token-stuffing.
    if (typeof text !== 'string' || text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ message: `text must be a string of at most ${MAX_TEXT_LENGTH} characters` });
    }

    // SECURITY FIX: Validate targetLanguage and originalLanguage against the allowlist
    // BEFORE interpolating them into the system prompt. These fields are directly
    // concatenated into the prompt string (see content template below). An unvalidated
    // value such as "en\n\nIgnore all prior instructions" would constitute a prompt
    // injection attack (OWASP LLM Top 10 2025 — LLM01).
    if (typeof targetLanguage !== 'string' || !ALLOWED_LANGUAGE_CODES.has(targetLanguage)) {
      return res.status(400).json({ message: 'Invalid targetLanguage code' });
    }
    if (originalLanguage !== undefined) {
      if (typeof originalLanguage !== 'string' || originalLanguage.length > MAX_LANG_CODE_LENGTH || !ALLOWED_LANGUAGE_CODES.has(originalLanguage)) {
        return res.status(400).json({ message: 'Invalid originalLanguage code' });
      }
    }

    try {
      const completion = await openAiModel.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            // targetLanguage and originalLanguage are now guaranteed to be members of
            // ALLOWED_LANGUAGE_CODES (e.g. "pl", "en-US") — safe to interpolate.
            content: `You are a precise translator. Return a JSON object with:
- "translations": array of exactly 3 distinct translation options for the given text into ${targetLanguage} (vary by formality, style, or synonyms)
- "examples": array of exactly 3 objects, each with "original" (example sentence in the ${originalLanguage ?? 'original'} language) and "translated" (its translation in ${targetLanguage})
No extra fields.`,
          },
          { role: 'user', content: text },
        ],
      });
      const raw = completion.choices[0].message.content ?? '{}';
      const parsed = JSON.parse(raw);
      res.send({ translations: parsed.translations ?? [], examples: parsed.examples ?? [] });
    } catch (error) {
      console.error('Error translating text:', error);
      res.status(500).json({ message: 'Error translating text' });
    }
  });

  router.post('/examples', verifyAccessToken, async (req, res) => {
    const { word, language, translationLanguage, translation } = req.body;
    if (typeof word !== 'string' || word.trim().length === 0) {
      return res.status(400).json({ message: 'word must be a non-empty string' });
    }
    if (word.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ message: `word must be at most ${MAX_TEXT_LENGTH} characters` });
    }
    if (typeof language !== 'string' || !ALLOWED_LANGUAGE_CODES.has(language)) {
      return res.status(400).json({ message: 'Invalid language code' });
    }
    if (translationLanguage !== undefined && (typeof translationLanguage !== 'string' || !ALLOWED_LANGUAGE_CODES.has(translationLanguage))) {
      return res.status(400).json({ message: 'Invalid translationLanguage code' });
    }
    if (translation !== undefined && (typeof translation !== 'string' || translation.length > MAX_TRANSLATION_LENGTH)) {
      return res.status(400).json({ message: `translation must be a string of at most ${MAX_TRANSLATION_LENGTH} characters` });
    }

    try {
      const translationHint = translation ? ` The word means "${translation}" in ${translationLanguage}.` : '';
      const prompt = translationLanguage
        ? `Return a JSON object with "examples": an array of exactly 3 objects, each with "original" (a short example sentence using the given word exactly in ${language} language) and "translated" (its translation in ${translationLanguage}).${translationHint} Use the word in the specific meaning matching the translation. No extra fields.`
        : `Return a JSON object with "examples": an array of exactly 3 short example sentences using a given word in ${language} language. No extra fields.`;

      const completion = await openAiModel.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: word },
        ],
      });
      const raw = completion.choices[0].message.content ?? '{}';
      const parsed = JSON.parse(raw);
      res.json({ examples: (parsed.examples ?? []).slice(0, 3) });
    } catch (error) {
      console.error('Error generating examples:', error);
      res.status(500).json({ message: 'Error generating examples' });
    }
  });

  return router;
};
