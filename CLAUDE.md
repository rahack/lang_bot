# CLAUDE.md

Контекст проекта для работы AI-агента в этом репозитории.

## Обзор

Telegram-бот для изучения немецкого языка: перевод RU↔DE, свободный чат на немецком и проверка грамматики. Доступ — двумя способами:
1. **Чат с ботом** (polling, `node-telegram-bot-api`) — команды `/translate`, `/chat`, `/check`.
2. **Telegram Mini App** (`webapp/`) — открывается через menu-button слева от поля ввода. UI с переключателями режимов и общим окном чата.

LLM-провайдеры — **Groq** (primary) и **Google Gemini** (fallback), оба с бесплатным тиром.

Стек: **Node.js**, без фреймворков/TS/тестов. Один репозиторий, **два независимых процесса**: `node bot.js` и `node webapp/server.js`. Общий `.env` (на VPS — симлинк `webapp/.env -> ../.env`).

## Структура

```
bot.js              # точка входа бота: создание бота, setMyCommands, setChatMenuButton
settings.js         # inline-клавиатуры + список команд для setMyCommands
llm.js              # callGroq + callGemini + callLLM (с fallback) — для бота
commands/
  start.js          # /start
  translate.js      # /translate + callback dir_* + обработчик текста в режиме translate
  chat.js           # /chat + callback gender_* + обработчик текста в режиме chat
  check.js          # /check + обработчик текста в режиме check
  clear.js          # /clear
webapp/             # Mini App — отдельный сервис
  server.js         # Express, POST /api/chat, валидация Telegram initData
  llm.js            # тот же контракт, но принимает messages[] (с историей)
  public/
    index.html      # переключатели режимов + окно чата
    app.js          # vanilla JS, история per-mode в памяти браузера
    style.css       # тема Telegram через --tg-theme-* CSS-переменные
DEPLOY_VPS.md       # пошаговая инструкция production-деплоя на Debian 11
```

- `package.json` (бот): `node-telegram-bot-api`, `axios`, `dotenv`.
- `webapp/package.json`: `express`, `axios`, `dotenv`.
- `.env` — читается через `dotenv`. Требуемые переменные:
  - `TELEGRAM_TOKEN` — токен бота от @BotFather
  - `GROQ_API_KEY`, `GROQ_MODEL` (по умолчанию `llama-3.3-70b-versatile`) — https://console.groq.com
  - `GEMINI_API_KEY`, `GEMINI_MODEL` (по умолчанию `gemini-2.0-flash`) — https://aistudio.google.com/apikey
  - `WEB_APP_URL` (опц.) — публичный HTTPS-URL Mini App. Если задан, бот при старте регистрирует menu-button через `setChatMenuButton`.
  - `SKIP_TG_AUTH=1` (опц., только для webapp) — отключает валидацию `initData`. Использовать только локально для отладки UI в обычном браузере.

## Архитектура

### Бот (`bot.js`, `commands/`, `llm.js`)

