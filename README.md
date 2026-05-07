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

## Структура

```
bot.js              # точка входа
settings.js         # клавиатуры, меню
llm.js              # Groq / Gemini / fallback
commands/           # одна команда — один файл
```

Подробности в [CLAUDE.md](./CLAUDE.md).
