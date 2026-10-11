import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

class Element {
    constructor() {
        this.children = [];
        this.listeners = {};
        this.parentNode = null;
        this.dataset = {};
        this.classList = { add() {}, remove() {}, toggle() {} };
        this.scrollHeight = 0;
    }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    replaceChild(next, old) { const index = this.children.indexOf(old); this.children[index] = next; next.parentNode = this; old.parentNode = null; }
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
}

test('plan card is rendered as text and starts only the selected Agent step', () => {
    let definition;
    const ipcMessages = [];
    class WebSocketMock { static OPEN = 1; }
    vm.runInNewContext(fs.readFileSync(path.join(root, '2.4.15NewProject/packages/cocos-agent-bridge/panel/index.js'), 'utf8'), {
        Editor: { Panel: { extend(value) { definition = value; } }, Ipc: { sendToMain(...args) { ipcMessages.push(args); } } },
        document: { createElement: () => new Element() },
        window: { crypto: { randomUUID: () => 'request-id' } },
        localStorage: { getItem: () => null, setItem() {} }, WebSocket: WebSocketMock,
    });
    for (const name of Object.keys(definition.$)) definition[`$${name}`] = new Element();
    definition.$modeAsk.dataset.mode = 'Ask';
    definition.$modePlan.dataset.mode = 'Plan';
    definition.$modeAgent.dataset.mode = 'Agent';
    definition.$messages.children = [];
    definition._planCards = new Map();
    definition._plans = new Map();
    definition._busy = false;
    definition._modeButtons = [definition.$modeAsk, definition.$modePlan, definition.$modeAgent];
    definition._conversationId = 'conversation-id';
    definition._mode = 'Plan';
    definition._socket = { readyState: 1, send(payload) { ipcMessages.push(JSON.parse(payload)); } };
    definition.addActivity = () => {};
    const plan = { id: 'plan-123', conversationId: 'conversation-id', title: '<script>Title</script>',
        summary: 'Two reviewed steps.', steps: [
            { title: 'Inspect', description: 'Read state.', preconditions: [], requiredTools: ['cocos_2x_scene_snapshot'], validation: 'Receipt.', recovery: 'Stop.' },
            { title: 'Create', description: 'Create node.', preconditions: ['Fresh parent.'], requiredTools: ['cocos_2x_command_execute', 'cocos_2x_scene_node_inspect'], validation: 'Read it back.', recovery: 'Compensate.' },
        ], nextStepIndex: 0, completedSteps: 0, status: 'proposed' };
    definition.renderPlan(plan);
    const card = definition.$messages.children[0];
    assert.equal(card.className, 'plan-card');
    assert.equal(card.children[0].textContent, '<script>Title</script>');
    assert.match(card.children[2].children[1].children[0].textContent,
        /必需工具：cocos_2x_command_execute、cocos_2x_scene_node_inspect/);
    const button = card.children.at(-1);
    button.listeners.click();
    const request = ipcMessages.at(-1);
    assert.equal(request.mode, 'Agent');
    assert.equal(definition._mode, 'Agent');
    assert.deepEqual({ planId: request.planExecution.planId, stepIndex: request.planExecution.stepIndex },
        { planId: 'plan-123', stepIndex: 0 });
    assert.equal(definition._busy, true);
});

