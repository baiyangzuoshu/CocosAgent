import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentKernel } from '../dist/agent-loop.js';
import { CreatorMemoryToolRegistry, CreatorProjectMemory } from '../dist/project-memory.js';

const PROJECT_A = 'a'.repeat(64);
const PROJECT_B = 'b'.repeat(64);
const MEMORY = 'cocos_2x_memory_';

class MemoryPersistence {
    value = null;
    failAfterCommit = false;

    async load() { return this.value === null ? null : structuredClone(this.value); }

    async save(value, expectedRevision) {
        const actual = this.value?.revision ?? 0;
        if (actual !== expectedRevision) {
            const error = new Error('PROJECT_MEMORY_CONCURRENT_UPDATE');
            error.sideEffect = 'none';
            throw error;
        }
        this.value = structuredClone(value);
        if (this.failAfterCommit) {
            this.failAfterCommit = false;
            const error = new Error('simulated response loss after atomic save');
            error.sideEffect = 'unknown';
            throw error;
        }
    }
}

function setup({ projectKey = PROJECT_A, task = '', history = [], evidence = [], persistence = new MemoryPersistence() } = {}) {
    const memory = CreatorProjectMemory.open({
        projectKey, runId: 'run-memory-1', task, history, persistence,
        evidence: () => evidence,
        now: () => new Date('2026-10-12T12:00:00.000Z'),
        createId: (() => { let id = 0; return () => `memory-${++id}`; })(),
    });
    return memory.then((value) => ({ memory: value, persistence }));
}

const userSource = (quote, messageIndex = 0) => ({ kind: 'user', messageIndex, quote });

test('remember stores only verified source citations and injects matching project memories with provenance', async () => {
    const task = 'Remember that this project uses a 640 by 960 portrait design resolution.';
    const { memory, persistence } = await setup({ task });
    const result = await memory.call(`${MEMORY}remember`, {
        title: 'Portrait design resolution', body: 'The project design resolution is 640 by 960 portrait.',
        category: 'project-fact', sources: [userSource('640 by 960 portrait design resolution')],
    }, 'call-remember-1');
    assert.equal(result.structuredContent?.success, true);
    assert.equal(result.structuredContent?.operationId, 'call-remember-1');
    assert.equal(persistence.value.memories.length, 1);
    assert.equal(persistence.value.memories[0].sources[0].runId, 'run-memory-1');
    assert.equal(persistence.value.memories[0].sources[0].messageIndex, 0);

    const reopened = await setup({ persistence });
    const context = await reopened.memory.relevantContext('portrait design settings');
    assert.match(context, /640 by 960 portrait/);
    assert.match(context, /"runId":"run-memory-1"/);
    assert.match(context, /"id":"memory-1","revision":1/);

    const unverified = await memory.call(`${MEMORY}remember`, {
        title: 'Unverified item', body: 'This was never said.', category: 'project-fact',
        sources: [userSource('A sentence not present in the request')],
    }, 'call-invalid-source');
    assert.equal(unverified.structuredContent?.success, false);
    assert.equal(unverified.structuredContent?.error?.code, 'MEMORY_SOURCE_NOT_VERIFIED');
    assert.equal(persistence.value.memories.length, 1);
});

