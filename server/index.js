// HTTP-сервер: API мини-аппа, статика, вебхук бота.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

import { buildState } from './aggregate.js';
import { resolveReference, SOURCES } from './references.js';
import {
  initDb, dbInfo, ensureUser, updateProfile, getUser, addDocument, deleteDocument,
  saveAlias, listAliases, allResults, getDocument,
} from './db.js';
import { BY_CODE, INDICATORS, matchIndicator, matchIndicatorDetailed, setLearnedAliases, learnAlias } from './catalog.js';
import { parseUpload, parseText } from './parser.js';
import { isImageUpload, ocrAvailable, ocrImage } from './ocr.js';
import { seedDemo } from './seed.js';
import { handleTelegramUpdate } from '../bot/telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WEBAPP = path.join(ROOT, 'webapp');
const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN || '';

// Версия сборки в ссылках на ассеты: Telegram WebView любит держать старый JS.
const BUILD_VERSION = (process.env.BUILD_VERSION || Date.now().toString(36)).slice(0, 12);

function versionedHtml(html) {
  return html
    .replace('href="/styles.css"', `href="/styles.css?v=${BUILD_VERSION}"`)
    .replace('src="/app.js"', `src="/app.js?v=${BUILD_VERSION}"`);
}

function resolvePublicUrl() {
  const explicit = process.env.WEBAPP_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const domain = process.env.DOMAIN;
  if (domain) {
    const withScheme = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
    return withScheme.replace(/\/+$/, '');
  }
  return '';
}

const PUBLIC_URL = resolvePublicUrl();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-User, X-Filename, X-Telegram-Init-Data',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  });
  res.end(body);
}

function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Файл больше 25 МБ'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new Error('Некорректный JSON');
  }
}

