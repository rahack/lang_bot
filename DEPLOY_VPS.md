# Деплой на VPS (Debian 11)

Пошаговая инструкция для разворачивания бота на собственном VPS. Бот работает в polling-режиме, поэтому открывать порты наружу не нужно.

## 1. Подготовка системы

```bash
ssh user@<IP>
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ca-certificates
```

## 2. Установка Node.js 20.x (LTS)

Дефолтный `nodejs` в Debian 11 устарел, ставим из NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

## 3. Отдельный пользователь для бота

```bash
sudo adduser --disabled-password --gecos "" botuser
sudo su - botuser
```

Дальнейшие шаги до systemd — под `botuser`.

## 4. Клонирование репозитория

```bash
git clone https://github.com/rahack/lang_bot.git
cd lang_bot
npm ci --omit=dev
```

## 5. Настройка `.env`

```bash
nano .env
```

Содержимое:

```
TELEGRAM_TOKEN=...
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
```

```bash
chmod 600 .env
```

> **Регион важен.** Gemini free tier заблокирован в EEA (Германия, Франция и т.п.) — там fallback не сработает, останется только Groq. Если нужен рабочий fallback, бери VPS в US/Asia.

## 6. Проверка ручного запуска

```bash
node bot.js
```

Должно появиться `Bot started`. Прервать `Ctrl+C`.

## 7. Автозапуск через systemd

Выйти из `botuser` (`exit`) и создать unit:

```bash
sudo nano /etc/systemd/system/lang-bot.service
```

```ini
[Unit]
Description=Telegram lang_bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=botuser
WorkingDirectory=/home/botuser/lang_bot
ExecStart=/usr/bin/node bot.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Активировать:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lang-bot
sudo systemctl status lang-bot
```

Логи:

```bash
journalctl -u lang-bot -f
```

## 8. Обновление кода

```bash
sudo su - botuser
cd lang_bot
git pull
npm ci --omit=dev
exit
sudo systemctl restart lang-bot
```

## 9. Базовая безопасность

```bash
sudo apt install -y ufw fail2ban
sudo ufw allow OpenSSH
sudo ufw enable
```

Никакие дополнительные порты для бота открывать не нужно — он сам ходит наружу к Telegram/Groq/Gemini.

## 10. Один процесс на токен

Telegram polling не работает, если один и тот же токен используется в нескольких процессах одновременно — сообщения распределяются между ними рандомно. Если до этого бот крутился на Northflank/Fly/локально — отключи их перед запуском на VPS.
