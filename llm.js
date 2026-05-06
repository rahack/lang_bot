const axios = require('axios');

async function callGemini(prompt, maxTokens) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is empty');
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: maxTokens }
  }, { timeout: 30000 });
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini: empty response');
  return text;
}

async function callGroq(prompt, maxTokens) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is empty');
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    },
    { headers: { Authorization: `Bearer ${key}` }, timeout: 30000 }
  );
  const text = res.data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq: empty response');
  return text;
}

async function callLLM(prompt, maxTokens) {
  try {
    return await callGroq(prompt, maxTokens);
  } catch (e) {
    console.warn('Groq failed, falling back to Gemini:', e.message);
    return await callGemini(prompt, maxTokens);
  }
}

module.exports = { callLLM, callGroq, callGemini };