async function fetchWithTimeout(url, ms = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function verifyInitData(initData, token) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const userRaw = params.get('user');
  if (!userRaw) return null;

  if (token && hash) {
    const pairs = [...params.entries()]
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(token).digest();
    const computed = createHmac('sha256', secret).update(pairs).digest('hex');
    if (computed !== hash) return null;
  }

  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

function resolveUser(req, url) {
  const initData = req.headers['x-telegram-init-data'] || url.searchParams.get('initData');
  const tgUser = verifyInitData(initData, BOT_TOKEN);
  if (tgUser?.id) {
    return { id: `tg:${tgUser.id}`, name: tgUser.first_name || tgUser.username || null, authenticated: true };
  }
  const raw = url.searchParams.get('user') || req.headers['x-user'] || 'demo';
  return { id: String(raw).slice(0, 64), name: null, authenticated: !BOT_TOKEN };
}

async function userOrCreate(user) {
  await ensureUser(user.id, user.name, 'female');
  return user.id;
}

async function profileOf(userId) {
  const user = await getUser(userId);
  return {
    sex: user?.sex === 'male' ? 'male' : 'female',
    age: user?.birth_year ? new Date().getFullYear() - Number(user.birth_year) : null,
    goal: user?.goal || 'general',
  };
}

function enrichPreview(results, profile) {
  return results.map((r) => {
    const detailed = matchIndicatorDetailed(r.raw_name || r.name, { unit: r.unit });
    const indicator = r.code ? BY_CODE.get(r.code) || detailed.indicator : detailed.indicator;
    const resolved = indicator ? resolveReference(indicator.code, profile) : null;

    const labLow = r.ref_low ?? null;
    const labHigh = r.ref_high ?? null;
    const hasLab = labLow !== null || labHigh !== null;

    let evalLow;
    let evalHigh;
    let refLabel;
    let refSource = null;
    let refNote = '';
    let refEvidence = null;

    if (resolved?.ruleId) {
      evalLow = resolved.low;
      evalHigh = resolved.high;
      refLabel = resolved.label;
      refSource = resolved.source;
      refNote = resolved.note;
      refEvidence = resolved.evidence;
    } else if (hasLab) {
      evalLow = labLow;
      evalHigh = labHigh;
      refLabel = 'референс из бланка';
      refSource = SOURCES.lab;
    } else {
      evalLow = resolved?.low ?? null;
      evalHigh = resolved?.high ?? null;
      refLabel = 'стандартный референс';
    }

    const refLow = hasLab ? labLow : evalLow;
    const refHigh = hasLab ? labHigh : evalHigh;

    return {
      ...r,
      code: indicator?.code || r.code || null,
      name: indicator?.name || r.name,
      unit: r.unit || indicator?.unit || '',
      ref_low: refLow,
      ref_high: refHigh,
      eval_low: evalLow,
      eval_high: evalHigh,
      ref_label: refLabel,
      ref_source: refSource,
      ref_note: refNote,
      ref_evidence: refEvidence,
      ref_from_rule: Boolean(resolved?.ruleId),
      open_low: Boolean(resolved?.openLow ?? indicator?.openLow),
      open_high: Boolean(resolved?.openHigh ?? indicator?.openHigh),
      panel: indicator?.panel || 'other',
      ambiguous: Boolean(detailed.ambiguous),
      alternatives: detailed.alternatives || [],
    };
  });
}

function toCsv(state) {
  const header = ['code', 'name', 'date', 'value', 'unit', 'ref_low', 'ref_high', 'lab'];
  const lines = [header.join(';')];
  for (const series of state.series) {
    for (const point of series.points) {
      lines.push([
        series.code || '',
        series.name.replace(/;/g, ','),
        point.taken_at,
        point.value,
        series.unit,
        point.ref_low ?? '',
        point.ref_high ?? '',
        (point.lab || '').replace(/;/g, ','),
      ].join(';'));
    }
  }
  return '\uFEFF' + lines.join('\n');
}

function serveStatic(req, res, pathname) {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(WEBAPP, safePath === '/' || safePath === '' ? 'index.html' : safePath);

  if (!filePath.startsWith(WEBAPP)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(WEBAPP, 'index.html');
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Мини-апп ещё не собран');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  let data = fs.readFileSync(filePath);

  if (ext === '.html') data = Buffer.from(versionedHtml(data.toString('utf8')), 'utf8');

  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': data.length,
    'Cache-Control': ['.html', '.css', '.js', '.mjs'].includes(ext) ? 'no-store' : 'public, max-age=300',
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-User, X-Filename, X-Telegram-Init-Data',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    });
    res.end();
    return;
  }

  try {
    const user = resolveUser(req, url);
    const pathname = url.pathname;

    // Когда приложение настроено на бота, писать может только человек из Telegram.
    const isBotWebhook = pathname === '/api/telegram' || pathname === '/webhook';
    const isWrite = ['POST', 'DELETE', 'PUT', 'PATCH'].includes(req.method);
    if (BOT_TOKEN && isWrite && !user.authenticated && !isBotWebhook) {
      return json(res, 401, { error: 'Это демо-режим. Открой приложение через Telegram, чтобы сохранять свои анализы.' });
    }

    if (pathname === '/health' || pathname === '/api/health') {
      return json(res, 200, {
        ok: true,
        bot: Boolean(BOT_TOKEN),
        version: 1,
        db: globalThis.__dbReady ? 'ok' : 'unavailable',
        ocr: await ocrAvailable(),
      });
    }

    if (pathname === '/api/diag' && req.method === 'GET') {
      const diagKey = process.env.DIAG_KEY;
      if (diagKey && url.searchParams.get('key') !== diagKey) return json(res, 401, { error: 'Нужен ?key=' });

      const info = dbInfo();
      let webhook = null;

      if (BOT_TOKEN) {
        try {
          const response = await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`, 4000);
          const data = await response.json();
          webhook = data.ok
            ? {
                url: data.result.url || null,
                pending: data.result.pending_update_count || 0,
                error: data.result.last_error_message || null,
              }
            : { error: data.description || 'Telegram не ответил' };
        } catch (error) {
          webhook = { error: error.message };
        }
      }

      let demo = null;
      try {
        const state = await buildState('demo');
        demo = state ? { documents: state.documents.length, indicators: state.summary.indicators } : null;
      } catch (error) {
        demo = { error: error.message };
      }

      return json(res, 200, {
        ok: true,
        version: 1,
        db: { ...info, ok: Boolean(globalThis.__dbReady) },
        bot: { configured: Boolean(BOT_TOKEN), webhook },
        ocr: await ocrAvailable(),
        demo,
        time: new Date().toISOString(),
      });
    }

    if (pathname === '/api/state' && req.method === 'GET') {
      const id = await userOrCreate(user);
      const state = await buildState(id);
      if (!user.authenticated) state.readonly = true;
      return json(res, 200, state);
    }

    if (pathname === '/api/profile' && req.method === 'POST') {
      const id = await userOrCreate(user);
      const body = await readJson(req);
      const patch = {};
      if (body.name !== undefined) patch.name = String(body.name).slice(0, 60);
      if (body.sex === 'male' || body.sex === 'female') patch.sex = body.sex;
      if (body.birth_year) patch.birth_year = Number(body.birth_year);
      if (body.goal) patch.goal = String(body.goal).slice(0, 20);
      await updateProfile(id, patch);
      return json(res, 200, await buildState(id));
    }

    if (pathname === '/api/ingest' && req.method === 'POST') {
      const id = await userOrCreate(user);
      const filename = String(url.searchParams.get('filename') || req.headers['x-filename'] || 'upload.pdf');
      const buffer = await readBody(req);
      if (!buffer.length) return json(res, 400, { error: 'Пустой файл' });

      const mimetype = req.headers['content-type'] || '';

      if (isImageUpload(filename, mimetype)) {
        if (!(await ocrAvailable())) {
          return json(res, 422, { error: 'Распознавание фото доступно только на macOS. Пришли PDF или вставь текст бланка.' });
        }

        let text = '';
        try {
          text = await ocrImage(buffer, filename);
        } catch (error) {
          console.error('[ocr]', error.message);
          return json(res, 422, { error: 'Не удалось прочитать фото. Попробуй снять ровнее или пришли PDF.' });
        }

        if (!text || text.length < 5) return json(res, 422, { error: 'На фото не нашлось текста. Нужен более резкий снимок.' });

        const parsed = parseText(text);
        const results = enrichPreview(parsed.results, await profileOf(id));

        return json(res, 200, {
          lab: parsed.lab, taken_at: parsed.taken_at, filename, ocr: true, pages: 1,
          results, stats: { ...parsed.stats, total: results.length }, preview: text.slice(0, 1200),
        });
      }

      const parsed = await parseUpload(buffer, filename, mimetype);
      const results = enrichPreview(parsed.results, await profileOf(id));

      return json(res, 200, {
        lab: parsed.lab, taken_at: parsed.taken_at, filename, pages: parsed.pages || null,
        results, stats: { ...parsed.stats, total: results.length },
        preview: parsed.text ? parsed.text.slice(0, 1200) : null,
      });
    }

    if (pathname === '/api/ingest/text' && req.method === 'POST') {
      const id = await userOrCreate(user);
      const body = await readJson(req);
      const text = String(body.text || '');
      if (text.trim().length < 5) return json(res, 400, { error: 'Слишком короткий текст' });

      const parsed = parseText(text);
      const results = enrichPreview(parsed.results, await profileOf(id));

      return json(res, 200, {
        lab: body.lab || parsed.lab,
        taken_at: body.taken_at || parsed.taken_at,
        filename: 'Вставленный текст',
        results, stats: { ...parsed.stats, total: results.length },
      });
    }

    if (pathname === '/api/documents' && req.method === 'POST') {
      const id = await userOrCreate(user);
      const body = await readJson(req);
      const results = Array.isArray(body.results) ? body.results : [];
      if (!results.length) return json(res, 400, { error: 'Нет показателей для сохранения' });

      const clean = results
        .filter((r) => r && r.name && r.value !== null && r.value !== '' && Number.isFinite(Number(r.value)))
        .map((r) => ({
          code: r.code || matchIndicator(r.raw_name || r.name)?.code || null,
          name: r.name,
          raw_name: r.raw_name || r.name,
          value: Number(r.value),
          value_text: r.value_text || null,
          unit: r.unit || '',
          ref_low: r.ref_low === null || r.ref_low === '' || r.ref_low === undefined ? null : Number(r.ref_low),
          ref_high: r.ref_high === null || r.ref_high === '' || r.ref_high === undefined ? null : Number(r.ref_high),
          ref_text: r.ref_text || null,
        }));

      if (!clean.length) return json(res, 400, { error: 'Не удалось прочитать значения' });

      // Пользователь проверил распознанное — запоминаем названия из бланка.
      for (const item of clean) {
        if (item.code && item.raw_name && BY_CODE.has(item.code)) {
          await saveAlias(item.raw_name, item.code, id);
          learnAlias(item.raw_name, item.code);
        }
      }

      const saved = await addDocument(
        id,
        {
          lab: body.lab || 'Лаборатория',
          taken_at: body.taken_at || new Date().toISOString().slice(0, 10),
          filename: body.filename || null,
          source: body.source || 'upload',
        },
        clean,
      );

      return json(res, 200, { ok: true, ...saved, state: await buildState(id) });
    }

    if (pathname.startsWith('/api/documents/') && req.method === 'DELETE') {
      const id = await userOrCreate(user);
      const documentId = pathname.split('/').pop();
      await deleteDocument(id, documentId);
      return json(res, 200, { ok: true, state: await buildState(id) });
    }

    if (pathname.startsWith('/api/documents/') && req.method === 'GET') {
      const id = await userOrCreate(user);
      const documentId = pathname.split('/').pop();
      const doc = await getDocument(id, documentId);
      if (!doc) return json(res, 404, { error: 'Документ не найден' });
      const rows = (await allResults(id)).filter((r) => r.document_id === documentId);
      return json(res, 200, { document: doc, results: rows });
    }

    if (pathname === '/api/aliases' && req.method === 'POST') {
      const id = await userOrCreate(user);
      const body = await readJson(req);
      const raw = String(body.raw || '').trim();
      const code = body.code ? String(body.code) : '';
      if (!raw || !code || !BY_CODE.has(code)) return json(res, 400, { error: 'Нужны название из бланка и код показателя' });
      await saveAlias(raw, code, id);
      learnAlias(raw, code);
      return json(res, 200, { ok: true });
    }

    if (pathname === '/api/demo' && req.method === 'POST') {
      const id = await userOrCreate(user);
      await seedDemo(id);
      return json(res, 200, { ok: true, state: await buildState(id) });
    }

    if (pathname === '/api/export.csv' && req.method === 'GET') {
      const id = await userOrCreate(user);
      const csv = toCsv(await buildState(id));
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="dinamika-analyses.csv"',
      });
      return res.end(csv);
    }

    if (isBotWebhook && req.method === 'POST') {
      const secret = process.env.WEBHOOK_SECRET;
      if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
        return json(res, 401, { error: 'Неверный секрет вебхука' });
      }
      const update = await readJson(req);
      const webappUrl = PUBLIC_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || ''}`;
      handleTelegramUpdate(update, { token: BOT_TOKEN, webappUrl }).catch((error) => console.error('[webhook]', error));
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET') return serveStatic(req, res, pathname);

    return json(res, 404, { error: 'Не найдено' });
  } catch (error) {
    console.error('[server]', error);
    return json(res, 400, { error: error.message || 'Что-то пошло не так' });
  }
});

async function seedIfEmpty() {
  if (process.env.SEED_DEMO === '0') {
    console.log('SEED_DEMO=0 — демо-данные не создаю');
    return;
  }

  try {
    const state = await buildState('demo');
    if (!state || !state.documents.length) {
      const seeded = await seedDemo('demo');
      console.log(`Демо-данные: ${seeded.documents} документа, ${seeded.results} показателей`);
    }
  } catch (error) {
    console.error('Не удалось подготовить демо-данные:', error.message);
  }
}

function start(port, attempt = 0) {
  const onListening = () => {
    server.off('error', onError);
    const actual = server.address()?.port ?? port;
    const info = dbInfo();
    console.log(`Динамика · мини-апп на http://127.0.0.1:${actual}`);
    console.log(info.kind === 'postgres' ? `Данные: Postgres ${info.host}` : `Данные: SQLite ${process.env.DATABASE_PATH || './data/dinamika.db'}`);
    if (!BOT_TOKEN) console.log('BOT_TOKEN не задан — демо-режим без подписи Telegram');
    seedIfEmpty().catch((error) => console.error('Демо:', error.message));
  };

  const onError = (error) => {
    server.off('listening', onListening);
    if (error.code === 'EADDRINUSE' && attempt < 10) {
      console.warn(`Порт ${port} занят, пробую ${port + 1}…`);
      start(port + 1, attempt + 1);
      return;
    }
    console.error(error);
    process.exit(1);
  };

  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, '0.0.0.0');
}

async function bootstrap() {
  let dbReady = false;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await initDb();
      dbReady = true;
      break;
    } catch (error) {
      console.error(`База недоступна (попытка ${attempt}/3): ${error.message}`);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  globalThis.__dbReady = dbReady;
  if (!dbReady) console.error('Сервер поднимется без базы. Проверь DATABASE_URL или DATABASE_PATH.');

  if (dbReady) {
    try {
      const aliases = await listAliases();
      setLearnedAliases(aliases.map((row) => [row.raw, row.code]));
    } catch (error) {
      console.error('Не удалось загрузить алиасы:', error.message);
    }
  }

  start(PORT);
}

bootstrap();
