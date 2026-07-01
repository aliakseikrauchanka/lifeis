import { Router } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { ITranslation } from '../domain';
import { deepSeek } from '../utils/deepseek';
import { getGlosbeTranslation } from '../utils/glosbe-scraper';
import { getPwnDictionaryEntry } from '../utils/sjp-pwn-scraper';
import { formatEntry } from '../helpers/format-entry';
import { buildImportDocs, importKey, splitNewAndDuplicates } from '../helpers/import-translations';
import { parseTranslationJson, parseExplanationJson } from '../helpers/parse-translation-json';

const anthropic = new Anthropic();

const GLOSBE_LANG_MAP: Record<string, string> = {
  pl: 'pl',
  'ru-RU': 'ru',
  'en-US': 'en',
  'de-DE': 'de',
  'fr-FR': 'fr',
  'sr-RS': 'sr',
  fi: 'fi',
  es: 'es',
};

// SECURITY FIX: Allowlist of accepted language codes.
// Used to validate user-supplied language fields before they are interpolated into
// OpenAI system prompts (prevents prompt injection) and before writing to MongoDB.
const ALLOWED_LANGUAGE_CODES = new Set(['pl', 'ru-RU', 'en-US', 'de-DE', 'fr-FR', 'sr-RS', 'fi', 'es']);

// SECURITY FIX: Maximum character lengths to prevent token-stuffing / prompt inflation.
const MAX_TEXT_LENGTH = 2000;
const MAX_TRANSLATION_LENGTH = 2000;
const MAX_LANG_CODE_LENGTH = 10;

// UI interface locales (from the training app) → human-readable language name used in prompts.
// Only the mapped names are ever interpolated, so an unknown uiLanguage is injection-safe (falls back to English).
const UI_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ru: 'Russian',
  pl: 'Polish',
  es: 'Spanish',
};
const SUPPORTED_PROVIDERS = new Set(['openai', 'deepseek', 'glosbe', 'gemini', 'claude-sonnet', 'claude-opus']);

