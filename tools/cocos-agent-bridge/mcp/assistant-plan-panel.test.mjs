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
