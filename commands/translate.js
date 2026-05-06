const { keyboards } = require('../settings');
const { callLLM } = require('../llm');

module.exports = function register(bot, state) {
  bot.onText(/\/translate(@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    state[chatId] = { mode: 'translate_dir' };
    await bot.sendMessage(chatId, 'Выберите направление:', { reply_markup: keyboards.translate });
  });

  bot.on('callback_query', async (query) => {
    if (!query.data || !query.data.startsWith('dir_')) return;
    const chatId = query.message.chat.id;
    const direction = query.data.replace('dir_', '');
    state[chatId] = { mode: 'translate', direction };
    const dirText = direction === 'ru-de' ? 'RU → DE' : 'DE → RU';
    await bot.sendMessage(chatId, 'Выбрано: ' + dirText + '\nВведите текст:');
    try { await bot.answerCallbackQuery(query.id); } catch (e) {}
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    if (!text || text.startsWith('/')) return;
    const s = state[chatId] || {};
    if (s.mode !== 'translate') return;

    const isRuDe = s.direction === 'ru-de';
    const prompt = isRuDe
      ? `Переведи с русского на немецкий. Любые пояснения, комментарии и разбор переводческих решений давай ТОЛЬКО на русском языке. Текст: ${text}`
      : `Übersetze vom Deutschen ins Russische. Alle Erläuterungen, Kommentare und Analysen der Übersetzungsentscheidungen gib AUSSCHLIESSLICH auf Deutsch. Text: ${text}`;
    try {
      const reply = await callLLM(prompt, 1000);
      await bot.sendMessage(chatId, '✅ ' + reply);
    } catch (e) {
      await bot.sendMessage(chatId, 'Ошибка: ' + e.message);
    }
  });
};
