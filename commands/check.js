const { callLLM } = require('../llm');

module.exports = function register(bot, state) {
  bot.onText(/\/check(@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    state[chatId] = { mode: 'check' };
    await bot.sendMessage(chatId, 'Отправьте текст на немецком для проверки:');
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    if (!text || text.startsWith('/')) return;
    const s = state[chatId] || {};
    if (s.mode !== 'check') return;

    try {
      const reply = await callLLM(
        `Проверь грамматику немецкого текста: "${text}". Если ошибок нет — кратко напиши, что всё верно. Если есть — для каждой ошибки укажи: (1) что именно не так, (2) исправленный вариант, (3) какое грамматическое правило нарушено и почему (падеж, время, порядок слов, артикль и т.д.). Объясняй ТОЛЬКО на русском языке.`,
        800
      );
      await bot.sendMessage(chatId, '🔍 ' + reply);
    } catch (e) {
      await bot.sendMessage(chatId, 'Ошибка: ' + e.message);
    }
  });
};
