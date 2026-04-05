import { Router } from 'express';
import { MongoClient } from 'mongodb';
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

  return router;
};
