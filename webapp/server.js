require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { callLLM } = require('./llm');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const TOKEN = process.env.TELEGRAM_TOKEN;
const SKIP_AUTH = process.env.SKIP_TG_AUTH === '1'; // для локальной отладки

// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function checkInitData(initData) {
  if (!initData || !TOKEN) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return computed === hash;
}

const PROMPTS = {
  check: {
    system:
      'Ты помогаешь учить немецкий. Проверяй грамматику присланного немецкого текста. ' +
      'Если ошибок нет — кратко напиши, что всё верно. Если есть — для каждой ошибки укажи: ' +
      '(1) что именно не так, (2) исправленный вариант, (3) какое грамматическое правило ' +
      'нарушено и почему (падеж, время, порядок слов, артикль и т.д.). ' +
      'Объясняй ТОЛЬКО на русском языке.',
    maxTokens: 800
  },
  translate: {
    system:
      'Ты переводчик RU↔DE. Сам определи язык исходного текста (русский или немецкий) ' +
      'и переведи на другой. Если исходный — русский, пояснения и разбор давай на русском. ' +
      'Если исходный — немецкий, пояснения давай на немецком. Кратко поясняй ключевые ' +
      'переводческие решения.',
    maxTokens: 1000
  },
  chat: {
    system:
      'You are a friendly German native speaker chatting with a learner. ' +
      'Always reply in German. Use "du". Keep replies natural and conversational, ' +
      '1–4 sentences unless asked for more.',
    maxTokens: 500
  }
};

app.post('/api/chat', async (req, res) => {
  try {
    const { mode, history, message, initData } = req.body || {};
    if (!SKIP_AUTH && !checkInitData(initData)) {
      return res.status(401).json({ error: 'invalid initData' });
    }
    const cfg = PROMPTS[mode];
    if (!cfg) return res.status(400).json({ error: 'unknown mode' });
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'empty message' });
    }

    // история приходит как [{role:'user'|'assistant', text}]; ограничим длину
    const safeHistory = Array.isArray(history) ? history.slice(-20) : [];
    const messages = [
      { role: 'system', content: cfg.system },
      ...safeHistory.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.text || '').slice(0, 4000)
      })),
      { role: 'user', content: message.slice(0, 4000) }
    ];

    const reply = await callLLM(messages, cfg.maxTokens);
    res.json({ reply });
  } catch (e) {
    console.error('chat error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/healthz', (_req, res) => res.send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webapp listening on :${PORT}`));