test('tool provenance must name a successful receipt and exact quote; operation ID is captured', async () => {
    const evidence = [{ callId: 'scene-call-8', toolName: 'cocos_2x_scene_snapshot', result: {
        structuredContent: { success: true, operationId: 'scene-op-8', scene: { uuid: 'scene-uuid-8' } },
    } }];
    const { memory } = await setup({ task: 'Store the verified scene reference.', evidence });
    const bad = await memory.call(`${MEMORY}remember`, {
        title: 'Scene UUID', body: 'Scene UUID is scene-uuid-8.', category: 'project-fact',
        sources: [{ kind: 'tool', callId: 'scene-call-8', quote: 'scene-uuid-does-not-exist' }],
    }, 'memory-call-bad');
    assert.equal(bad.structuredContent?.error?.code, 'MEMORY_SOURCE_NOT_VERIFIED');

    evidence[0].result.structuredContent.success = false;
    const failedReceipt = await memory.call(`${MEMORY}remember`, {
        title: 'Failed observation', body: 'Do not trust a failed read.', category: 'project-fact',
        sources: [{ kind: 'tool', callId: 'scene-call-8', quote: 'scene-uuid-8' }],
    }, 'memory-call-failed');
    assert.equal(failedReceipt.structuredContent?.success, false);

    evidence[0].result.structuredContent.success = true;
    const good = await memory.call(`${MEMORY}remember`, {
        title: 'Scene UUID', body: 'Scene UUID is scene-uuid-8.', category: 'project-fact',
        sources: [{ kind: 'tool', callId: 'scene-call-8', quote: 'scene-uuid-8' }],
    }, 'memory-call-good');
    assert.equal(good.structuredContent?.success, true);
    assert.equal(good.structuredContent.memory.sources[0].toolName, 'cocos_2x_scene_snapshot');
    assert.equal(good.structuredContent.memory.sources[0].operationId, 'scene-op-8');
});

test('correction uses revision compare, retains prior text and provenance, and rejects stale writes', async () => {
    const persistence = new MemoryPersistence();
    const firstTask = 'Remember the current Canvas width is 640.';
    const first = await setup({ task: firstTask, persistence });
    const created = await first.memory.call(`${MEMORY}remember`, {
        title: 'Canvas width', body: 'Canvas width is 640.', category: 'project-fact',
        sources: [userSource('Canvas width is 640')],
    }, 'remember-width');
    const memoryId = created.structuredContent.memoryId;

    const secondTask = 'Correction: the current Canvas width is 720.';
    const second = await setup({ task: secondTask, persistence });
    const corrected = await second.memory.call(`${MEMORY}correct`, {
        memoryId, expectedRevision: 1, title: 'Canvas width', body: 'Canvas width is 720.', category: 'project-fact',
        sources: [userSource('current Canvas width is 720')],
    }, 'correct-width');
    assert.equal(corrected.structuredContent?.success, true);
    assert.equal(corrected.structuredContent.revision, 2);
    assert.equal(corrected.structuredContent.memory.history.length, 1);
    assert.equal(corrected.structuredContent.memory.history[0].body, 'Canvas width is 640.');
    assert.equal(corrected.structuredContent.memory.history[0].sources[0].quote, 'Canvas width is 640');

    const stale = await second.memory.call(`${MEMORY}correct`, {
        memoryId, expectedRevision: 1, title: 'Canvas width', body: 'Canvas width is 800.', category: 'project-fact',
        sources: [userSource('current Canvas width is 720')],
    }, 'correct-width-stale');
    assert.equal(stale.structuredContent?.error?.code, 'MEMORY_REVISION_CONFLICT');
    assert.equal(stale.structuredContent?.error?.sideEffect, 'none');
    assert.equal(persistence.value.memories[0].body, 'Canvas width is 720.');
});

test('delete removes active content and revisions while retaining a content-free operation tombstone', async () => {
    const persistence = new MemoryPersistence();
    const { memory } = await setup({ task: 'Keep the exact local workflow.', persistence });
    const created = await memory.call(`${MEMORY}remember`, {
        title: 'Local workflow', body: 'Import PNG, read UUID, then attach it to Canvas.', category: 'workflow',
        sources: [userSource('exact local workflow')],
    }, 'remember-workflow');
    const deleted = await memory.call(`${MEMORY}delete`, {
        memoryId: created.structuredContent.memoryId, expectedRevision: 1,
    }, 'delete-workflow');
    assert.equal(deleted.structuredContent?.outcome, 'deleted');
    assert.equal(persistence.value.memories.length, 0);
    assert.deepEqual(persistence.value.tombstones[0], {
        id: created.structuredContent.memoryId, lastRevision: 1,
        deletedAt: '2026-10-12T12:00:00.000Z', operationId: 'delete-workflow',
    });
    assert.equal(JSON.stringify(persistence.value).includes('Import PNG'), false);

    const recovered = await memory.call(`${MEMORY}operation_get`, { operationId: 'delete-workflow' }, 'recovery-call');
    assert.equal(recovered.structuredContent?.success, true);
    assert.equal(recovered.structuredContent?.outcome, 'deleted');
    assert.equal(recovered.structuredContent?.tombstone?.id, created.structuredContent.memoryId);
    const missing = await memory.call(`${MEMORY}operation_get`, { operationId: 'not-recorded-yet' }, 'recovery-call-2');
    assert.equal(missing.structuredContent?.outcome, 'no-effect');
});

