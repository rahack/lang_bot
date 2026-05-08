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

if (process.env.WEB_APP_URL) {
  const menuButton = JSON.stringify({
    type: 'web_app',
    text: 'Open app',
    web_app: { url: process.env.WEB_APP_URL }
  });
  // глобальный default для всех пользователей
  bot.setChatMenuButton({ menu_button: menuButton })
    .catch(e => console.warn('setChatMenuButton (default) failed:', e.message));
  // плюс для каждого пишущего — перезатираем per-chat override
  bot.on('message', (msg) => {
    bot.setChatMenuButton({ chat_id: msg.chat.id, menu_button: menuButton })
      .catch(() => {});
  });
}

console.log('Bot started');
