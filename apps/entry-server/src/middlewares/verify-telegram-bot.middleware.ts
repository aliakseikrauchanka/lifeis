import { Request, Response, NextFunction } from 'express';

function getAllowedChatIds(): Set<number> | null {
  const raw = process.env.TELEGRAM_ALLOWED_CHAT_IDS?.trim();
  if (!raw) return null;
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));
  return ids.length > 0 ? new Set(ids) : null;
}

export const verifyTelegramBotKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] ?? req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(401).json({ error: 'API key missing' });
  }

  const expectedKey = process.env.TELEGRAM_BOT_API_KEY;
  if (!expectedKey) {
    console.error(
      'TELEGRAM_BOT_API_KEY is not configured. Add to .env and entry-server env. Generate with: openssl rand -hex 32'
    );
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'TELEGRAM_BOT_API_KEY is not set. See apps/telegram-bot/SETUP.md',
    });
  }

  if (apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

export const verifyTelegramChatId = (req: Request, res: Response, next: NextFunction) => {
  const allowedIds = getAllowedChatIds();
  if (!allowedIds) return next(); // No whitelist = allow all

  const chatIdHeader = req.headers['x-telegram-chat-id'];
  const chatId = typeof chatIdHeader === 'string' ? parseInt(chatIdHeader, 10) : NaN;

  if (Number.isNaN(chatId) || !allowedIds.has(chatId)) {
    return res.status(403).json({ error: 'Chat not allowed', message: 'This chat is not whitelisted' });
  }

  next();
};
