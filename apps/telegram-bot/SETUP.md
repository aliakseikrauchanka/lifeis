# Telegram Bot Setup

Follow these steps in order. **Stop at each checkpoint** and complete the step before continuing.

---

## 1. Create a Telegram Bot (Get Bot Token)

**STOP HERE** — You need to request a bot token from Telegram.

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Follow the prompts: choose a name and username (e.g. `My Transcription Bot`, `my_transcription_bot`)
4. BotFather will reply with a token like `7123456789:AAHxxxx...`

**Copy the token** — you’ll use it as `TELEGRAM_BOT_TOKEN`.

---

## 2. Generate API Key for Backend Auth

No external request needed. Run:

```bash
openssl rand -hex 32
```

Use the output as `TELEGRAM_BOT_API_KEY`. **Use the same value** in both the bot and entry-server configs.

---

## 3. Get Your Chat ID (for Whitelist)

**STOP HERE** if you want to restrict which chats can use the bot.

To get your Telegram chat ID:
- **Private chat**: Forward any message from your chat to [@userinfobot](https://t.me/userinfobot) — it will show your user ID
- **Group**: Add @userinfobot to the group, send a message, then remove — it will show the group ID (negative number)

Add the IDs to `TELEGRAM_ALLOWED_CHAT_IDS` as comma-separated values. If you leave this empty, **all chats** can use the bot.

---

## 4. Configure Environment

Add to your `.env` (root for Docker, or `apps/telegram-bot/.env` for local):

```
TELEGRAM_BOT_TOKEN=<paste token from step 1>
TELEGRAM_BOT_API_KEY=<paste value from step 2>
TELEGRAM_ALLOWED_CHAT_IDS=123456789,-987654321
# ↑ Optional. Comma-separated chat/group IDs. Empty = allow all.
BE_URL=http://localhost:3000
# For Docker Compose, BE_URL is set to http://entry-server:3000 automatically
```

**Note**: `TELEGRAM_ALLOWED_CHAT_IDS` must be set in **both** the telegram-bot and entry-server (Docker Compose shares env).

---

## Summary of Required Keys

| Variable | Where to get it |
|---------|------------------|
| `TELEGRAM_BOT_TOKEN` | @BotFather on Telegram (step 1) |
| `TELEGRAM_BOT_API_KEY` | Generate locally with `openssl rand -hex 32` (step 2) |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Optional. Comma-separated. Get IDs via @userinfobot (step 3) |

No other API keys or tokens are required from Telegram.
