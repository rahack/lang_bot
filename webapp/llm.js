const axios = require('axios');

// messages: [{ role: 'system'|'user'|'assistant', content: string }]
async function callGroq(messages, maxTokens) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is empty');
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    { model, max_tokens: maxTokens, messages },
    { headers: { Authorization: `Bearer ${key}` }, timeout: 30000 }
  );
  const text = res.data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq: empty response');
  return text;
}

async function callGemini(messages, maxTokens) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is empty');
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  // Gemini: system → systemInstruction; user/assistant → contents[] (assistant=model)
  const systemMsg = messages.find(m => m.role === 'system');
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const body = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens }
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

  const res = await axios.post(url, body, { timeout: 30000 });
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini: empty response');
  return text;
}

async function callLLM(messages, maxTokens) {
  try {
    return await callGroq(messages, maxTokens);
  } catch (e) {
    console.warn('Groq failed, falling back to Gemini:', e.message);
    return await callGemini(messages, maxTokens);
  }
}

module.exports = { callLLM };
