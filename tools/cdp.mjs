/**
 * cdp.mjs — 用 Chrome DevTools Protocol 驱动 headless Chrome：抓控制台日志 + 截图 + 执行表达式
 * 用法: node cdp.mjs <url> <out.png> <waitMs> [evalExpr] [--width=1600] [--height=950]
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const url = process.argv[2];
const out = process.argv[3] || '/tmp/cdp.png';
const wait = +(process.argv[4] || 5000);
const evalExpr = process.argv[5] || 'null';
const argOf = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? +a.split('=')[1] : d;
};
const W = argOf('width', 1600), H = argOf('height', 950);
const evalTimeout = argOf('evaltimeout', 30000);
const shotTimeout = argOf('shottimeout', 90000);
const port = 9222 + (process.pid % 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));

const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl', '--disable-features=Vulkan',
  '--hide-scrollbars', '--mute-audio', '--no-first-run', '--disable-extensions',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
  `--window-size=${W},${H}`, 'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });
const chromeLog = fs.createWriteStream('/tmp/chrome.log');
chrome.stdout.pipe(chromeLog);
chrome.stderr.pipe(chromeLog);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const trace = (...a) => process.stderr.write(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${a.join(' ')}\n`);

async function getWsUrl() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) });
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('chrome 未就绪');
}

let id = 0;
const pending = new Map();
const logs = [];

function send(ws, method, params = {}, sessionId, timeoutMs = 20000) {
  const msg = { id: ++id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return Promise.race([
    new Promise((res, rej) => pending.set(msg.id, { res, rej })),
    sleep(timeoutMs).then(() => ({ __timeout: method })),
  ]).then((r) => {
    if (r && r.__timeout) throw new Error('CDP 超时: ' + method);
    return r;
  });
}

let ws, evalRes = '(未执行)';
try {
  const wsUrl = await getWsUrl();
  ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('WebSocket 连接超时')), 8000);
    ws.addEventListener('open', () => { clearTimeout(t); resolve(); }, { once: true });
    ws.addEventListener('error', () => { clearTimeout(t); reject(new Error('WebSocket 错误')); }, { once: true });
  });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
      return;
    }
    const meth = m.method;
    if (meth === 'Runtime.consoleAPICalled') {
      logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (meth === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logs.push(`[EXCEPTION] ${d.exception?.description || d.text} @${d.url}:${d.lineNumber}`);
    } else if (meth === 'Log.entryAdded') {
      logs.push(`[log:${m.params.entry.level}] ${m.params.entry.text}`);
    }
  };

  const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
  await send(ws, 'Runtime.enable', {}, sessionId);
  await send(ws, 'Log.enable', {}, sessionId);
  await send(ws, 'Page.enable', {}, sessionId);
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send(ws, 'Page.navigate', { url }, sessionId);
  trace('navigated');
  await sleep(wait);
  trace('waited');

  try {
    const r = await send(ws, 'Runtime.evaluate', { expression: evalExpr, returnByValue: true, awaitPromise: true }, sessionId, evalTimeout);
    evalRes = r.result?.value ?? r.result?.description ?? null;
  } catch (e) { evalRes = 'EVAL_ERR ' + e.message; }
  trace('eval-done');

  try {
    const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId, shotTimeout);
    if (shot && shot.data) fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
    trace('shot-done', out, fs.existsSync(out) ? fs.statSync(out).size : 0);
  } catch (e) { console.log('截图失败:', e.message); }
} catch (e) {
  console.log('脚本错误:', e.message);
} finally {
  console.log('=== console ===');
  console.log(logs.slice(0, 60).join('\n') || '(无输出)');
  console.log('=== eval ===');
  console.log(typeof evalRes === 'string' ? evalRes : JSON.stringify(evalRes, null, 1));
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
  process.exit(0);
}
