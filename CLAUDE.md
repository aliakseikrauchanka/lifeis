# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development (Nx tasks)
```bash
nx serve entry-app       # Frontend AI agents app (port 4201)
nx serve entry-server    # Backend API server (port 4202)
nx serve logs-app        # Logs/tracking frontend (port 4203)
nx serve telegram-bot    # Telegram bot (voice → transcription)
```

### Build
```bash
nx build entry-app
nx build entry-server
nx build logs-app
nx build common-ui
npm run build            # Production build of entry-server only
```

### Test
```bash
nx test entry-app        # Vitest
nx test entry-server     # Jest
nx test logs-app         # Jest
nx test <project> --testFile=path/to/file.spec.ts  # Single test file
```

### Lint
```bash
nx lint <project>        # Lint a specific project
```

### Docker
```bash
docker-compose up        # Start all services (includes telegram-bot)
```
Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_API_KEY` in `.env` for the bot.

## Architecture

This is an **Nx monorepo** with three apps and two shared libraries.

### Apps

**entry-app** — React/Vite frontend for AI agent interactions. Supports voice input/output via Deepgram (STT) and ElevenLabs (TTS). Uses Flagsmith for feature flags and Sentry for error tracking. Pages: Agents view, Experiments.

**entry-server** — Express.js backend. Connects to MongoDB. Integrates Google Gemini, OpenAI, Deepgram, ElevenLabs, and Google Cloud TTS. Key route groups: `/api/agents`, `/api/logs`, `/api/baskets`, `/api/insights`, `/api/auth`, `/api/gemini`, `/api/openai`, `/api/deepgram`, `/api/elevenlabs`, `/api/telegram`. Rate-limited to 150 req/min.

**telegram-bot** — Telegram bot that transcribes voice messages. Listens for voice/audio, calls `POST /api/telegram/transcribe` (auth: `TELEGRAM_BOT_API_KEY`), replies with transcript. **Setup**: Get `TELEGRAM_BOT_TOKEN` from @BotFather (see [apps/telegram-bot/SETUP.md](apps/telegram-bot/SETUP.md)), generate `TELEGRAM_BOT_API_KEY` with `openssl rand -hex 32`.

**logs-app** — React/Vite frontend for activity/log tracking. Pages: Logs, Chat, Baskets. Uses MUI DatePickers for date range filtering.

### Shared Libraries

**libs/common-ui** — Shared React components (Button, SpeechToText, EditableInput, UserSession, ImagePreview, LanguageSelector), authentication service, and context providers for Deepgram STT, ElevenLabs STT, Microphone, and Audio. Import as `@lifeis/common-ui`.

**libs/node-server-utils** — Shared TypeScript utilities for the Express backend. Import as `@lifeis/node-server-utils`.

### Path Aliases (tsconfig.base.json)
- `@lifeis/common-ui` → `libs/common-ui/src/index.ts`
- `@lifeis/node-server-utils` → `libs/node-server-utils/src/index.ts`
- `#ia/*` → internal alias (check tsconfig.base.json for exact mapping)

### Key Tech
- **Frontend**: React 18, Vite, React Router 6, TanStack Query, MUI, Tailwind CSS
- **Backend**: Node 22+, Express, MongoDB
- **AI**: Google Gemini (primary), OpenAI, Deepgram, ElevenLabs, Google Cloud TTS
- **Auth**: Clerk
- **Monorepo**: Nx 22 with NX Cloud caching

### Notes
- The `documentation.md` file at the root contains known UX constraints to avoid re-introducing (e.g., "When response click focus agent we loose context menu. Do not suggest this.")
