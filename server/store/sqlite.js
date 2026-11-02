// SQLite-хранилище для локальной разработки.
// Интерфейс совпадает с postgres.js.

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const dbKind = 'sqlite';

function resolveDbPath() {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  if (process.env.DATA_DIR) return path.join(process.env.DATA_DIR, 'dinamika.db');
  try {
    if (fs.existsSync('/app/data')) return '/app/data/dinamika.db';
  } catch {
    /* не Linux/macOS */
  }
  return path.join(process.cwd(), 'data', 'dinamika.db');
}

let database = null;

function openDb() {
  if (database) return database;
  const file = resolveDbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  database = new DatabaseSync(file);

  database.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT, sex TEXT DEFAULT 'female',
      birth_year INTEGER, goal TEXT DEFAULT 'general', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, lab TEXT, taken_at TEXT NOT NULL,
      filename TEXT, source TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, document_id TEXT NOT NULL,
      code TEXT, name TEXT NOT NULL, raw_name TEXT, value REAL, value_text TEXT,
      unit TEXT, ref_low REAL, ref_high REAL, ref_text TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS aliases (
      raw TEXT PRIMARY KEY, code TEXT NOT NULL, user_id TEXT,
      hits INTEGER DEFAULT 1, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_results_user_code ON results(user_id, code);
    CREATE INDEX IF NOT EXISTS idx_results_document ON results(document_id);
    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, taken_at);
  `);

  try {
    database.exec("ALTER TABLE users ADD COLUMN goal TEXT DEFAULT 'general'");
  } catch {
    /* колонка уже есть */
  }

  return database;
}

const now = () => new Date().toISOString();

export async function initDb() {
  openDb();
}

export async function ensureUser(id, name = null, sex = 'female') {
  const db = openDb();
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (existing) return existing;
  db.prepare('INSERT INTO users (id, name, sex, created_at) VALUES (?, ?, ?, ?)').run(id, name, sex, now());
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export async function updateProfile(id, patch) {
  const db = openDb();
  await ensureUser(id);
  const fields = [];
  const values = [];
  for (const key of ['name', 'sex', 'birth_year', 'goal']) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(patch[key]);
    }
  }
  if (!fields.length) return getUser(id);
  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getUser(id);
}

export async function getUser(id) {
  return openDb().prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

export async function listDocuments(userId) {
  return openDb()
    .prepare(
      `SELECT d.*, (SELECT COUNT(*) FROM results r WHERE r.document_id = d.id) AS results_count
       FROM documents d WHERE d.user_id = ? ORDER BY d.taken_at DESC, d.created_at DESC`,
    )
    .all(userId);
}

export async function getDocument(userId, id) {
  return openDb().prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(id, userId) || null;
}

export async function addDocument(userId, doc, results) {
  const db = openDb();
  const documentId = doc.id || randomUUID();
  const createdAt = now();

  db.exec('BEGIN');
  try {
    db.prepare(
      'INSERT INTO documents (id, user_id, lab, taken_at, filename, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(documentId, userId, doc.lab || 'Лаборатория', doc.taken_at, doc.filename || null, doc.source || 'manual', createdAt);

    const insert = db.prepare(
      `INSERT INTO results (id, user_id, document_id, code, name, raw_name, value, value_text, unit, ref_low, ref_high, ref_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const r of results) {
      insert.run(
        randomUUID(), userId, documentId, r.code || null, r.name, r.raw_name || null,
        r.value === null || r.value === undefined ? null : Number(r.value),
        r.value_text || null, r.unit || null,
        r.ref_low === null || r.ref_low === undefined || r.ref_low === '' ? null : Number(r.ref_low),
        r.ref_high === null || r.ref_high === undefined || r.ref_high === '' ? null : Number(r.ref_high),
        r.ref_text || null, createdAt,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { id: documentId, inserted: results.length };
}

export async function deleteDocument(userId, id) {
  const db = openDb();
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM results WHERE document_id = ? AND user_id = ?').run(id, userId);
    db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').run(id, userId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export async function allResults(userId) {
  return openDb()
    .prepare(
      `SELECT r.*, d.taken_at, d.lab, d.filename
       FROM results r JOIN documents d ON d.id = r.document_id
       WHERE r.user_id = ? ORDER BY d.taken_at ASC, r.created_at ASC`,
    )
    .all(userId);
}

export async function clearUser(userId) {
  const db = openDb();
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM results WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM documents WHERE user_id = ?').run(userId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export async function listAliases() {
  return openDb().prepare('SELECT raw, code, hits FROM aliases').all();
}

export async function saveAlias(raw, code, userId = null) {
  if (!raw || !code) return;
  const db = openDb();
  const existing = db.prepare('SELECT hits FROM aliases WHERE raw = ?').get(raw);
  if (existing) {
    db.prepare('UPDATE aliases SET hits = hits + 1, code = ? WHERE raw = ?').run(code, raw);
    return;
  }
  db.prepare('INSERT INTO aliases (raw, code, user_id, hits, created_at) VALUES (?, ?, ?, 1, ?)').run(raw, code, userId, now());
}

export async function stats(userId) {
  const db = openDb();
  const docs = db.prepare('SELECT COUNT(*) AS c FROM documents WHERE user_id = ?').get(userId).c;
  const res = db.prepare('SELECT COUNT(*) AS c FROM results WHERE user_id = ?').get(userId).c;
  const labs = db.prepare('SELECT COUNT(DISTINCT lab) AS c FROM documents WHERE user_id = ?').get(userId).c;
  return { documents: docs, results: res, labs };
}
