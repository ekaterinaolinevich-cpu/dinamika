# Как выложить «Динамику»

Схема: **GitHub (код) → Bothost (запуск) → HTTPS-домен**, данные — в **Neon**.

## 0. Проверить локально

```bash
npm install
npm start
```

Должно открыться приложение с демо-данными, а `http://127.0.0.1:3000/health` вернуть `{"ok":true}`.

## 1. Бот в Telegram

1. **@BotFather** → `/newbot` → имя и username.
2. Сохрани токен.

## 2. Код на GitHub (GitHub Desktop)

1. github.com → **New repository** → `dinamika` → **Public** (без README и .gitignore).
2. GitHub Desktop → **File → Add Local Repository** → папка проекта → **create a repository** → Create.
3. **Publish repository**.
4. Проверь на github.com, что в корне лежат `index.js`, `package.json`, `server/`, `webapp/`.

Публичный репозиторий — чтобы Bothost мог клонировать без токена. Секретов в коде нет.

## 3. База в Neon

1. [neon.tech](https://neon.tech) → Sign up → **New Project** → регион **Frankfurt**.
2. **Connect** → скопируй строку `postgresql://…?sslmode=require` (лучше Pooled).

Таблицы создадутся при первом запуске.

## 4. Бот на Bothost

**Добавить бота**:

| Поле | Значение |
| --- | --- |
| Платформа | Telegram |
| Язык | Node.js |
| Bot Token | токен из шага 1 |
| Git URL | `https://github.com/ты/dinamika` |
| Ветка | `main` |
| Образ | node:22 Alpine |
| Главный файл | `index.js` |
| Внутренний порт | `3000` |
| Переменные | `DATABASE_URL` = строка из Neon |
| Доп. настройки | ☑️ Использовать домен, ☐ свой Dockerfile |

Свой Dockerfile не нужен: SQLite подгружается лениво, с Neon он вообще не используется.

## 5. Проверка

```
https://домен/health   → {"ok":true,"db":"ok"}
https://домен/api/diag → db.kind = "postgres"
```

Открой домен в браузере — увидишь демо в режиме чтения. Это нормально: писать может только человек из Telegram.

## 6. Вебхук и кнопка

```
https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://домен/webhook
```

Затем **@BotFather** → `/newapp` → URL домена → short name (например `app`). Ссылка: `https://t.me/бот/app`.
И `/setmenubutton` → URL домена.

## Если что-то не так

| Симптом | Причина |
| --- | --- |
| Сборка падает, в логах пусто | не тот репозиторий или приватный доступ |
| `db: "unavailable"` | `DATABASE_URL` не задан или неверный |
| Бот молчит | вебхук не встал: проверь `getWebhookInfo` |
| Кнопка в боте не открывается | `WEBAPP_URL` не HTTPS или другой домен |
| Фото не читаются | на Linux нет Apple Vision — это ожидаемо |
