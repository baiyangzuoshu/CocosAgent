// macOS repro: node creator-headless-probe.mjs 2.4 /absolute/path/to/2.4-probe.js
// or:          node creator-headless-probe.mjs 3.8 /absolute/path/to/3.8-probe.js
// Requires the matching Creator preview on localhost:7456/7457 and Google Chrome in /Applications.
// Prints STAGE8_PARTICLE2D/STAGE8_PARTICLE3D_NATURAL/STAGE8_CLIP and Stage 9 probe traces. Stage 8 screenshots go to /private/tmp.
// Uses an isolated temporary Chrome profile and removes it when finished.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const version = process.argv[2];
const previewPort = version === '2.4' ? 7456 : 7457;
const probePath = process.argv[3];
const profile = mkdtempSync(join(tmpdir(), 'cocos-stage8-chrome-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--remote-allow-origins=*', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--window-size=1280,800',
  `http://127.0.0.1:${previewPort}/`,
], { stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws;
let id = 0;
const pending = new Map();
const captures = [];
function send(method, params = {}) {
  const requestId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
}
async function main() {
  let port;
  for (let i = 0; i < 100; i++) {
    const path = join(profile, 'DevToolsActivePort');
    if (existsSync(path)) { port = Number(readFileSync(path, 'utf8').split('\n')[0]); break; }
    if (chrome.exitCode !== null) throw new Error(`Chrome exited ${chrome.exitCode}`);
    await delay(100);
  }
  if (!port) throw new Error('No DevToolsActivePort');
  let page;
  for (let i = 0; i < 100; i++) {
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    page = tabs.find(x => x.type === 'page' && x.url.includes(String(previewPort)));
    if (page) break;
    await delay(100);
  }
  if (!page) throw new Error('Preview page unavailable');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const item = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? item.reject(new Error(msg.error.message)) : item.resolve(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const values = msg.params.args.map(x => x.value ?? x.description ?? '').join(' ');
      if (/STAGE8_PARTICLE2D|STAGE8_PARTICLE3D_NATURAL|STAGE8_CLIP|STAGE9_3D|STAGE9_NATURAL|STAGE9_MOVING|STAGE9_REGISTRATION|COCOS_DYNAMIC/.test(values)) process.stdout.write(values + '\n');
      const captureMatch = values.match(/^STAGE8_(PARTICLE2D|PARTICLE3D_NATURAL)_(24|38)_MARK /);
      const dynamicCapture = values.match(/^COCOS_DYNAMIC_VISUAL_(24|38)_MARK (red|blue)\b/);
      if (captureMatch) {
        const phase = values.split(' ')[1];
        const kind = captureMatch[1] === 'PARTICLE2D' ? 'particle2d' : 'particle3d-natural';
        captures.push(send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
          .then(result => {
            const path = `/private/tmp/stage8-${kind}-${version}-${phase}.png`;
            writeFileSync(path, Buffer.from(result.data, 'base64'));
            process.stdout.write(`SCREENSHOT ${path}\n`);
          }).finally(() => send('Runtime.evaluate', { expression: 'window.__stage8CaptureResolve && window.__stage8CaptureResolve()' })));
      }
      if (dynamicCapture) {
        const phase = dynamicCapture[2];
        captures.push(send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
          .then(result => {
            const path = `/private/tmp/cocos-dynamic-visible-${version}-${phase}.png`;
            writeFileSync(path, Buffer.from(result.data, 'base64'));
            process.stdout.write(`SCREENSHOT ${path}\n`);
          }).finally(() => send('Runtime.evaluate', { expression: 'window.__cocosDynamicCaptureResolve && window.__cocosDynamicCaptureResolve()' })));
      }
    } else if (msg.method === 'Runtime.exceptionThrown') {
      process.stderr.write('PAGE_EXCEPTION ' + (msg.params.exceptionDetails.text || '') + '\n');
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  const readyExpression = 'typeof cc !== "undefined" && !!cc.director && !!cc.director.getScene() && !cc.game.isPaused()';
  let ready = false;
  for (let i = 0; i < 300; i++) {
    const result = await send('Runtime.evaluate', { expression: readyExpression, returnByValue: true });
    if (result.result.value === true) { ready = true; break; }
    await delay(100);
  }
  if (!ready) throw new Error('Preview runtime not ready');
  process.stdout.write(`HEADLESS_READY ${version} ${page.url}\n`);
  if (probePath) {
    await send('Runtime.evaluate', { expression: 'window.__stage8CaptureEnabled = true' });
    const expression = readFileSync(probePath, 'utf8');
    const result = await send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, timeout: 20000,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    await delay(300);
    await Promise.allSettled(captures);
  }
}
try { await main(); }
catch (error) { process.stderr.write('HEADLESS_ERROR ' + String(error.stack || error) + '\n'); process.exitCode = 1; }
finally {
  if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  chrome.kill();
  if (chrome.exitCode === null) await Promise.race([
    new Promise(resolve => chrome.once('exit', resolve)), delay(2000),
  ]);
  for (let attempt = 0; attempt < 5; attempt++) {
    try { rmSync(profile, { recursive: true, force: true }); break; }
    catch (error) {
      if (attempt === 4) process.stderr.write(`PROFILE_CLEANUP_ERROR ${error}\n`);
      else await delay(200);
    }
  }
}
