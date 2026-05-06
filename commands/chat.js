const { keyboards } = require('../settings');
const { callLLM } = require('../llm');

module.exports = function register(bot, state) {
  bot.onText(/\/chat(@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    state[chatId] = { mode: 'chat_gender' };
    await bot.sendMessage(chatId, 'Выберите пол:', { reply_markup: keyboards.gender });
  });

  bot.on('callback_query', async (query) => {
    if (!query.data || !query.data.startsWith('gender_')) return;
    const chatId = query.message.chat.id;
    const gender = query.data.replace('gender_', '');
    state[chatId] = { mode: 'chat', gender };
    const genderText = gender === 'male' ? 'Мужской' : 'Женский';
    await bot.sendMessage(chatId, 'Выбрано: ' + genderText + '\nНапишите тему:');
    try { await bot.answerCallbackQuery(query.id); } catch (e) {}
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    if (!text || text.startsWith('/')) return;
    const s = state[chatId] || {};
    if (s.mode !== 'chat') return;

    try {
      const reply = await callLLM(`You are a German friend. Use "du". Reply in German. ${text}`, 500);
      await bot.sendMessage(chatId, reply);
    } catch (e) {
      await bot.sendMessage(chatId, 'Ошибка: ' + e.message);
    }
  });
};