test('plan action is enabled after a Plan request finishes', () => {
    let definition;
    class WebSocketMock { static OPEN = 1; }
    vm.runInNewContext(fs.readFileSync(path.join(root, '2.4.15NewProject/packages/cocos-agent-bridge/panel/index.js'), 'utf8'), {
        Editor: { Panel: { extend(value) { definition = value; } }, Ipc: { sendToMain() {} } },
        document: { createElement: () => new Element() },
        window: { crypto: { randomUUID: () => 'request-id' } },
        localStorage: { getItem: () => null, setItem() {} }, WebSocket: WebSocketMock,
    });
    for (const name of Object.keys(definition.$)) definition[`$${name}`] = new Element();
    definition.$modeAsk.dataset.mode = 'Ask';
    definition.$modePlan.dataset.mode = 'Plan';
    definition.$modeAgent.dataset.mode = 'Agent';
    definition.$messages.children = [];
    definition._planCards = new Map();
    definition._plans = new Map();
    definition._busy = true;
    definition._modeButtons = [definition.$modeAsk, definition.$modePlan, definition.$modeAgent];
    definition.addActivity = () => {};
    const plan = { id: 'plan-finished', title: 'Plan', summary: 'Review.',
        steps: [{ title: 'Create', description: 'Create.', preconditions: [], requiredTools: ['cocos_2x_command_execute'], validation: 'Read.', recovery: 'Check.' }],
        nextStepIndex: 0, completedSteps: 0, status: 'proposed' };
    definition.renderPlan(plan);
    assert.equal(definition.$messages.children[0].children.at(-1).disabled, true);
    definition.finishRun();
    assert.equal(definition._busy, false);
    assert.equal(definition.$messages.children[0].children.at(-1).disabled, false);
});

for (const [status, label] of [['completed', '已结束'], ['needs-review', '待核对'],
    ['awaiting-approval', '等待批准'], ['stopped', '已停止'], ['failed', '失败']]) {
    test(`Ask terminal ${status} replaces the running status and allows the next request`, () => {
        let panel;
        let requestCount = 0;
        const sent = [];
        vm.runInNewContext(fs.readFileSync(path.join(root, '2.4.15NewProject/packages/cocos-agent-bridge/panel/index.js'), 'utf8'), {
            Editor: { Panel: { extend(value) { panel = value; } }, Ipc: { sendToMain(event, callback) {
                if (event === 'cocos-agent-bridge:projectContextGet') callback(null, {
                    projectName: 'TestProject', creatorVersion: '2.4.15', activeScene: 'scene.fire',
                    selectedNodes: [], selectionStatus: 'read', projectConventions: { status: 'missing' },
                });
            } } },
            document: { createElement: () => new Element() },
            window: { crypto: { randomUUID: () => `request-${++requestCount}` } },
            localStorage: { getItem: () => null, setItem() {} }, WebSocket: { OPEN: 1 },
        });
        for (const name of Object.keys(panel.$)) panel[`$${name}`] = new Element();
        panel.ready();
        panel._socket = { readyState: 1, send: (raw) => sent.push(JSON.parse(raw)) };
        panel.$prompt.value = 'Read the scene.';
        panel.sendPrompt();
        const heading = panel._runActivity;
        assert.equal(heading.textContent, 'Ask · 正在处理…');
        const requestId = sent.at(-1).requestId;
        panel.receiveMessage(JSON.stringify({ type: 'run.result', requestId: 'other-request', result: { status: 'completed' } }));
        assert.equal(panel._busy, true);
        assert.equal(heading.textContent, 'Ask · 正在处理…');
        panel.receiveMessage(JSON.stringify(status === 'failed'
            ? { type: 'run.failed', requestId, message: 'Model unavailable' }
            : { type: 'run.result', requestId, result: { status, reason: 'terminal-test', finalText: 'Receipt checked.' } }));
        assert.equal(heading.textContent, `Ask · ${label}`);
        assert.equal(panel._busy, false);
        assert.equal(panel._requestId, null);
        assert.equal(panel.$send.disabled, false);
        assert.ok(panel._modeButtons.every((button) => button.disabled === false));
        panel.$prompt.value = 'Read again.';
        panel.sendPrompt();
        assert.equal(sent.length, 2);
        assert.notEqual(sent.at(-1).requestId, requestId);
        assert.equal(panel._runActivity.textContent, 'Ask · 正在处理…');
        assert.equal(heading.textContent, `Ask · ${label}`);
    });
}