- **Состояние**: `userState[chatId] = { mode, direction?, gender? }` — in-memory объект, создаётся в `bot.js`, передаётся в каждую команду параметром `state`. Сбрасывается при рестарте.
- **Режимы** (`mode`): `translate_dir` → `translate`, `chat_gender` → `chat`, `check`.
- **Контракт команды**: `commands/<name>.js` экспортирует функцию `register(bot, state)`, которая регистрирует свои `bot.onText` / `bot.on('callback_query')` / `bot.on('message')` обработчики. `bot.js` загружает их в цикле.
- **Маршрутизация сообщений**: каждая команда сама подписывается на `bot.on('message')` и фильтрует по `state[chatId].mode` — игнорирует, если режим не свой. Аналогично для `callback_query` фильтр по префиксу `data` (`dir_`, `gender_`).
- **Inline-клавиатуры** и список команд лежат в `settings.js` (`keyboards`, `menu`).
- **Menu-button**: в `bot.js` при старте, если есть `WEB_APP_URL`, вызывается `setChatMenuButton({ menu_button: JSON.stringify({type:'web_app', text:'Open app', web_app:{url}}) })`. Важно — `menu_button` нужно **передавать строкой** через `JSON.stringify`, иначе `node-telegram-bot-api` отправит мусор и Telegram молча проигнорирует. Дополнительно при каждом `bot.on('message')` бот перезатирает per-chat override тем же значением — чтобы кнопка появилась у всех пользователей даже если у них стоял старый default «commands».
- **LLM**: единая точка входа `callLLM(prompt, maxTokens)` из `llm.js` — пробует Groq, при ошибке логирует и переключается на Gemini.
  - Groq: `POST https://api.groq.com/openai/v1/chat/completions` (OpenAI-совместимый формат), ответ — `data.choices[0].message.content`.
  - Gemini: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=...`, ответ — `data.candidates[0].content.parts[0].text`.
- История диалога в боте **не сохраняется** — каждый запрос независим.

### Mini App (`webapp/`)

- **Сервер**: Express. Эндпоинты:
  - `POST /api/chat` — принимает `{ mode, history, message, initData }`, валидирует `initData` (HMAC `sha256(WebAppData→TOKEN)`), составляет `messages[]` (system из `PROMPTS[mode]` + история + новая реплика), вызывает `callLLM`, отвечает `{ reply }`. История обрезается до последних 20 сообщений и 4000 символов на сообщение.
  - `GET /healthz` — `ok`.
  - `express.static('public')` для UI.
- **Промпты** в `server.js → PROMPTS`: `translate` (авто-детект RU/DE, без выбора направления), `chat` (нейтральный «du»-друг), `check` (тот же что и в боте).
- **`webapp/llm.js`**: контракт расширен — принимает `messages[]` вместо `prompt`. Для Groq это нативный chat-completions формат. Для Gemini system-сообщение уходит в `systemInstruction`, остальные — в `contents[]` с маппингом `assistant → model`.
- **Фронт** (`public/app.js`): vanilla, без сборщиков. Глобальный `histories = { translate: [], chat: [], check: [] }` — история **отдельная для каждого режима**, переключение мгновенно подменяет `chatEl.innerHTML`. История живёт только в памяти браузера, теряется при закрытии Mini App. При отправке шлётся весь массив истории текущего режима.
- **Тема**: `style.css` использует `var(--tg-theme-bg-color, ...)` и т.д. — Telegram сам подсунет цвета из активной темы клиента.
- **Никакой синхронизации с состоянием бота нет** — Mini App и команды бота работают независимо. Это by design (так договорились при добавлении).

### Почему Groq primary

Gemini API free tier недоступен в EEA (включая Германию) — выдаёт `limit: 0` и сразу 429. Groq работает свободно. Если хостить в US/Asia — можно поменять порядок обратно.

## Промпты

В **боте** промпты захардкожены в `commands/translate.js`, `commands/chat.js`, `commands/check.js`:
- `/translate` RU→DE: пояснения и разбор переводческих решений на русском.
- `/translate` DE→RU: пояснения на немецком.
- `/chat`: общение на немецком в роли друга, обращение на «du».
- `/check`: проверка немецкой грамматики, ошибки объясняются на русском.

В **Mini App** — в `webapp/server.js → PROMPTS`. Отличия: `translate` авто-детектит язык (без выбора направления), `chat` нейтральный (без gender), `check` тот же.

## Локальный запуск

Бот:
```
npm start                 # node bot.js
npm run restart           # kill всех node bot.js процессов + рестарт (Windows/PowerShell)
```

Webapp (отдельный терминал):
```
cd webapp
npm install
npm start                 # node server.js, http://localhost:3000
```

Polling-режим, без webhook. Бот и webapp — независимые процессы. Если хочется протестировать menu-button локально — нужен публичный HTTPS-туннель к webapp (например `cloudflared tunnel --url http://localhost:3000`), его URL прописать как `WEB_APP_URL` в корневом `.env` и перезапустить бота. Для отладки UI в обычном браузере без Telegram — поставить `SKIP_TG_AUTH=1` в `webapp/.env`.

## Деплой

Production — собственный VPS (Debian 11). Полная пошаговая инструкция в [`DEPLOY_VPS.md`](./DEPLOY_VPS.md).

Кратко:
- Два systemd-юнита: `lang-bot.service` и `lang-webapp.service`, оба под пользователем `botuser`, рабочие директории `/home/botuser/lang_bot` и `.../webapp`.
- Webapp слушает `127.0.0.1:3000`, публикуется наружу через **nginx → Let's Encrypt** на доменe (бесплатный поддомен через DuckDNS, если своего нет).
- Один общий `.env`: на VPS `webapp/.env` это симлинк на `../.env`, чтобы при изменении ключей не пересобирать в двух местах.
- После выпуска сертификата в `.env` бота добавить `WEB_APP_URL=https://<домен>` и `systemctl restart lang-bot`.
- Регион VPS важен: Gemini free tier заблокирован в EEA → fallback не сработает, останется только Groq. Если нужен рабочий fallback — VPS в US/Asia.

