# CLAUDE.md

Контекст проекта для работы AI-агента в этом репозитории.

## Обзор

Telegram-бот для изучения немецкого языка: перевод RU↔DE, свободный чат на немецком и проверка грамматики. LLM-провайдеры — **Groq** (primary) и **Google Gemini** (fallback), оба с бесплатным тиром.

Стек: **Node.js**, без фреймворков/TS/тестов. Код разбит на `bot.js` (точка входа), `settings.js`, `llm.js` и модули в `commands/`.

## Структура

```
bot.js              # точка входа: создание бота, загрузка команд, setMyCommands
settings.js         # клавиатуры (translate/gender/main) + список меню
llm.js              # callGroq + callGemini + callLLM (с fallback)
commands/
  start.js          # /start
  translate.js      # /translate + callback dir_* + обработчик текста в режиме translate
  chat.js           # /chat + callback gender_* + обработчик текста в режиме chat
  check.js          # /check + обработчик текста в режиме check
  clear.js          # /clear
```

- `package.json` — зависимости: `node-telegram-bot-api`, `axios`, `dotenv`.
- `.env` — читается через `dotenv`. Требуемые переменные:
  - `TELEGRAM_TOKEN` — токен бота от @BotFather
  - `GROQ_API_KEY`, `GROQ_MODEL` (по умолчанию `llama-3.3-70b-versatile`) — https://console.groq.com
  - `GEMINI_API_KEY`, `GEMINI_MODEL` (по умолчанию `gemini-2.0-flash`) — https://aistudio.google.com/apikey

## Архитектура

- **Состояние**: `userState[chatId] = { mode, direction?, gender? }` — in-memory объект, создаётся в `bot.js`, передаётся в каждую команду параметром `state`. Сбрасывается при рестарте.
- **Режимы** (`mode`): `translate_dir` → `translate`, `chat_gender` → `chat`, `check`.
- **Контракт команды**: `commands/<name>.js` экспортирует функцию `register(bot, state)`, которая регистрирует свои `bot.onText` / `bot.on('callback_query')` / `bot.on('message')` обработчики. `bot.js` загружает их в цикле.
- **Маршрутизация сообщений**: каждая команда сама подписывается на `bot.on('message')` и фильтрует по `state[chatId].mode` — игнорирует, если режим не свой. Аналогично для `callback_query` фильтр по префиксу `data` (`dir_`, `gender_`).
- **Inline-клавиатуры** и список команд лежат в `settings.js` (`keyboards`, `menu`).
- **LLM**: единая точка входа `callLLM(prompt, maxTokens)` из `llm.js` — пробует Groq, при ошибке логирует и переключается на Gemini.
  - Groq: `POST https://api.groq.com/openai/v1/chat/completions` (OpenAI-совместимый формат), ответ — `data.choices[0].message.content`.
  - Gemini: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=...`, ответ — `data.candidates[0].content.parts[0].text`.
- История диалога **не сохраняется** — каждый запрос независим.

### Почему Groq primary

Gemini API free tier недоступен в EEA (включая Германию) — выдаёт `limit: 0` и сразу 429. Groq работает свободно. Если бот будет хоститься в США/Сингапуре/etc — порядок можно поменять обратно.

## Промпты

- `/translate` RU→DE: пояснения и разбор переводческих решений на русском.
- `/translate` DE→RU: пояснения на немецком.
- `/chat`: общение на немецком в роли друга, обращение на «du».
- `/check`: проверка немецкой грамматики, ошибки объясняются на русском.

## Запуск

```
npm start                 # node bot.js
npm run restart           # kill всех node процессов + рестарт (Windows/PowerShell)
```

Polling-режим, без webhook.

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

- Держать проект **простым**: никаких фреймворков/TS/абстрактных слоёв без явного запроса.
- Не добавлять зависимости без необходимости — для HTTP уже используется `axios`, SDK не нужны.
- Сохранять существующий стиль: `async/await`, `try/catch` вокруг сетевых вызовов, таймаут 30с на запрос.
- При добавлении новой команды: создать `commands/<name>.js`, экспортировать `function register(bot, state)`, добавить имя в массив `commands` в `bot.js`, при необходимости — пункт в `menu` в `settings.js`. Регэкспы команд с суффиксом `(@\w+)?`. Для нового режима — установить `state[chatId].mode = '<name>'` и в `bot.on('message')` фильтровать по этому mode.
- При добавлении нового LLM-провайдера: новая функция `callXxx(prompt, maxTokens)` с тем же контрактом (возвращает текст или бросает), и подключение в `callLLM` цепочкой fallback.
- Секреты (`TELEGRAM_TOKEN`, `GROQ_API_KEY`, `GEMINI_API_KEY`) — только через `.env`, никогда не логировать.
- Windows-окружение: `npm run restart` использует PowerShell; shell-команды писать с учётом этого.

## Известные нюансы

- Нет персистентности: контекст чата теряется после рестарта и между сообщениями.
- Нет ретраев и rate-limit guard — при 429 от Groq идёт сразу fallback на Gemini, без backoff.
- Нет тестов и линтера.
- Gemini free tier заблокирован в EEA — на машинах/VPS в этой зоне он работать не будет.
