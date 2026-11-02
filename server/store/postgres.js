// Postgres-хранилище (Neon и любой другой Postgres).
// Интерфейс совпадает с sqlite.js.

import pg from 'pg';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;

export const dbKind = 'postgres';

let pool = null;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL не задан');

  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

  // Neon добавляет параметры, которые node-postgres не понимает.
  let normalized = connectionString;
  try {
    const parsed = new URL(connectionString);
    parsed.searchParams.delete('channel_binding');
    normalized = parsed.toString();
  } catch {
    /* строка нестандартная — используем как есть */
  }

  pool = new Pool({
    connectionString: normalized,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on('error', (error) => console.error('[pg] pool error', error.message));
  return pool;
}

const q = (text, params) => getPool().query(text, params);

export async function initDb() {
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT, sex TEXT DEFAULT 'female',
      birth_year INTEGER, goal TEXT DEFAULT 'general',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, lab TEXT, taken_at TEXT NOT NULL,
      filename TEXT, source TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, document_id TEXT NOT NULL,
      code TEXT, name TEXT NOT NULL, raw_name TEXT, value DOUBLE PRECISION,
      value_text TEXT, unit TEXT, ref_low DOUBLE PRECISION, ref_high DOUBLE PRECISION,
      ref_text TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS aliases (
      raw TEXT PRIMARY KEY, code TEXT NOT NULL, user_id TEXT,
      hits INTEGER DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_results_user_code ON results(user_id, code);
    CREATE INDEX IF NOT EXISTS idx_results_document ON results(document_id);
    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, taken_at);
  `);
}

export async function ensureUser(id, name = null, sex = 'female') {
  await q('INSERT INTO users (id, name, sex, created_at) VALUES ($1, $2, $3, now()) ON CONFLICT (id) DO NOTHING', [
    id, name, sex,
  ]);
  const { rows } = await q('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function updateProfile(id, patch) {
  await ensureUser(id);

  const fields = [];
  const values = [];
  for (const key of ['name', 'sex', 'birth_year', 'goal']) {
    if (patch[key] !== undefined) {
      values.push(patch[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (!fields.length) return getUser(id);
  values.push(id);
  await q(`UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
  return getUser(id);
}

export async function getUser(id) {
  const { rows } = await q('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function listDocuments(userId) {
  const { rows } = await q(
    `SELECT d.*, COUNT(r.id)::int AS results_count
     FROM documents d
     LEFT JOIN results r ON r.document_id = d.id
     WHERE d.user_id = $1
     GROUP BY d.id
     ORDER BY d.taken_at DESC, d.created_at DESC`,
    [userId],
  );
  return rows;
}

export async function getDocument(userId, id) {
  const { rows } = await q('SELECT * FROM documents WHERE id = $1 AND user_id = $2', [id, userId]);
  return rows[0] || null;
}

export async function addDocument(userId, doc, results) {
  const documentId = doc.id || randomUUID();
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO documents (id, user_id, lab, taken_at, filename, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [documentId, userId, doc.lab || 'Лаборатория', doc.taken_at, doc.filename || null, doc.source || 'manual'],
    );

    for (const r of results) {
      await client.query(
        `INSERT INTO results (id, user_id, document_id, code, name, raw_name, value, value_text, unit, ref_low, ref_high, ref_text, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())`,
        [
          randomUUID(), userId, documentId, r.code || null, r.name, r.raw_name || null,
          r.value === null || r.value === undefined || r.value === '' ? null : Number(r.value),
          r.value_text || null, r.unit || null,
          r.ref_low === null || r.ref_low === undefined || r.ref_low === '' ? null : Number(r.ref_low),
          r.ref_high === null || r.ref_high === undefined || r.ref_high === '' ? null : Number(r.ref_high),
          r.ref_text || null,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { id: documentId, inserted: results.length };
}

export async function deleteDocument(userId, id) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM results WHERE document_id = $1 AND user_id = $2', [id, userId]);
    await client.query('DELETE FROM documents WHERE id = $1 AND user_id = $2', [id, userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function allResults(userId) {
  const { rows } = await q(
    `SELECT r.*, d.taken_at, d.lab, d.filename
     FROM results r JOIN documents d ON d.id = r.document_id
     WHERE r.user_id = $1 ORDER BY d.taken_at ASC, r.created_at ASC`,
    [userId],
  );
  return rows;
}

export async function clearUser(userId) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM results WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM documents WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listAliases() {
  const { rows } = await q('SELECT raw, code, hits FROM aliases');
  return rows;
}

export async function saveAlias(raw, code, userId = null) {
  if (!raw || !code) return;
  await q(
    `INSERT INTO aliases (raw, code, user_id, hits, created_at) VALUES ($1, $2, $3, 1, now())
     ON CONFLICT (raw) DO UPDATE SET hits = aliases.hits + 1, code = EXCLUDED.code`,
    [raw, code, userId],
  );
}

export async function stats(userId) {
  const [docs, results, labs] = await Promise.all([
    q('SELECT COUNT(*)::int AS c FROM documents WHERE user_id = $1', [userId]),
    q('SELECT COUNT(*)::int AS c FROM results WHERE user_id = $1', [userId]),
    q('SELECT COUNT(DISTINCT lab)::int AS c FROM documents WHERE user_id = $1', [userId]),
  ]);

  return {
    documents: docs.rows[0]?.c || 0,
    results: results.rows[0]?.c || 0,
    labs: labs.rows[0]?.c || 0,
  };
}