export const getTranslationRoutes = (client: MongoClient, openAiModel: OpenAI, genAi: GoogleGenerativeAI) => {
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

  // GET /added-since?since=<ms> — translations added since the given timestamp.
  // Each item is joined with the user's srs collection to expose an `enrolled` flag.
  // `since` defaults to start of UTC day if omitted; clamped to the last 180 days.
  router.get('/added-since', verifyAccessToken, async (req, res) => {
    try {
      const userId = res.locals.userId;
      const now = Date.now();
      const MAX_WINDOW_MS = 180 * 86_400_000;
      const MIN_SINCE = now - MAX_WINDOW_MS;
      const MAX_SINCE = now + 86_400_000;

      const sinceRaw = req.query.since;
      let since: number;
      if (sinceRaw === undefined) {
        const d = new Date();
        since = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      } else {
        const parsed = typeof sinceRaw === 'string' ? Number(sinceRaw) : NaN;
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
          return res
            .status(400)
            .json({ message: 'since must be an epoch-ms timestamp within the last 180 days' });
        }
        since = parsed;
      }

      if (since < MIN_SINCE || since > MAX_SINCE) {
        return res
          .status(400)
          .json({ message: 'since must be an epoch-ms timestamp within the last 180 days' });
      }

      const translations = await client
        .db('lifeis')
        .collection('translations')
        .aggregate([
          { $match: { owner_id: userId, timestamp: { $gte: since } } },
          {
            $lookup: {
              from: 'srs',
              let: { tid: '$_id', oid: '$owner_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$translation_id', '$$tid'] },
                        { $eq: ['$owner_id', '$$oid'] },
                      ],
                    },
                  },
                },
                { $limit: 1 },
                { $project: { _id: 1 } },
              ],
              as: 'srs',
            },
          },
          { $addFields: { enrolled: { $gt: [{ $size: '$srs' }, 0] } } },
          { $project: { srs: 0 } },
          { $sort: { timestamp: -1 } },
        ])
        .toArray();

      res.json({ translations });
    } catch (error) {
      console.error('Error fetching added-since translations:', error);
      res.status(500).json({ message: 'Error fetching added-since translations' });
    }
  });

  router.post('/', verifyAccessToken, async (req, res) => {
    try {
      let { original, translation } = req.body;
      const { originalLanguage, translationLanguage } = req.body;

      if (!original || !translation || !originalLanguage || !translationLanguage) {
        return res.status(400).json({
          message: 'original, translation, originalLanguage, and translationLanguage are required',
        });
      }

      // Enforce string type before normalizing.
      if (typeof original !== 'string' || typeof translation !== 'string') {
        return res.status(400).json({ message: 'original and translation must be strings' });
      }

      // Normalize text before length/dedup checks so dedup compares normalized values.
      original = formatEntry(original);
      translation = formatEntry(translation);

      // Reject values that became empty after normalization (e.g. "." or whitespace).
      if (original.length === 0 || translation.length === 0) {
        return res.status(400).json({
          message: 'original and translation must not be empty after normalizing whitespace and punctuation',
        });
      }

      // SECURITY FIX: Enforce maximum field lengths to prevent storing excessively large
      // strings and to guard against token-stuffing if these values are later used in prompts.
      if (original.length > MAX_TEXT_LENGTH) {
        return res.status(400).json({ message: `original must be a string of at most ${MAX_TEXT_LENGTH} characters` });
      }
      if (translation.length > MAX_TRANSLATION_LENGTH) {
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
      const collection = client.db('lifeis').collection('translations');

      const existing = await collection.findOne(
        { owner_id: userId, original, translation, originalLanguage, translationLanguage },
        { collation: { locale: 'en', strength: 2 } },
      );
      if (existing) {
        return res.status(409).json({
          message: 'Translation already exists for this original, translation, and language pair',
          existingId: existing._id,
        });
      }

      const doc: Omit<ITranslation, '_id'> = {
        original,
        translation,
        originalLanguage,
        translationLanguage,
        owner_id: userId,
        timestamp: Date.now(),
      };

      const result = await collection.insertOne(doc);
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
        if (typeof original !== 'string') {
          return res.status(400).json({ message: `original must be a string of at most ${MAX_TEXT_LENGTH} characters` });
        }
        const formatted = formatEntry(original);
        if (formatted.length === 0) {
          return res.status(400).json({ message: 'original must not be empty after normalizing whitespace and punctuation' });
        }
        if (formatted.length > MAX_TEXT_LENGTH) {
          return res.status(400).json({ message: `original must be a string of at most ${MAX_TEXT_LENGTH} characters` });
        }
        update.original = formatted;
      }
      if (translation) {
        if (typeof translation !== 'string') {
          return res.status(400).json({ message: `translation must be a string of at most ${MAX_TRANSLATION_LENGTH} characters` });
        }
        const formatted = formatEntry(translation);
        if (formatted.length === 0) {
          return res.status(400).json({ message: 'translation must not be empty after normalizing whitespace and punctuation' });
        }
        if (formatted.length > MAX_TRANSLATION_LENGTH) {
          return res.status(400).json({ message: `translation must be a string of at most ${MAX_TRANSLATION_LENGTH} characters` });
        }
        update.translation = formatted;
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
      const { items, dryRun } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'items array is required' });
      }
      if (items.length > 500) {
        return res.status(400).json({ message: 'Maximum 500 items per import' });
      }

      const userId = res.locals.userId;
      const now = Date.now();
      const { docs, skipped } = buildImportDocs(items, {
        userId,
        now,
        allowedLanguageCodes: ALLOWED_LANGUAGE_CODES,
        maxTextLength: MAX_TEXT_LENGTH,
        maxTranslationLength: MAX_TRANSLATION_LENGTH,
      });

      // Find which of these already exist for this user (dedup on normalized original + language pair).
      let newDocs = docs;
      let duplicateDocs: typeof docs = [];
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
          existingTranslations.map((t) =>
            importKey({
              original: t.original,
              originalLanguage: t.originalLanguage,
              translationLanguage: t.translationLanguage,
            }),
          ),
        );

        const split = splitNewAndDuplicates(docs, existingKeys);
        newDocs = split.newDocs;
        duplicateDocs = split.duplicates;
      }

      if (dryRun) {
        return res.status(200).json({
          total: items.length,
          toImportCount: newDocs.length,
          duplicates: duplicateDocs.map((d) => d.original),
          skipped,
        });
      }

      let inserted = 0;
      if (newDocs.length > 0) {
        const collection = client.db('lifeis').collection('translations');
        const result = await collection.insertMany(newDocs);
        inserted = result.insertedCount;
      }

      res.status(201).json({
        inserted,
        duplicates: duplicateDocs.length,
        skipped: skipped.length,
        total: items.length,
      });
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

  /**
   * Runs a JSON-returning prompt against the given LLM provider and returns the raw JSON string.
   * Not for glosbe (a dictionary scrape) — callers handle that provider separately.
   */
  const runLLMJson = async (
    provider: string,
    systemPrompt: string,
    userText: string,
    maxTokens = 1024,
  ): Promise<string> => {
    if (provider === 'openai' || provider === 'deepseek') {
      const client = provider === 'openai' ? openAiModel : deepSeek;
      const model = provider === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat';
      const completion = await client.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
      });
      return completion.choices[0].message.content ?? '{}';
    }
    if (provider === 'gemini') {
      const model = genAi.getGenerativeModel({
        model: 'gemini-3.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
      });
      const result = await model.generateContent([systemPrompt, userText]);
      return result.response.text() ?? '{}';
    }
    // claude-sonnet | claude-opus
    const result = await anthropic.messages.create({
      model: provider === 'claude-opus' ? 'claude-opus-4-8' : 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: `${systemPrompt}\nRespond with only the JSON object, no surrounding prose or code fences.`,
      messages: [{ role: 'user', content: userText }],
    });
    return result.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '{}';
  };

  /**
   * Validates the shared body of the on-demand /explain and /correct endpoints.
   * Returns either an error (with HTTP status) or the validated, ready-to-use fields.
   */
  const validateAnalysisRequest = (
    body: unknown,
  ):
    | { error: { status: number; message: string } }
    | { text: string; language: string; provider: string; langName: string } => {
    const { text, language, provider, uiLanguage } = (body ?? {}) as {
      text?: unknown;
      language?: unknown;
      provider?: unknown;
      uiLanguage?: unknown;
    };
    if (typeof text !== 'string' || text.trim().length === 0) {
      return { error: { status: 400, message: 'text must be a non-empty string' } };
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return { error: { status: 400, message: `text must be at most ${MAX_TEXT_LENGTH} characters` } };
    }
    if (typeof language !== 'string' || !ALLOWED_LANGUAGE_CODES.has(language)) {
      return { error: { status: 400, message: 'Invalid language code' } };
    }
    if (typeof provider !== 'string' || !SUPPORTED_PROVIDERS.has(provider)) {
      return { error: { status: 400, message: 'Invalid provider' } };
    }
    // uiLanguage is not security-sensitive: only the mapped name is interpolated, unknown → English.
    const langName = (typeof uiLanguage === 'string' && UI_LANGUAGE_NAMES[uiLanguage]) || 'English';
    return { text, language, provider, langName };
  };

  router.post('/translate', verifyAccessToken, async (req, res) => {
    const { text, targetLanguage, originalLanguage, provider, uiLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ message: 'text and targetLanguage are required' });
    }
    if (typeof text !== 'string' || text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ message: `text must be a string of at most ${MAX_TEXT_LENGTH} characters` });
    }
    if (typeof targetLanguage !== 'string' || !ALLOWED_LANGUAGE_CODES.has(targetLanguage)) {
      return res.status(400).json({ message: 'Invalid targetLanguage code' });
    }
    if (originalLanguage !== undefined) {
      if (
        typeof originalLanguage !== 'string' ||
        originalLanguage.length > MAX_LANG_CODE_LENGTH ||
        !ALLOWED_LANGUAGE_CODES.has(originalLanguage)
      ) {
        return res.status(400).json({ message: 'Invalid originalLanguage code' });
      }
    }
    if (typeof provider !== 'string' || !SUPPORTED_PROVIDERS.has(provider)) {
      return res.status(400).json({ message: 'Invalid provider' });
    }
    // uiLanguage is not security-sensitive: only the mapped name is interpolated, unknown → English.
    const uiLangName = (typeof uiLanguage === 'string' && UI_LANGUAGE_NAMES[uiLanguage]) || 'English';

    const systemPrompt = `You are a precise translator and proofreader. The given text is written in ${originalLanguage ?? 'its original language'}. Return a JSON object with:
- "translations": array of exactly 3 distinct translation options for the given text into ${targetLanguage} (vary by formality, style, or synonyms)
- "examples": array of exactly 3 objects, each with "original" (example sentence in ${originalLanguage ?? 'original'} language) and "translated" (its translation in ${targetLanguage})
- "correction": null if the given text has no spelling or grammar mistake; otherwise an object {"corrected": the corrected text in ${originalLanguage ?? 'the original language'}, "what": what was wrong written in ${uiLangName}, "why": why it is wrong written in ${uiLangName}}
No extra fields.`;

    try {
      if (provider === 'glosbe') {
        const from = originalLanguage ? GLOSBE_LANG_MAP[originalLanguage] : undefined;
        const to = GLOSBE_LANG_MAP[targetLanguage];
        if (!from || !to) {
          return res.json({ translations: [], examples: [], correction: null, error: null });
        }
        const result = await getGlosbeTranslation(text, {
          fromLang: from,
          toLang: to,
          maxRetries: 2,
          requestDelay: 500,
        });
        return res.json({ translations: result.translations ?? [], examples: [], correction: null, error: null });
      }
      const raw = await runLLMJson(provider, systemPrompt, text);
      return res.json({ ...parseTranslationJson(raw), error: null });
    } catch (err) {
      return res.json({ translations: [], examples: [], correction: null, error: (err as Error)?.message ?? 'failed' });
    }
  });

  // On-demand grammar explanation for a single word/phrase, written in the UI interface language.
  router.post('/explain', verifyAccessToken, async (req, res) => {
    const v = validateAnalysisRequest(req.body);
    if ('error' in v) return res.status(v.error.status).json({ message: v.error.message });
    if (v.provider === 'glosbe') {
      return res.json({ explanation: null, error: null });
    }

    const systemPrompt = `You are a language tutor. The user message is a word or phrase written in ${v.language}. Return a JSON object with an "explanation" object:
- "baseForm": the dictionary / base form (lemma) of the word in ${v.language} (e.g. nominative singular for nouns, infinitive for verbs); null for multi-word phrases
- "meaning": a brief plain-language definition of the word (1-2 sentences) written in ${v.langName}
- "partOfSpeech": a short label such as "noun (masculine, animate)" or "verb (imperfective)", written in ${v.langName}
- "inflection": null for indeclinable words or multi-word phrases; otherwise the FULL paradigm of the BASE FORM (lemma) — if the given word is an inflected form, still decline/conjugate its base form across all cases/persons. An object with "title" (e.g. "Declension" or "Conjugation", written in ${v.langName}), "columns" (array of column headers, first usually "", written in ${v.langName}), and "rows" (array of objects with "label" for the case/person written in ${v.langName} and "cells" matching the columns)
- "synonyms": an array of up to 6 common synonyms or near-synonyms of the word in ${v.language} (the same language as the word); empty array if there are none
- "note": a short usage note written in ${v.langName}, or null
Write ALL explanatory text (meaning, labels, titles, notes) in ${v.langName}, but keep the actual inflected word forms in the "cells" in ${v.language}. No extra fields.`;

    try {
      const raw = await runLLMJson(v.provider, systemPrompt, v.text, 2048);
      return res.json({ explanation: parseExplanationJson(raw), error: null });
    } catch (err) {
      return res.json({ explanation: null, error: (err as Error)?.message ?? 'failed' });
    }
  });

  // Polish dictionary lookup scraped from sjp.pwn.pl. Provider-independent; Polish only.
  router.post('/dictionary', verifyAccessToken, async (req, res) => {
    const { text, language } = req.body ?? {};
    if (typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ message: 'text must be a non-empty string' });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ message: `text must be at most ${MAX_TEXT_LENGTH} characters` });
    }
    if (language !== 'pl') {
      return res.status(400).json({ message: 'Dictionary lookup is only available for Polish (pl)' });
    }

    try {
      const entry = await getPwnDictionaryEntry(text.trim());
      return res.json({ entry, error: null });
    } catch (err) {
      return res.json({ entry: null, error: (err as Error)?.message ?? 'failed' });
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
