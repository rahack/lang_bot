# lang_bot

Telegram-бот для изучения немецкого языка: перевод RU↔DE, чат на немецком, проверка грамматики.

LLM: **Groq** (primary) + **Google Gemini** (fallback). Оба провайдера имеют бесплатный тир.

## Стек

Node.js (без TS/фреймворков), `node-telegram-bot-api`, `axios`, `dotenv`.

## Локальный запуск

```bash
npm install
cp .env.example .env       # заполни ключами (см. ниже)
npm start
```

Переменные окружения:

| Переменная        | Где взять                                       | Обязательно |
|-------------------|-------------------------------------------------|-------------|
| `TELEGRAM_TOKEN`  | https://t.me/BotFather                          | да          |
| `GROQ_API_KEY`    | https://console.groq.com/keys                   | да          |
| `GROQ_MODEL`      | по умолчанию `llama-3.3-70b-versatile`          | нет         |
| `GEMINI_API_KEY`  | https://aistudio.google.com/apikey              | да          |
| `GEMINI_MODEL`    | по умолчанию `gemini-2.0-flash`                 | нет         |
| `WEB_APP_URL`     | публичный HTTPS-URL Mini App (см. ниже)         | нет         |

## Команды бота

- `/start` — главное меню
- `/translate` — перевод RU↔DE с пояснениями
- `/chat` — общение на немецком
- `/check` — проверка грамматики с разбором ошибок
- `/clear` — сбросить состояние

## Деплой на Northflank

1. Зарегистрироваться на https://northflank.com через GitHub.
2. **Create project** → регион **US Central** (в EU Gemini-fallback заблокирован Google).
3. **Create service → Combined Service → Deployment** (без HTTP-портов, polling-бот).
4. Source: GitHub-репозиторий, branch `master`. Build: **Dockerfile** (`./Dockerfile`).
5. План — Sandbox / `nf-compute-10` (0.1 vCPU, 256 MB).
6. **Runtime variables**:
   - `TELEGRAM_TOKEN`, `GROQ_API_KEY`, `GEMINI_API_KEY` — secret
   - `GROQ_MODEL=llama-3.3-70b-versatile`, `GEMINI_MODEL=gemini-2.0-flash` — обычные
7. **Create & deploy**. Auto-deploy на push в master включён по умолчанию.

В логах должно появиться `Bot started`.

## Telegram Mini App

В папке `webapp/` лежит отдельный сервис: статика Mini App + REST-эндпоинт `/api/chat`. Открывается из бота через menu-button (синяя кнопка слева от поля ввода).

UI: переключатели режимов `translate` / `chat` / `check` сверху и окно чата под ними. Контекст диалога хранится в браузере отдельно для каждого режима (теряется при закрытии). Сервер stateless — фронт шлёт всю историю в каждом запросе. Все запросы валидируются через Telegram `initData` (HMAC от `TELEGRAM_TOKEN`).

### Локальный запуск webapp

```bash
cd webapp
npm install
# .env с TELEGRAM_TOKEN, GROQ_API_KEY, GEMINI_API_KEY
# для отладки без Telegram можно SKIP_TG_AUTH=1
npm start              # http://localhost:3000
```

Чтобы Telegram открыл Mini App, URL должен быть HTTPS и публичным — для разработки используй `cloudflared tunnel` / `ngrok`.

### Деплой webapp на Northflank

Это **отдельный сервис** в том же проекте (не объединять с ботом — у бота нет HTTP-порта).

1. **Create service → Combined Service → Deployment**, source — тот же репозиторий, branch `master`.
2. Build: **Dockerfile**, путь `webapp/Dockerfile`, build context `webapp/`.
3. **Ports**: добавить публичный HTTP-порт `3000` (Northflank выдаст HTTPS-URL вида `https://...code.run`).
4. **Runtime variables**: `TELEGRAM_TOKEN`, `GROQ_API_KEY`, `GEMINI_API_KEY`, опционально `GROQ_MODEL` / `GEMINI_MODEL`.
5. После деплоя скопировать публичный URL и добавить переменную `WEB_APP_URL` **в сервис бота** — на следующем рестарте бот зарегистрирует menu-button через `setChatMenuButton`.

## Структура

```
bot.js              # точка входа бота
settings.js         # клавиатуры, меню
llm.js              # Groq / Gemini / fallback
commands/           # одна команда — один файл
webapp/             # Mini App: server.js + public/* (отдельный сервис)
```

Подробности в [CLAUDE.md](./CLAUDE.md).
