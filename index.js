// Точка входа для платформ, которые ищут index.js в корне проекта.
// Вся логика — в server/index.js.
//
// Если платформа запускает `node index.js` без флага --experimental-sqlite,
// а база локальная (SQLite), перезапускаем себя с нужным флагом.

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

let sqliteAvailable = true;
try {
  await import('node:sqlite');
} catch {
  sqliteAvailable = false;
}

if (!sqliteAvailable && !hasDatabaseUrl && !process.env.__DINAMIKA_REEXEC) {
  const { spawn } = await import('node:child_process');
  console.log('node:sqlite недоступен — перезапускаю с --experimental-sqlite');

  const child = spawn(process.execPath, ['--experimental-sqlite', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, __DINAMIKA_REEXEC: '1' },
  });

  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  await import('./server/index.js');
}
