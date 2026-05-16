import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { message, channelPost } from 'telegraf/filters';
import { handleVoice } from './handlers/voice-handler';
import { handleImage } from './handlers/image-handler';
import { config } from './config';

const bot = new Telegraf(config.telegramBotToken);

bot.on(message('voice'), handleVoice);
bot.on(message('audio'), handleVoice);
bot.on(channelPost('voice'), handleVoice);
bot.on(channelPost('audio'), handleVoice);

bot.on(message('photo'), handleImage);
bot.on(channelPost('photo'), handleImage);
bot.on(message('document'), handleImage);
bot.on(channelPost('document'), handleImage);

bot.launch({ dropPendingUpdates: true }).then(() => {
  console.log('[telegram-bot] Bot is running');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