test('a lost response after atomic commit is reconciled by the exact provider call ID', async () => {
    const persistence = new MemoryPersistence();
    const task = 'Remember the app is landscape.';
    const { memory } = await setup({ task, persistence });
    persistence.failAfterCommit = true;
    const interrupted = await memory.call(`${MEMORY}remember`, {
        title: 'Orientation', body: 'The app uses landscape orientation.', category: 'project-fact',
        sources: [userSource('app is landscape')],
    }, 'provider-call-memory-77');
    assert.equal(interrupted.structuredContent?.outcome, 'needs-review');
    assert.equal(interrupted.structuredContent?.operationId, 'provider-call-memory-77');

    const receipt = await memory.call(`${MEMORY}operation_get`, { operationId: 'provider-call-memory-77' }, 'recovery-call-77');
    assert.equal(receipt.structuredContent?.outcome, 'remembered');
    assert.equal(receipt.structuredContent?.memory?.body, 'The app uses landscape orientation.');
    assert.equal(persistence.value.memories.length, 1);
});

test('Agent locks to the exact memory operation receipt after an uncertain persistent write', async () => {
    const persistence = new MemoryPersistence();
    const task = 'Remember the game uses landscape orientation.';
    const { memory } = await setup({ task, persistence });
    persistence.failAfterCommit = true;
    const registry = new CreatorMemoryToolRegistry({ listTools: async () => [], callTool: async () => ({}) }, memory);
    const requests = [];
    const responses = [
        { role: 'assistant', content: null, toolCalls: [{
            id: 'memory-call-needs-review', name: `${MEMORY}remember`, arguments: {
                title: 'Orientation', body: 'The game uses landscape orientation.', category: 'project-fact',
                sources: [userSource('game uses landscape orientation')],
            },
        }] },
        { role: 'assistant', content: null, toolCalls: [{
            id: 'memory-reconcile-call', name: `${MEMORY}operation_get`, arguments: { operationId: 'memory-call-needs-review' },
        }] },
        { role: 'assistant', content: 'The saved memory is present and its exact write is reconciled.' },
    ];
    const kernel = new AgentKernel({
        provider: { complete: async (input) => {
            requests.push(input);
            return { message: responses.shift(), finishReason: 'stop' };
        } },
        tools: registry, policy: { approveWrite: async () => true }, systemPrompt: 'test',
    });
    const result = await kernel.run({ task, mode: 'Agent' });
    assert.equal(result.status, 'completed');
    assert.equal(result.receipts[0].result.structuredContent?.outcome, 'needs-review');
    assert.deepEqual(requests[1].tools.map((tool) => tool.name), [`${MEMORY}operation_get`]);
    assert.equal(result.receipts[1].result.structuredContent?.outcome, 'remembered');
    assert.equal(result.receipts[1].result.structuredContent?.operationId, 'memory-call-needs-review');
});

