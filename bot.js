require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { menu } = require('./settings');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const userState = {};

const commands = ['start', 'translate', 'chat', 'check', 'clear'];
for (const name of commands) {
  require(`./commands/${name}`)(bot, userState);
}

bot.setMyCommands(menu).catch(e => console.warn('setMyCommands failed:', e.message));

console.log('Bot started');
