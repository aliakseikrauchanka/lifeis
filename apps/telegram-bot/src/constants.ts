export const DEFAULT_TRANSCRIPTION_DAILY_LIMIT = 100;

/** Max audio size in bytes (10 MB). Telegram caps file size at 50 MB for bots. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Max image size in bytes (10 MB). Must match imageUpload limit in entry-server telegram-routes. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