test('panel exposes safe cancellation, expected diff details, and exact-operation readback on recent runs', () => {
    let panel;
    const sent = [];
    class WebSocketMock { static OPEN = 1; }
    vm.runInNewContext(fs.readFileSync(path.join(root, '2.4.15NewProject/packages/cocos-agent-bridge/panel/index.js'), 'utf8'), {
        Editor: { Panel: { extend(value) { panel = value; } }, Ipc: { sendToMain() {} } },
        document: { createElement: () => new Element() },
        window: { crypto: { randomUUID: () => 'request-id' } },
        localStorage: { getItem: () => null, setItem() {} }, WebSocket: WebSocketMock,
    });
    for (const name of Object.keys(panel.$)) panel[`$${name}`] = new Element();
    panel.$messages.children = [];
    panel._runCards = new Map();
    panel._busy = true;
    panel._requestId = 'run-id';
    panel._requestSent = true;
    panel._conversationId = 'conversation-id';
    panel._socket = { readyState: 1, send: (raw) => sent.push(JSON.parse(raw)) };

    panel.cancelRun();
    assert.equal(sent[0].type, 'run.cancel');
    assert.equal(panel.$cancelRun.disabled, true);

    panel.receiveMessage(JSON.stringify({ type: 'tool.finished', requestId: 'run-id', toolName: 'cocos_2x_script_patch_plan',
        result: { success: true, expectedDiff: [{ before: 'old();', after: 'new();' }] } }));
    const activity = panel.$messages.children[0];
    assert.equal(activity.children[0].children[0].textContent, '查看预期差异');
    assert.match(activity.children[0].children[1].textContent, /old\(\);/);

    const operationId = '11111111-1111-4111-8111-111111111111';
    panel.renderRecentRun({ id: 'run-id', conversationId: 'conversation-id', task: 'Edit button logic', mode: 'Agent',
        status: 'needs-review', activeTool: { toolName: 'cocos_2x_script_patch', access: 'write-approved', operationId },
        receipts: [{ toolName: 'cocos_2x_script_patch_plan', access: 'read', operationId,
            expectedDiff: [{ before: 'old();', after: 'new();' }] }] });
    const card = panel._runCards.get('run-id');
    assert.ok(card.children.some((child) => child.className === 'diff-details'));
    const effects = card.children.find((child) => child.className === 'run-effects');
    assert.match(effects.textContent, /中断时正在执行/);
    assert.match(effects.textContent, /结果尚未读回/);
    const recover = card.children.find((child) => child.className === 'run-recover');
    recover.listeners.click();
    assert.deepEqual(sent.at(-1), { type: 'run.recover', conversationId: 'conversation-id', runId: 'run-id', operationId });
});

test('panel explains context compaction and stops when required state exceeds the configured budget', () => {
    let panel;
    const activities = [];
    vm.runInNewContext(fs.readFileSync(path.join(root, '2.4.15NewProject/packages/cocos-agent-bridge/panel/index.js'), 'utf8'), {
        Editor: { Panel: { extend(value) { panel = value; } }, Ipc: { sendToMain() {} } },
        document: { createElement: () => new Element() },
        window: { crypto: { randomUUID: () => 'request-id' } },
        localStorage: { getItem: () => null, setItem() {} }, WebSocket: { OPEN: 1 },
    });
    for (const name of Object.keys(panel.$)) panel[`$${name}`] = new Element();
    panel._requestId = 'active-request';
    panel.addActivity = (text) => activities.push(text);

    panel.receiveMessage(JSON.stringify({ type: 'context.compacted', requestId: 'active-request', report: {
        summarizedToolCalls: 6, operationIdentities: ['operationId=op-1'],
        compactedToolResults: 2,
        outstandingAcceptance: [{ key: 'operationId=op-1', kind: 'preview', status: 'needs-preview' }],
    } }));
    panel.receiveMessage(JSON.stringify({ type: 'context.budget-exceeded', requestId: 'active-request', report: {
        estimatedTokens: 4_200, maxEstimatedTokens: 4_000,
    } }));

    assert.match(activities[0], /6 次旧工具调用/);
    assert.match(activities[0], /另缩短 2 条只读回执/);
    assert.match(activities[0], /保留 1 个操作身份和 1 项待验收\/恢复状态/);
    assert.match(activities[1], /4200 \/ 4000 tokens/);
    assert.match(activities[1], /停止后续模型调用/);
});
