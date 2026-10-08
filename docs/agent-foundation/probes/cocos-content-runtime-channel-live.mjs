// Normal Web preview startup: no source injection. CDP reads scene state and closes the owned socket for reconnect testing.
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const content = require('../../../tools/cocos-agent-bridge/content-release.js');
const { start } = require('../../../tools/cocos-agent-bridge/runtime/content-runtime-host.js');
const root = path.resolve(import.meta.dirname, '../../..');
if (process.argv[2] && process.argv[2] !== '2.4') throw Error('This acceptance harness is scoped to Creator 2.4.15.');
const choice = '2.4';
const version = '2.4.15';
const projectRoot = path.join(root, '2.4.15NewProject');
const previewPort = 7456;
const releaseDir = path.join(projectRoot, '.cocos-agent', 'content-releases');
const ids = { red: `channel-red-${crypto.randomBytes(4).toString('hex')}`, blue: `channel-blue-${crypto.randomBytes(4).toString('hex')}` };
const profile = fs.mkdtempSync(path.join(os.tmpdir(), `cocos-channel-${choice}-`));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let host; let chrome; let socket;
let ownsContentState = false;
let serial = 0;
const pending = new Map();
const browserErrors = [];

function manifest(color) {
    const basename = `cocos-agent-batch-${color}`;
    const source = `assets/resources/${basename}.png`;
    const bytes = fs.readFileSync(path.join(projectRoot, source));
    return { contractVersion: '0.1', releaseId: ids[color], creatorVersion: version,
        delivery: 'built-in-resources', entryAssetId: 'visual', assets: [{ id: 'visual', source,
            sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
            runtimePath: basename, dependsOn: [] }] };
}
function ensure(result) { if (!result.success) throw Error(JSON.stringify(result)); return result; }
function state() { return ensure(content.get({ projectRoot, creatorVersion: version })); }
async function until(label, predicate) {
    for (let i = 0; i < 120; i++) {
        if (predicate()) return;
        await delay(100);
    }
    throw Error(`TIMEOUT_${label}: ${JSON.stringify({ state: state(), events: host.events, browserErrors })}`);
}
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
async function browser(url) {
    chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
        '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
        `--user-data-dir=${profile}`, '--remote-allow-origins=*', '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader', '--window-size=1280,800', url,
    ], { stdio: 'ignore' });
    let port;
    await until('CHROME_PORT', () => {
        const file = path.join(profile, 'DevToolsActivePort');
        if (!fs.existsSync(file)) return false;
        port = Number(fs.readFileSync(file, 'utf8').split('\n')[0]);
        return !!port;
    });
    let page;
    for (let i = 0; i < 100; i++) {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        page = pages.find((item) => item.type === 'page' && item.url.includes(String(previewPort)));
        if (page) break;
        await delay(100);
    }
    if (!page) throw Error('PREVIEW_PAGE_MISSING');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (pending.has(message.id)) {
            const item = pending.get(message.id);
            pending.delete(message.id);
            message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result);
        }
        if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')
            browserErrors.push(message.params.args.map((arg) => arg.value || arg.description || '').join(' '));
    };
    await send('Runtime.enable');
    await send('Page.enable');
}
async function observedTexture() {
    return evaluate("(function(){var s=cc.director.getScene();var c=s&&s.getChildByName('Canvas');var n=c&&c.getChildByName('CocosAgentContentRuntime');var f=n&&n.getComponent(cc.Sprite).spriteFrame;return !!(f&&f.getTexture())})()");
}
async function shot(color) {
    const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const filename = path.join(root, 'docs/agent-foundation/traces/visual', `cocos-content-channel-${choice}-${color}.png`);
    fs.writeFileSync(filename, Buffer.from(image.data, 'base64'));
    return filename;
}
function pixel(filename) {
    const result = spawnSync('python3', ['-c', 'from PIL import Image\nimport sys\nprint(",".join(map(str, Image.open(sys.argv[1]).convert("RGB").getpixel((640, 350)))))', filename], { encoding: 'utf8' });
    if (result.status !== 0) throw Error(`SCREENSHOT_PIXEL_UNAVAILABLE ${result.stderr}`);
    return result.stdout.trim();
}
async function main() {
    if (fs.existsSync(path.join(releaseDir, 'selected.json')) || fs.existsSync(path.join(releaseDir, 'effective.json')))
        throw Error('EXISTING_CONTENT_STATE');
    ownsContentState = true;
    for (const color of ['red', 'blue']) ensure(content.stage({ projectRoot, creatorVersion: version, manifest: manifest(color) }));
    ensure(content.select({ projectRoot, creatorVersion: version, releaseId: ids.red, expectedCurrent: null }));
    host = await start({ projectRoot, creatorVersion: version, previewUrl: `http://127.0.0.1:${previewPort}/` });
    await browser(host.previewUrl);
    await until('RED_EFFECTIVE', () => state().effective?.releaseId === ids.red);
    const red = { texture: await observedTexture(), image: await shot('red') };
    ensure(content.select({ projectRoot, creatorVersion: version, releaseId: ids.blue, expectedCurrent: ids.red }));
    await until('BLUE_EFFECTIVE', () => state().effective?.releaseId === ids.blue);
    const blue = { texture: await observedTexture(), image: await shot('blue') };
    const expected = Object.fromEntries(['red', 'blue'].map((color) => [color,
        content.get({ projectRoot, creatorVersion: version, releaseId: ids[color] }).release.assets[0].resourceUuid]));
    const colors = { red: pixel(red.image), blue: pixel(blue.image) };
    if (!red.texture || !blue.texture || colors.red !== '255,0,0' || colors.blue !== '0,0,255')
        throw Error(`VISIBLE_TEXTURE_MISMATCH ${JSON.stringify({ red, blue, colors, expected })}`);
    const closed = await evaluate("(function(){var c=cc.director.getScene().getChildByName('Canvas').getComponents(cc.Component).find(function(x){return !!x._cocosAgentChannel});if(!c)return false;c._cocosAgentChannel.socket.close();return true})()");
    if (!closed) throw Error('RUNTIME_CHANNEL_COMPONENT_MISSING');
    await until('RECONNECT_ALREADY_ACTIVE', () => host.events.some((event) => event.type === 'receipt' && event.receipt.outcome === 'already-active'));
    if (pixel(await shot('reconnected')) !== '0,0,255') throw Error('RECONNECT_VISIBLE_CONTENT_CHANGED');
    const trace = { creatorVersion: version, startup: 'scene-component', ids, expected, red, blue, colors,
        events: host.events, final: state() };
    const output = path.join(root, 'docs/agent-foundation/traces', `cocos-agent-content-channel-${choice}-web.json`);
    fs.writeFileSync(output, `${JSON.stringify(trace, null, 2)}\n`);
    process.stdout.write(`CONTENT_CHANNEL_ACCEPTED ${version} ${output}\n`);
}
try { await main(); }
catch (error) { process.stderr.write(`CONTENT_CHANNEL_ERROR ${error.stack || error}\n`); process.exitCode = 1; }
finally {
    if (socket?.readyState === WebSocket.OPEN) socket.close();
    if (chrome) { chrome.kill(); if (chrome.exitCode === null) await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(2000)]); }
    if (host) await host.close();
    if (ownsContentState) {
        for (const id of Object.values(ids)) try { fs.unlinkSync(path.join(releaseDir, `${id}.json`)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        for (const name of ['selected.json', 'effective.json']) try { fs.unlinkSync(path.join(releaseDir, name)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        try { fs.rmdirSync(releaseDir); } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error; }
    }
    fs.rmSync(profile, { recursive: true, force: true });
}
