const { keyboards } = require('../settings');

module.exports = function register(bot, state) {
  bot.onText(/\/start(@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    state[chatId] = {};
    await bot.sendMessage(chatId, 'Привет! Выберите команду:', { reply_markup: keyboards.main });
  });
};
