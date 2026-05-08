const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const chatEl = document.getElementById('chat');
const formEl = document.getElementById('composer');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const modesEl = document.getElementById('modes');

// Контекст (история) хранится отдельно для каждого режима только в браузере.
const histories = { translate: [], chat: [], check: [] };
const placeholders = {
  translate: 'Текст для перевода (RU или DE)…',
  chat: 'Schreib auf Deutsch…',
  check: 'Немецкий текст для проверки…'
};

let currentMode = 'translate';

function setMode(mode) {
  currentMode = mode;
  for (const btn of modesEl.querySelectorAll('.mode')) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  }
  inputEl.placeholder = placeholders[mode];
  renderHistory();
}

function renderHistory() {
  chatEl.innerHTML = '';
  const hist = histories[currentMode];
  for (const m of hist) appendBubble(m.role, m.text);
}

function appendBubble(role, text) {
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

modesEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode');
  if (!btn) return;
  setMode(btn.dataset.mode);
});

inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    formEl.requestSubmit();
  }
});

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;

  const mode = currentMode;
  const hist = histories[mode];
  hist.push({ role: 'user', text });
  appendBubble('user', text);
  inputEl.value = '';
  inputEl.style.height = 'auto';

  sendBtn.disabled = true;
  const typing = appendBubble('assistant', '…');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        history: hist.slice(0, -1), // без текущего, его шлём отдельно
        message: text,
        initData: tg?.initData || ''
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    typing.remove();
    hist.push({ role: 'assistant', text: data.reply });
    // если пользователь не переключил режим — рендерим, иначе история сохранится и появится при возврате
    if (currentMode === mode) appendBubble('assistant', data.reply);
  } catch (err) {
    typing.remove();
    if (currentMode === mode) appendBubble('error', 'Ошибка: ' + err.message);
    // откатим user-сообщение из истории, чтобы можно было отправить ещё раз
    hist.pop();
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
});

setMode('translate');
