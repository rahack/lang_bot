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

Telegram polling не работает, если один и тот же токен используется в нескольких процессах одновременно — сообщения распределяются между ними рандомно. Перед запуском бота на VPS убедись, что нет других запущенных копий (локально, на старом хостинге и т.п.).

---

## 11. Mini App (webapp) на том же VPS

Бот работает по polling и не требует портов. Mini App — отдельный сервис, отдаёт статику и `/api/chat`. Для Telegram нужен **публичный HTTPS-URL с валидным сертификатом** (self-signed не подойдёт). Самый простой путь: nginx + Let's Encrypt.

Если своего домена нет — заводим бесплатный поддомен на DuckDNS (см. 11.3 ниже). Если есть — можно сразу к 11.4.

### 11.1 Зависимости webapp (под `botuser`)

```bash
sudo su - botuser
cd lang_bot
npm install --omit=dev --prefix webapp
cp .env webapp/.env       # те же TELEGRAM_TOKEN / GROQ_API_KEY / GEMINI_API_KEY
chmod 600 webapp/.env
exit
```

> Если `.env` бота меняешь — не забудь синхронизировать `webapp/.env`. Можно вместо `cp` сделать `ln -s ../.env webapp/.env`, тогда файл всегда один.

### 11.2 systemd unit для webapp

```bash
sudo nano /etc/systemd/system/lang-webapp.service
```

```ini
[Unit]
Description=Telegram lang_bot Mini App
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=botuser
WorkingDirectory=/home/botuser/lang_bot/webapp
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lang-webapp
curl -s http://127.0.0.1:3000/healthz       # должно ответить ok
```

### 11.3 Бесплатный поддомен через DuckDNS

Если своего домена нет — заводим поддомен на duckdns.org. Понадобится почта Google/GitHub/Twitter/Reddit для логина.

1. Перейти на https://www.duckdns.org/ → войти.
2. В поле «sub domain» вписать желаемое имя (например `mylangbot`) → **add domain**. Получится `mylangbot.duckdns.org`.
3. В поле «current ip» вписать публичный IP VPS, нажать **update ip**. Если оставить пустым — DuckDNS подставит IP, с которого ты сейчас зашёл.
4. На странице вверху — `token=...`. Скопировать (понадобится для cron-обновления IP).
5. Проверить, что DNS уже работает:

```bash
dig +short mylangbot.duckdns.org      # должно вернуть IP VPS
```

(Если `dig` не установлен: `sudo apt install -y dnsutils`.)

Если у VPS статический IP — этого достаточно. Если IP может меняться — настроить автообновление под `botuser`:

```bash
sudo su - botuser
mkdir -p ~/duckdns
cat > ~/duckdns/duck.sh <<'EOF'
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=DOMAIN&token=TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -
EOF
nano ~/duckdns/duck.sh        # подставить DOMAIN (без .duckdns.org) и TOKEN
chmod 700 ~/duckdns/duck.sh
~/duckdns/duck.sh && cat ~/duckdns/duck.log     # должно быть OK
( crontab -l 2>/dev/null; echo "*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1" ) | crontab -
exit
```

Дальше везде в инструкции вместо `bot.example.com` подставляй `mylangbot.duckdns.org`.

### 11.4 nginx как реверс-прокси

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/lang-webapp
```

Подставь свой домен вместо `bot.example.com`:

```nginx
server {
    listen 80;
    server_name bot.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lang-webapp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 11.5 HTTPS через Let's Encrypt

Открыть 80/443 для certbot и nginx:

```bash
sudo ufw allow 'Nginx Full'
```

Установить certbot и выпустить сертификат:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bot.example.com
```

Certbot сам поправит nginx-конфиг (добавит `listen 443 ssl`, редирект с 80 на 443). Автообновление сертификата уже настроено systemd-таймером (`systemctl list-timers | grep certbot`).

Проверка:

```bash
curl -I https://bot.example.com/healthz
```

### 11.6 Подключить Mini App к боту

Добавить URL в `.env` бота:

```bash
sudo su - botuser
cd lang_bot
echo "WEB_APP_URL=https://bot.example.com" >> .env
exit
sudo systemctl restart lang-bot
```

При старте бот вызывает `setChatMenuButton` и регистрирует кнопку «Open app». При первом сообщении от пользователя бот ещё и перезатирает per-chat override (на случай если у кого-то стояла другая кнопка).

### 11.7 Обновление кода (бот + webapp)

```bash
sudo su - botuser
cd lang_bot
git pull
npm ci --omit=dev
npm install --omit=dev --prefix webapp
exit
sudo systemctl restart lang-bot lang-webapp
```

### 11.8 Логи и диагностика

```bash
journalctl -u lang-webapp -f          # логи webapp
journalctl -u lang-bot -f             # логи бота
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

Если Mini App не открывается из Telegram:
- проверь `curl -I https://bot.example.com` снаружи (с локальной машины) — должен быть 200 и валидный SSL;
- сертификат должен быть **доверенный** (Let's Encrypt подойдёт, self-signed — нет);
- меню-кнопка кэшируется клиентом, иногда нужно полностью перезапустить Telegram.
