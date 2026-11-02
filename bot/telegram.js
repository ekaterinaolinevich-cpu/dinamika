// Логика общения с Telegram — без сторонних библиотек, на встроенном fetch.
// Используется и ботом (long polling), и вебхуком из server/index.js.

import { addDocument, ensureUser } from '../server/db.js';
import { buildState } from '../server/aggregate.js';
import { parseUpload, parseText } from '../server/parser.js';
import { isImageUpload, ocrAvailable, ocrImage } from '../server/ocr.js';
import { seedDemo } from '../server/seed.js';

const API = 'https://api.telegram.org';

export async function tgCall(token, method, payload = {}) {
  if (!token) throw new Error('BOT_TOKEN не задан');

  const timeout = method === 'getUpdates' ? 45_000 : 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(`${API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || 'ошибка'}`);
  return data.result;
}

async function downloadFile(token, fileId) {
  const file = await tgCall(token, 'getFile', { file_id: fileId });
  const response = await fetch(`${API}/file/bot${token}/${file.path}`);
  if (!response.ok) throw new Error('Не удалось скачать файл из Telegram');
  return { buffer: Buffer.from(await response.arrayBuffer()), filename: file.path.split('/').pop() };
}

const escapeHtml = (value) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function summaryMessage(state, lab, added) {
  const lines = [];
  lines.push(`<b>Готово.</b> Распознала ${added} показателей из «${escapeHtml(lab)}».`);
  lines.push(`В дневнике уже ${state.series.length} показателей из ${state.documents.length} анализов.`);

  const devs = state.deviations;
  if (devs.length) {
    lines.push('');
    lines.push('<b>Вне референса:</b>');
    for (const d of devs.slice(0, 6)) {
      const arrow = d.status === 'high' ? '↑' : '↓';
      const ref = d.ref_low !== null && d.ref_high !== null ? ` (норма ${d.ref_low}–${d.ref_high})` : '';
      lines.push(`• ${arrow} ${escapeHtml(d.name)} — ${d.value} ${escapeHtml(d.unit)}${ref}`);
    }
    if (devs.length > 6) lines.push(`…и ещё ${devs.length - 6}`);
  } else {
    lines.push('');
    lines.push('Все показатели в пределах референса 👍');
  }

  return lines.join('\n');
}

