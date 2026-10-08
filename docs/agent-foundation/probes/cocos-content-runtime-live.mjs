// Run after the corresponding Creator Web preview is listening on 7456/7457.
// Uses a disposable Chrome profile. Restores the Host selected pointer and removes only its own release records.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const content = require('../../../tools/cocos-agent-bridge/content-release.js');
const root = path.resolve(import.meta.dirname, '../../..');
const choice = process.argv[2];
if (!['2.4', '3.8'].includes(choice)) throw Error('usage: cocos-content-runtime-live.mjs 2.4|3.8');
const version = choice === '2.4' ? '2.4.15' : '3.8.7';
const projectRoot = path.join(root, choice === '2.4' ? '2.4.15NewProject' : '3.8,7NewProject');
const port = choice === '2.4' ? 7456 : 7457;
const releaseDir = path.join(projectRoot, '.cocos-agent', 'content-releases');
const pointer = path.join(releaseDir, 'selected.json');
const effective = path.join(releaseDir, 'effective.json');
if (fs.existsSync(pointer) || fs.existsSync(effective)) throw Error('Existing content version state; refusing to overwrite it for the probe');
const nonce = crypto.randomBytes(4).toString('hex');
const ids = { red: `runtime-red-${nonce}`, blue: `runtime-blue-${nonce}` };
const savedFiles = Object.values(ids).map((id) => path.join(releaseDir, `${id}.json`));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), `cocos-runtime-${choice}-`));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, '--remote-allow-origins=*', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--window-size=1280,800', `http://127.0.0.1:${port}/`,
], { stdio: 'ignore' });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
let serial = 0;
const pending = new Map();
function send(method, params = {}) {
    const id = ++serial;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 30000 });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
    return result.result?.value;
}
function manifest(color) {
    const name = `cocos-agent-batch-${color}`;
    const source = `assets/resources/${name}.png`;
    const bytes = fs.readFileSync(path.join(projectRoot, source));
    return { contractVersion: '0.1', releaseId: ids[color], creatorVersion: version,
        delivery: 'built-in-resources', entryAssetId: 'visual', assets: [{ id: 'visual', source,
            sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
            runtimePath: choice === '2.4' ? name : `${name}/texture`, dependsOn: [] }] };
}
function select(color, expectedCurrent) {
    const result = content.select({ projectRoot, creatorVersion: version, releaseId: ids[color], expectedCurrent });
    if (!result.success) throw Error(JSON.stringify(result));
    const record = content.get({ projectRoot, creatorVersion: version, releaseId: ids[color] }).release;
    if (content.get({ projectRoot, creatorVersion: version }).selected.releaseId !== ids[color]) throw Error('Host selected pointer differs');
    return record;
}
async function apply(record) {
    const result = await evaluate(`window.__cocosContentRuntime.apply(${JSON.stringify(record)},'visual')`);
    if (!result || result.releaseId !== record.releaseId) throw Error(`No matching runtime receipt: ${JSON.stringify(result)}`);
    return result;
}
function accept(receipt) {
    const result = content.acceptRuntime({ projectRoot, creatorVersion: version,
        platform: 'web-preview', receipt });
    if (!result.success || result.effective.releaseId !== receipt.releaseId) throw Error(`Host rejected runtime receipt: ${JSON.stringify(result)}`);
    return result;
}
async function screenshot(color) {
    await delay(250);
    const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const filename = path.join(root, 'docs/agent-foundation/traces/visual', `cocos-content-runtime-${choice}-${color}.png`);
    fs.writeFileSync(filename, Buffer.from(image.data, 'base64'));
    return filename;
}
async function browser() {
    let debugPort;
    for (let i = 0; i < 100; i++) {
        const marker = path.join(profile, 'DevToolsActivePort');
        if (fs.existsSync(marker)) { debugPort = Number(fs.readFileSync(marker, 'utf8').split('\n')[0]); break; }
        if (chrome.exitCode !== null) throw Error(`Chrome exited ${chrome.exitCode}`);
        await delay(100);
    }
    if (!debugPort) throw Error('Chrome DevTools port unavailable');
    let page;
    for (let i = 0; i < 100; i++) {
        const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
        page = pages.find((item) => item.type === 'page' && item.url.includes(String(port)));
        if (page) break;
        await delay(100);
    }
    if (!page) throw Error('Creator preview page unavailable');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
            const task = pending.get(message.id);
            pending.delete(message.id);
            message.error ? task.reject(Error(message.error.message)) : task.resolve(message.result);
        } else if (message.method === 'Runtime.consoleAPICalled') {
            const line = message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ');
            if (line.includes('COCOS_CONTENT_RUNTIME')) process.stdout.write(`${line}\n`);
        } else if (message.method === 'Runtime.exceptionThrown') {
            process.stderr.write(`PAGE_EXCEPTION ${message.params.exceptionDetails.text}\n`);
        }
    };
    await send('Runtime.enable');
    await send('Page.enable');
    for (let i = 0; i < 300; i++) {
        if (await evaluate('typeof cc !== "undefined" && !!cc.director && !!cc.director.getScene() && !cc.game.isPaused()')) return page.url;
        await delay(100);
    }
    throw Error('Creator preview scene not ready');
}
async function main() {
    const url = await browser();
    const records = {};
    for (const color of ['red', 'blue']) {
        const input = manifest(color);
        const staged = content.stage({ projectRoot, creatorVersion: version, manifest: input });
        if (!staged.success) throw Error(JSON.stringify(staged));
    }
    await evaluate(fs.readFileSync(path.join(root, 'tools/cocos-agent-bridge/runtime/content-swap-core.js'), 'utf8'));
    await evaluate(fs.readFileSync(path.join(root, `docs/agent-foundation/probes/cocos-content-runtime-${choice}.js`), 'utf8'));
    records.red = select('red', null);
    const red = await apply(records.red);
    if (red.outcome !== 'applied') throw Error(`Red not applied: ${JSON.stringify(red)}`);
    const redObserved = accept(red);
    const redImage = await screenshot('red');
    records.blue = select('blue', ids.red);
    const blue = await apply(records.blue);
    if (blue.outcome !== 'applied' || blue.previousReleaseId !== ids.red) throw Error(`Blue not applied: ${JSON.stringify(blue)}`);
    const blueObserved = accept(blue);
    const blueImage = await screenshot('blue');
    await evaluate(`window.__cocosAgentForceLoadErrorFor=${JSON.stringify(records.red.assets[0].runtimePath)}`);
    select('red', ids.blue);
    const failed = await apply(records.red);
    if (failed.outcome !== 'retained' || failed.activeReleaseId !== ids.blue) throw Error(`Failed load did not retain blue: ${JSON.stringify(failed)}`);
    if (content.get({ projectRoot, creatorVersion: version }).effective.releaseId !== ids.blue) throw Error('Failed candidate altered Host effective version');
    const rollback = content.rollback({ projectRoot, creatorVersion: version, expectedCurrent: ids.red });
    if (!rollback.success || rollback.releaseId !== ids.blue) throw Error(`Host rollback failed: ${JSON.stringify(rollback)}`);
    await evaluate('window.__cocosAgentForceLoadErrorFor=null');
    select('red', ids.blue);
    const recovered = await apply(records.red);
    if (recovered.outcome !== 'applied' || recovered.previousReleaseId !== ids.blue) throw Error(`Recovery failed: ${JSON.stringify(recovered)}`);
    const recoveredObserved = accept(recovered);
    const snapshot = await evaluate('window.__cocosContentRuntime.snapshot()');
    const disposed = await evaluate('window.__cocosContentRuntimeCleanup()');
    const trace = { creatorVersion: version, previewUrl: url, releases: ids,
        receipts: { red, redObserved, blue, blueObserved, failed, hostRollback: rollback, recovered, recoveredObserved }, snapshot, disposed,
        screenshots: [redImage, blueImage] };
    const output = path.join(root, 'docs/agent-foundation/traces', `cocos-agent-content-runtime-${choice}-web.json`);
    fs.writeFileSync(output, `${JSON.stringify(trace, null, 2)}\n`);
    process.stdout.write(`CONTENT_RUNTIME_ACCEPTED ${version} ${output}\n`);
}
try { await main(); }
catch (error) { process.stderr.write(`CONTENT_RUNTIME_ERROR ${error.stack || error}\n`); process.exitCode = 1; }
finally {
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    chrome.kill();
    if (chrome.exitCode === null) await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(2000)]);
    for (const filename of savedFiles) try { fs.unlinkSync(filename); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { fs.unlinkSync(pointer); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { fs.unlinkSync(effective); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { fs.rmdirSync(releaseDir); } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error; }
    fs.rmSync(profile, { recursive: true, force: true });
}
