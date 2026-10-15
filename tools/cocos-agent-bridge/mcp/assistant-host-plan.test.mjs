import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { finalizePlanResult } from './assistant-host.mjs';
import { AssistantStateStore } from './assistant-state-store.mjs';

const options = { conversationId: 'conversation-plan', userTask: 'Inspect the scene.' };
const planData = { version: 2, title: 'Inspect scene', summary: 'Read the active scene.', steps: [
    { title: 'Inspect', description: 'Read the active scene.', preconditions: [],
        requiredTools: ['cocos_2x_scene_snapshot'], validation: 'A scene snapshot is returned.', recovery: 'Stop on failure.', acceptance: { kind: 'read' } },
] };

function kernelResult(finalText = JSON.stringify(planData)) {
    return { status: 'completed', reason: 'model-finished', finalText, availableToolNames: ['cocos_2x_scene_snapshot'],
        receipts: [
            { name: 'cocos_2x_instances_list', access: 'read', structuredContent: { success: true } },
            { name: 'cocos_2x_capabilities_list', access: 'read', structuredContent: { success: true } },
        ] };
}

function loadRunPanel() {
    class Element {
        constructor() { this.children = []; this.parentNode = null; this.style = {}; }
        appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
        addEventListener() {}
    }
    let panel;
    const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    vm.runInNewContext(fs.readFileSync(path.join(repository, '2.4.15NewProject/packages/cocos-agent-bridge/panel/index.js'), 'utf8'), {
        Editor: { Panel: { extend(value) { panel = value; } } }, document: { createElement: () => new Element() },
    });
    panel.$messages = new Element();
    panel._runCards = new Map();
    panel.renderExecutionChecklist = () => {};
    panel.addCopyButton = () => {};
    return panel;
}

test('invalid Plan output is failed in the transport, persisted history, and Creator run card', (t) => {
    const raw = kernelResult('I have now inspected the project and will create the dialog.');
    const { result, plan } = finalizePlanResult(raw, options);
    assert.equal(raw.status, 'completed');
    assert.equal(result.status, 'failed');
    assert.equal(result.reason, 'plan-validation-failed');
    assert.equal(plan, null);
    assert.match(result.finalText, /计划没有通过结构校验/);
    assert.strictEqual(result.receipts, raw.receipts);

    const wireResult = JSON.parse(JSON.stringify(result));
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-plan-failure-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const store = new AssistantStateStore(directory, { stateRoot: path.join(directory, 'user-state') });
    store.save({ conversations: [{ id: options.conversationId, messages: [{ role: 'assistant', content: wireResult.finalText }] }],
        plans: [], runs: [{ id: 'failed-plan-run', conversationId: options.conversationId, mode: 'Plan',
            task: options.userTask, status: wireResult.status, reason: wireResult.reason, receipts: wireResult.receipts }] });
    const restored = store.load();
    assert.equal(restored.runs[0].status, 'failed');
    assert.equal(restored.runs[0].reason, 'plan-validation-failed');
    assert.equal(restored.plans.length, 0);
    const panel = loadRunPanel();
    panel.renderRecentRun(restored.runs[0]);
    assert.match(panel._runCards.get('failed-plan-run').children[0].textContent, /^计划生成失败/);
    assert.doesNotMatch(panel._runCards.get('failed-plan-run').children[0].textContent, /已完成/);
});

test('malformed JSON, invalid plan schema, and unknown tools cannot generate a completed Plan', () => {
    const unknownToolPlan = { ...planData, steps: [{ ...planData.steps[0], requiredTools: ['cocos_2x_missing_tool'] }] };
    for (const output of ['{"version":', JSON.stringify({ version: 1, title: 'Incomplete' }), JSON.stringify(unknownToolPlan)]) {
        const { result, plan } = finalizePlanResult(kernelResult(output), options);
        assert.equal(result.status, 'failed');
        assert.equal(result.reason, 'plan-validation-failed');
        assert.equal(plan, null);
    }
});

test('a completed model response without successful Creator setup receipts is a failed Plan', () => {
    for (const receipts of [[], [{ name: 'cocos_2x_instances_list', structuredContent: { success: true } },
        { name: 'cocos_2x_capabilities_list', structuredContent: { success: false } }]]) {
        const { result, plan } = finalizePlanResult({ ...kernelResult(), receipts }, options);
        assert.equal(result.status, 'failed');
        assert.equal(result.reason, 'plan-preflight-missing');
        assert.equal(plan, null);
    }
});

test('valid Plan output remains completed and is displayed as a generated plan', () => {
    const { result, plan } = finalizePlanResult(kernelResult(), options);
    assert.equal(result.status, 'completed');
    assert.equal(result.reason, 'plan-generated');
    assert.equal(plan.status, 'proposed');
    assert.equal(plan.conversationId, options.conversationId);
    assert.equal(plan.steps.length, 1);
    assert.match(result.finalText, /已生成 1 步计划/);
    const panel = loadRunPanel();
    panel.renderRecentRun({ id: 'successful-plan', mode: 'Plan', task: options.userTask, status: result.status, reason: result.reason });
    assert.match(panel._runCards.get('successful-plan').children[0].textContent, /^计划已生成/);
    panel.renderRecentRun({ id: 'legacy-plan', mode: 'Plan', task: options.userTask, status: 'completed' });
    assert.match(panel._runCards.get('legacy-plan').children[0].textContent, /^已结束/);
    panel.renderRecentRun({ id: 'successful-agent', mode: 'Agent', task: 'Completed task.', status: 'completed' });
    assert.match(panel._runCards.get('successful-agent').children[0].textContent, /^已完成/);
});

test('cancelled, stopped, and failed kernel runs retain their status and reason without creating a plan', () => {
    for (const status of ['cancelled', 'stopped', 'failed']) {
        const raw = { ...kernelResult(), status, reason: `${status}-original`, receipts: [] };
        const finalized = finalizePlanResult(raw, options);
        assert.strictEqual(finalized.result, raw);
        assert.equal(finalized.result.status, status);
        assert.equal(finalized.result.reason, `${status}-original`);
        assert.equal(finalized.plan, null);
    }
});

test('unmet Agent goals remain visible in the restored run card instead of a completed label', () => {
    const panel = loadRunPanel();
    panel.renderRecentRun({ id: 'unmet-agent', mode: 'Agent', task: '创建网络连接弹窗', status: 'stopped',
        goalEvaluation: { satisfied: false, outstanding: [{ id: 'interaction', description: '实际网络交互尚未验收' }] } });
    const card = panel._runCards.get('unmet-agent');
    assert.match(card.children[0].textContent, /^未完成/);
    assert.match(card.children.find((child) => child.className === 'run-unmet').textContent, /实际网络交互尚未验收/);
});
