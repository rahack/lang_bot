# Резюме сессии: деплой бота через GitHub

**Цель:** выложить бота на бесплатный хостинг через GitHub.

## Что сделано

1. **Залили проект на GitHub** — `https://github.com/rahack/lang_bot` (master).
2. **Изначально пытались на Fly.io** через GitHub Actions:
   - Создан `.github/workflows/fly.yml` (`superfly/flyctl-actions`).
   - Запушено — ждали `FLY_API_TOKEN` в GitHub Secrets и `fly app create` руками.
3. **Сменили решение на Northflank** (по запросу пользователя):
   - Проверен pricing: Sandbox-тир есть, **always-on**, 2 service free, без сна. Лимиты на железо ~`nf-compute-10` (0.1 vCPU / 256MB), при регистрации скорее всего попросят карту для верификации.
   - Регион выбран **US Central** (Gemini API заблокирован в EEA — из EU не работает).
4. **Очистили Fly-конфиги:**
   - Удалены `fly.toml` и `.github/workflows/fly.yml`.
   - Обновлён раздел «Деплой» в `README.md` — теперь Northflank-инструкция.
   - Добавлен короткий раздел «Деплой» в `CLAUDE.md` (контекст для будущих сессий).
5. **Запушено в master** — Northflank после подключения репо подхватит сам.

## Коммиты сессии

- `ecdbffb` Add GitHub Actions workflow for Fly.io deploy *(потом удалён)*
- `6a7eeb8` Switch deployment from Fly.io to Northflank
- `9f1eb21` Document Northflank deployment in CLAUDE.md

## Открытые шаги (на стороне пользователя)

- Зарегистрироваться на Northflank через GitHub.
- Создать project (US Central) + Combined Service Deployment, source = `rahack/lang_bot` master, build = Dockerfile.
- Plan `nf-compute-10`, replicas = **1** (важно для polling), без публичных портов.
- Выставить env vars: `TELEGRAM_TOKEN`, `GROQ_API_KEY`, `GEMINI_API_KEY` (secret) + `GROQ_MODEL`, `GEMINI_MODEL`.
- Проверить логи на `Bot started`.

## Ключевые решения и каверзы

- Gemini API недоступен в EEA → хостинг должен быть в US-регионе.
- Один процесс на токен (одна реплика) — иначе конфликт Telegram polling.
- Путь «GitHub Actions для Fly» отброшен в пользу нативного auto-deploy у Northflank — CI-конфиг не нужен.
