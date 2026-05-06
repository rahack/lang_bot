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

## Команды бота

- `/start` — главное меню
- `/translate` — перевод RU↔DE с пояснениями
- `/chat` — общение на немецком
- `/check` — проверка грамматики с разбором ошибок
- `/clear` — сбросить состояние

## Деплой на Fly.io

```bash
fly auth login              # один раз
fly launch --no-deploy      # в первый раз — подтвердит fly.toml, создаст app
fly secrets set TELEGRAM_TOKEN=... GROQ_API_KEY=... GEMINI_API_KEY=...
fly deploy
```

Регион в `fly.toml` стоит `iad` (US-East) — там работает и Gemini, и Groq. Для машин в EEA Gemini-fallback заблокирован Google.

## Структура

```
bot.js              # точка входа
settings.js         # клавиатуры, меню
llm.js              # Groq / Gemini / fallback
commands/           # одна команда — один файл
```

Подробности в [CLAUDE.md](./CLAUDE.md).