## Перезапуск бота (правильная процедура)

Telegram polling не любит, когда два бота на одном токене работают параллельно — сообщения распределяются между ними случайно. Поэтому при изменении кода/`.env` всегда сначала убиваем существующие процессы `node bot.js`, потом запускаем заново.

Шаги (Windows):

1. Найти и прибить ТОЛЬКО процессы `node bot.js` (не трогать остальные node-процессы — там может быть IDE/Devin/MCP):
   ```powershell
   Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
     Where-Object { $_.CommandLine -match 'bot\.js' } |
     ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction Continue }
   Start-Sleep 2
   ```
   Если запускаешь это из bash/sh-обёртки (например, через `exec` инструмент), `$_` нужно экранировать как `\$_`, иначе bash подменит её своим значением до запуска PowerShell.
2. Проверить, что не осталось:
   ```powershell
   Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
     Where-Object { $_.CommandLine -match 'bot\.js' } |
     Select ProcessId, CommandLine
   ```
3. Стартануть в фоне: `node bot.js` (или `npm start`).
4. Убедиться, что лог пишет `Bot started`.

Важно: НЕ запускать бота параллельно из разных терминалов — будет конфликт polling и сообщения будут теряться. Один процесс на токен.

## Правила для изменений

- Держать проект **простым**: никаких фреймворков/TS/абстрактных слоёв без явного запроса. Фронт Mini App — vanilla JS, без сборщиков.
- Не добавлять зависимости без необходимости — для HTTP уже используется `axios`, SDK не нужны. В webapp — только `express`, `axios`, `dotenv`.
- Сохранять существующий стиль: `async/await`, `try/catch` вокруг сетевых вызовов, таймаут 30с на запрос.
- При добавлении новой команды бота: создать `commands/<name>.js`, экспортировать `function register(bot, state)`, добавить имя в массив `commands` в `bot.js`, при необходимости — пункт в `menu` в `settings.js`. Регэкспы команд с суффиксом `(@\w+)?`. Для нового режима — установить `state[chatId].mode = '<name>'` и в `bot.on('message')` фильтровать по этому mode.
- При добавлении нового режима в Mini App: добавить ключ в `PROMPTS` в `webapp/server.js`, добавить кнопку в `webapp/public/index.html`, ключ в `histories` и `placeholders` в `webapp/public/app.js`. Промпты держать на стороне сервера, не на клиенте.
- При добавлении нового LLM-провайдера: новая функция с тем же контрактом, что и `callGroq`/`callGemini`, и подключение в `callLLM` цепочкой fallback. **Внимание**: контракт у бота (`callLLM(prompt, maxTokens)`) и webapp (`callLLM(messages, maxTokens)`) разный — нужно реализовать обе версии или унифицировать.
- Секреты (`TELEGRAM_TOKEN`, `GROQ_API_KEY`, `GEMINI_API_KEY`) — только через `.env`, никогда не логировать. На VPS `.env` имеет права 600.
- Windows-окружение: `npm run restart` использует PowerShell; shell-команды писать с учётом этого. `$_` в `Where-Object` нужно экранировать как `\$_` если запускаешь через bash-обёртку.

## Известные нюансы

- **Нет персистентности**: контекст бота теряется при рестарте, в Mini App — при закрытии вкладки.
- **Нет ретраев и rate-limit guard** — при 429 от Groq идёт сразу fallback на Gemini, без backoff.
- **Нет тестов и линтера.**
- **Gemini free tier заблокирован в EEA** — на машинах/VPS в этой зоне он работать не будет, останется только Groq.
- **Quick-туннели trycloudflare.com** дают новый URL при каждом перезапуске cloudflared — не годятся как постоянный `WEB_APP_URL`. Для постоянного нужен named tunnel или свой домен (см. `DEPLOY_VPS.md`).
- **Бот и Mini App не синхронизируют состояние** — это два независимых интерфейса к одному LLM. Если пользователь начал диалог в чате с ботом, в Mini App он его не увидит.
