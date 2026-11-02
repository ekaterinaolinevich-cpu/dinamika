// Слой хранения: Postgres (Neon), если задан DATABASE_URL, иначе SQLite.
//
// SQLite подгружается лениво: на проде с Neon модуль node:sqlite вообще не
// импортируется. Это важно — в Node 22 он за флагом --experimental-sqlite.

import * as postgres from './store/postgres.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const usePostgres = /^postgres(ql)?:\/\//i.test(DATABASE_URL);

export const dbKind = usePostgres ? 'postgres' : 'sqlite';

let storePromise = null;

function loadStore() {
  if (!storePromise) {
    storePromise = usePostgres ? Promise.resolve(postgres) : import('./store/sqlite.js');
  }
  return storePromise;
}

const call = (name) => async (...args) => {
  const store = await loadStore();
  return store[name](...args);
};

export const initDb = call('initDb');
export const ensureUser = call('ensureUser');
export const updateProfile = call('updateProfile');
export const getUser = call('getUser');
export const listDocuments = call('listDocuments');
export const getDocument = call('getDocument');
export const addDocument = call('addDocument');
export const deleteDocument = call('deleteDocument');
export const allResults = call('allResults');
export const clearUser = call('clearUser');
export const listAliases = call('listAliases');
export const saveAlias = call('saveAlias');
export const stats = call('stats');

export function dbInfo() {
  let host = null;
  if (usePostgres) {
    try {
      host = new URL(DATABASE_URL).host;
    } catch {
      host = 'invalid-url';
    }
  }
  return { kind: dbKind, host };
}
