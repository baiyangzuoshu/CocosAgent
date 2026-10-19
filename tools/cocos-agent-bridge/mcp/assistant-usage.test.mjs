import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { AssistantStateStore } from './assistant-state-store.mjs';
import { summarizeModelUsage } from '../../cocos-agent-runtime/dist/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const request = (id, purpose, usage, extra = {}) => ({ requestId: id, provider: 'deepseek', model: 'deepseek-flash',
    purpose, startedAt: '2026-10-18T00:00:00Z', durationMs: 10, status: 'completed', httpStatus: 200, usage, ...extra });
const usage = { inputTokens: 100, outputTokens: 20, totalTokens: 120,
    cacheHitTokens: 60, cacheMissTokens: 40, reasoningTokens: null };

class Element {
    constructor() { this.children = []; this.parentNode = null; this.textContent = ''; this.className = ''; }
    get firstChild() { return this.children[0] || null; }
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
    appendChild(child) {
        if (child.parentNode) child.parentNode.removeChild(child);
        this.children.push(child); child.parentNode = this; return child;
    }
    replaceChild(next, old) { const i = this.children.indexOf(old); this.children[i] = next; next.parentNode = this; old.parentNode = null; }
    addEventListener() {}
}

function loadPanel() {
    let panel;
    vm.runInNewContext(fs.readFileSync(path.join(root, '2.4.15NewProject/packages/cocos-agent-bridge/panel/index.js'), 'utf8'), {
        Editor: { Panel: { extend(value) { panel = value; } } }, document: { createElement: () => new Element() },
    });
    panel.$messages = new Element();
    panel.addCopyButton = () => {};
    panel.updateTaskSidebar = () => {};
    panel.renderExecutionChecklist = () => {};
    panel._runCards = new Map();
    panel._requestId = 'task-a';
    return panel;
}
const text = (element) => [element.textContent, ...element.children.map(text)].join('\n');

test('persisted usage survives reload and numeric allowlist cannot retain credentials disguised as token metrics', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-usage-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const requests = [request('summary-1', 'summary', usage, { summaryKind: 'conversation' }),
        request('main-1', 'main-loop', null, { status: 'failed', errorCode: 'PROVIDER_NETWORK_ERROR' })];
    const summary = summarizeModelUsage(requests);
    const store = new AssistantStateStore(directory, { stateRoot: path.join(directory, 'state') });
    store.save({ conversations: [], plans: [], runs: [{ id: 'task-a', status: 'failed', modelUsage: summary,
        modelUsageRequests: requests, apiToken: 'private-value', injected: { inputTokens: 'private-value',
            totalTokens: { apiKey: 'private-value' }, cacheHitTokens: -1, accessToken: 123 } }] });
    const saved = store.load().runs[0];
    assert.deepEqual(saved.modelUsage, summary);
    assert.deepEqual(saved.modelUsageRequests, requests);
    assert.deepEqual(saved.injected, {});
    assert.equal(saved.apiToken, undefined);
    assert.ok(!fs.readFileSync(store.file, 'utf8').includes('private-value'));
    const panel = loadPanel();
    panel.renderRecentRun(saved);
    const visible = text(panel.$messages);
    assert.match(visible, /Token 用量 · 2 次模型请求/);
    assert.match(visible, /合计 120（1\/2 次有数据）/);
    assert.match(visible, /会话摘要/);
    assert.match(visible, /PROVIDER_NETWORK_ERROR/);
    assert.match(visible, /输入 未知/);
});

test('live request events update one task card and stale events cannot alter the current task', () => {
    const panel = loadPanel();
    const first = request('request-1', 'task-understanding', usage);
    const second = request('request-2', 'main-loop', { ...usage, inputTokens: 0, outputTokens: 0, totalTokens: 0,
        cacheHitTokens: 0, cacheMissTokens: 0 });
    for (const requests of [[first], [first, second], [first, second]]) {
        panel.receiveMessage(JSON.stringify({ type: 'model.usage', requestId: 'task-a',
            request: requests.at(-1), modelUsage: summarizeModelUsage(requests) }));
    }
    assert.equal(panel.$messages.children.length, 1);
    const visible = text(panel.$messages);
    assert.match(visible, /Token 用量 · 2 次模型请求/);
    assert.match(visible, /输入 0 · 输出 0 · 合计 0/);
    assert.equal((visible.match(/request request-2/g) || []).length, 1);
    panel.receiveMessage(JSON.stringify({ type: 'model.usage', requestId: 'other-task', request: first,
        modelUsage: summarizeModelUsage([first]) }));
    assert.equal(text(panel.$messages), visible);
});