function webAppKeyboard(webappUrl, label = 'Открыть динамику') {
  if (!webappUrl || !/^https:\/\//i.test(webappUrl)) return undefined;
  return { inline_keyboard: [[{ text: label, web_app: { url: webappUrl } }]] };
}

const WELCOME = [
  '<b>Привет! Я «Динамика».</b>',
  '',
  'Собираю анализы из разных лабораторий в один дневник и показываю динамику по каждому показателю — с референсными значениями.',
  '',
  '<b>Что присылать:</b>',
  '• PDF с результатами (Инвитро, Гемотест, Хеликс, CMD — понимаю бланки)',
  '• или просто вставь текст бланка сообщением',
  '',
  'Дальше открой мини-апп — там графики по каждому показателю и история.',
].join('\n');

export async function handleTelegramUpdate(update, { token, webappUrl = process.env.WEBAPP_URL } = {}) {
  const message = update.message || update.edited_message;
  if (!message) return;

  const from = message.from;
  if (!from) return;
  const userId = `tg:${from.id}`;
  await ensureUser(userId, from.first_name || from.username || null, 'female');
  const chatId = message.chat.id;

  const reply = (text, extra = {}) =>
    tgCall(token, 'sendMessage', {
      chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra,
    });

  const text = (message.text || '').trim();

  if (text.startsWith('/start') || text.startsWith('/help')) {
    await reply(WELCOME, { reply_markup: webAppKeyboard(webappUrl, 'Открыть приложение') });
    return;
  }

  if (text.startsWith('/demo')) {
    await seedDemo(userId);
    const state = await buildState(userId);
    await reply('Загрузила демо-историю: 5 анализов из двух лабораторий за год.\nПосмотри, как выглядят графики 👇', {
      reply_markup: webAppKeyboard(webappUrl, 'Смотреть демо'),
    });
    return;
  }

  if (message.document) {
    const doc = message.document;
    const name = doc.file_name || 'analiz.pdf';

    if (!/\.(pdf|txt|csv)$/i.test(name) && doc.mime_type !== 'application/pdf' && !isImageUpload(name, doc.mime_type || '')) {
      await reply('Пока понимаю PDF, TXT, CSV и фото. Пришли бланк файлом или вставь текст.');
      return;
    }

    await reply('Читаю бланк…');
    try {
      const file = await downloadFile(token, doc.file_id);

      if (isImageUpload(name, doc.mime_type || '')) {
        const textPhoto = await ocrImage(file.buffer, name);
        const parsedImage = parseText(textPhoto);
        if (!parsedImage.results.length) {
          await reply('На фото не разобрала таблицу. Попробуй снять ровнее или пришли PDF.');
          return;
        }
        const savedImage = await addDocument(
          userId,
          { lab: parsedImage.lab, taken_at: parsedImage.taken_at, filename: name, source: 'telegram-photo' },
          parsedImage.results,
        );
        const stateImage = await buildState(userId);
        await reply(summaryMessage(stateImage, parsedImage.lab, savedImage.inserted), { reply_markup: webAppKeyboard(webappUrl) });
        return;
      }

      const parsed = await parseUpload(file.buffer, name, doc.mime_type || '');

      if (!parsed.results.length) {
        await reply('Не смогла разобрать таблицу. Похоже, это скан без текстового слоя.\nМожно вставить текст бланка сообщением — разберу его.');
        return;
      }

      const saved = await addDocument(
        userId,
        { lab: parsed.lab, taken_at: parsed.taken_at, filename: name, source: 'telegram' },
        parsed.results,
      );
      const state = await buildState(userId);
      await reply(summaryMessage(state, parsed.lab, saved.inserted), { reply_markup: webAppKeyboard(webappUrl) });
    } catch (error) {
      console.error('[bot] document', error);
      await reply('Не получилось обработать файл. Попробуй ещё раз или вставь текст бланка сообщением.');
    }
    return;
  }

  if (message.photo) {
    if (!(await ocrAvailable())) {
      await reply('Распознавание фото доступно только на macOS. Пришли PDF или вставь текст бланка.', {
        reply_markup: webAppKeyboard(webappUrl),
      });
      return;
    }

    const largest = message.photo[message.photo.length - 1];
    await reply('Читаю фото…');
    try {
      const file = await downloadFile(token, largest.file_id);
      const textPhoto = await ocrImage(file.buffer, 'photo.jpg');
      const parsed = parseText(textPhoto);

      if (!parsed.results.length) {
        await reply('Не разобрала таблицу на фото. Попробуй снять ровнее и без бликов — или пришли PDF.');
        return;
      }

      const saved = await addDocument(
        userId,
        { lab: parsed.lab, taken_at: parsed.taken_at, filename: 'Фото', source: 'telegram-photo' },
        parsed.results,
      );
      const state = await buildState(userId);
      await reply(summaryMessage(state, parsed.lab, saved.inserted), { reply_markup: webAppKeyboard(webappUrl) });
    } catch (error) {
      console.error('[bot] photo', error);
      await reply('Не получилось прочитать фото. Попробуй ещё раз или пришли PDF.');
    }
    return;
  }

  if (text.length > 20) {
    const parsed = parseText(text);
    if (parsed.results.length >= 3) {
      const saved = await addDocument(
        userId,
        { lab: parsed.lab, taken_at: parsed.taken_at, filename: 'Текст из чата', source: 'telegram-text' },
        parsed.results,
      );
      const state = await buildState(userId);
      await reply(summaryMessage(state, parsed.lab, saved.inserted), { reply_markup: webAppKeyboard(webappUrl) });
      return;
    }
  }

  await reply(WELCOME, { reply_markup: webAppKeyboard(webappUrl, 'Открыть приложение') });
}

export async function startPolling({ token, webappUrl = process.env.WEBAPP_URL, signal } = {}) {
  let offset = 0;

  try {
    await tgCall(token, 'deleteWebhook', { drop_pending_updates: false });
  } catch (error) {
    console.error('[bot] deleteWebhook:', error.message);
  }

  console.log('Бот запущен (long polling)');

  while (!signal?.aborted) {
    try {
      const updates = await tgCall(token, 'getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
      for (const update of updates) {
        offset = update.update_id + 1;
        handleTelegramUpdate(update, { token, webappUrl }).catch((error) => console.error('[bot] update', error.message));
      }
    } catch (error) {
      console.error('[bot] polling', error.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}
