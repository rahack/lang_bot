const { keyboards } = require('../settings');

module.exports = function register(bot, state) {
  bot.onText(/\/clear(@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    state[chatId] = {};
    await bot.sendMessage(chatId, 'История очищена.', { reply_markup: keyboards.main });
  });
};
