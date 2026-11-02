#!/usr/bin/env node
// Точка входа бота. Запуск: BOT_TOKEN=... WEBAPP_URL=https://... npm run bot
import { startPolling } from './telegram.js';

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('Нет BOT_TOKEN. Получи токен у @BotFather и запусти:\n  BOT_TOKEN=123:ABC WEBAPP_URL=https://твой-домен npm run bot');
  process.exit(1);
}

const controller = new AbortController();
process.on('SIGINT', () => {
  controller.abort();
  process.exit(0);
});

startPolling({ token, webappUrl: process.env.WEBAPP_URL, signal: controller.signal });
