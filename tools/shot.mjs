import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9444;
const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:3020';
const OUT = path.resolve('shots');
const W = 390, H = 844;
const ROUTES = { dashboard: '#/dashboard', detail: '#/i/ferritin', indicators: '#/indicators', profile: '#/profile', add: '#/add' };
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/dinamika-shot2', 'about:blank'], { stdio: 'ignore' });

async function waitChrome() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('chrome');
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map();
    this.ready = new Promise((res, rej) => { this.ws.addEventListener('open', res); this.ws.addEventListener('error', rej); });
    this.ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }
    });
  }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}

try {
  await waitChrome();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

  for (const [name, hash] of Object.entries(ROUTES)) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true, screenWidth: W, screenHeight: H });
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await cdp.send('Page.navigate', { url: `${BASE}/${hash}` });
    await sleep(1200);
    await cdp.send('Runtime.evaluate', { expression: `new Promise(r=>{const t=setInterval(()=>{if(!document.getElementById('boot')){clearInterval(t);r(1)}},50);setTimeout(()=>{clearInterval(t);r(0)},4000)})`, awaitPromise: true });
    await sleep(700);
    const { cssContentSize } = await cdp.send('Page.getLayoutMetrics');
    const height = Math.min(Math.ceil(cssContentSize.height), 1400);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height, scale: 1 } });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`${name}: ${W}×${height}`);
  }
  cdp.ws.close();
} finally { chrome.kill('SIGKILL'); }