test('project keys prevent opening another project store and credentials are refused', async () => {
    const persistence = new MemoryPersistence();
    await assert.rejects(setup({ projectKey: PROJECT_B, persistence: {
        load: async () => ({ ...persistence.value, version: 1, projectKey: PROJECT_A, revision: 0, memories: [], operations: [], tombstones: [] }),
        save: persistence.save.bind(persistence),
    } }), /WRONG_PROJECT/);
    const { memory } = await setup({ task: 'Remember a key for testing.' });
    const result = await memory.call(`${MEMORY}remember`, {
        title: 'API credential', body: 'The API token is sk-abcdefghijklmnopqrstuvwxyz.', category: 'project-fact',
        sources: [userSource('key for testing')],
    }, 'secret-memory');
    assert.equal(result.structuredContent?.error?.code, 'MEMORY_SECRET_REJECTED');
});

test('persisted content containing credentials is rejected before recall', async () => {
    const persistence = new MemoryPersistence();
    const initial = await setup({ task: 'Remember a safe fact.', persistence });
    const created = await initial.memory.call(`${MEMORY}remember`, {
        title: 'Safe fact', body: 'A safe project fact.', category: 'project-fact',
        sources: [userSource('Remember a safe fact.')],
    }, 'safe-fact');
    assert.equal(created.structuredContent?.success, true);
    persistence.value.memories[0].body = 'Token sk-abcdefghijklmnopqrstuvwxyz';
    await assert.rejects(setup({ persistence }), /PROJECT_MEMORY_STORE_INVALID_RECORD/);
    persistence.value.memories[0].body = 'A safe project fact.';
    persistence.value.operations.push({ operationId: 'unexpected-extra', action: 'remember', memoryId: 'memory-1',
        outcome: 'remembered', revision: 1, timestamp: '2026-10-12T12:00:00.000Z',
        unexpected: 'sk-abcdefghijklmnopqrstuvwxyz' });
    await assert.rejects(setup({ persistence }), /PROJECT_MEMORY_STORE_INVALID_RECORD/);
});

test('Agent memory mutation goes through the same panel approval policy as other writes', async () => {
    const task = 'Remember that Canvas is 640 pixels wide.';
    const { memory, persistence } = await setup({ task });
    const emptyBase = { listTools: async () => [], callTool: async () => ({ structuredContent: { success: false } }) };
    const registry = new CreatorMemoryToolRegistry(emptyBase, memory);
    let approvals = 0;
    const deniedKernel = new AgentKernel({
        provider: { complete: async () => ({ message: { role: 'assistant', content: null, toolCalls: [{
            id: 'denied-memory-call', name: `${MEMORY}remember`, arguments: {
                title: 'Canvas width', body: 'Canvas is 640 pixels wide.', category: 'project-fact',
                sources: [userSource('Canvas is 640 pixels wide')],
            },
        }] }, finishReason: 'tool_calls' }) },
        tools: registry, policy: { approveWrite: async () => { approvals += 1; return false; } }, systemPrompt: 'test',
    });
    const denied = await deniedKernel.run({ task, mode: 'Agent' });
    assert.equal(denied.reason, 'write-not-approved');
    assert.equal(approvals, 1);
    assert.equal(persistence.value, null);

    const responses = [
        { role: 'assistant', content: null, toolCalls: [{
            id: 'approved-memory-call', name: `${MEMORY}remember`, arguments: {
                title: 'Canvas width', body: 'Canvas is 640 pixels wide.', category: 'project-fact',
                sources: [userSource('Canvas is 640 pixels wide')],
            },
        }] },
        { role: 'assistant', content: 'Saved the project memory with a source citation.' },
    ];
    const approvedKernel = new AgentKernel({
        provider: { complete: async () => ({ message: responses.shift(), finishReason: 'stop' }) },
        tools: registry, policy: { approveWrite: async () => true }, systemPrompt: 'test',
    });
    const approved = await approvedKernel.run({ task, mode: 'Agent' });
    assert.equal(approved.status, 'completed');
    assert.equal(approved.receipts[0].toolName, `${MEMORY}remember`);
    assert.equal(persistence.value.memories.length, 1);
});
