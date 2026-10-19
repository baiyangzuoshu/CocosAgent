import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer } from './mcp-server.mjs';
import { loadContext, invokeSkillTool, REQUIRED_COMMAND } from './deepseek-agent.mjs';
import { runCreatorAgent, runCreatorReadOnly } from '../../cocos-agent-runtime/dist/creator-host-adapter.js';
import { compactResult } from './assistant-host.mjs';
import { CreatorToolLoader } from '../../cocos-agent-runtime/dist/creator-tool-loader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const skillFiles = [path.join(root, 'plugins/cocos-agent-2x/skills/cocos-agent/SKILL.md')];
const skillAdapter = { loadContext, invokeSkillTool, REQUIRED_COMMAND };
const response = (message, finish_reason = 'stop') => new Response(JSON.stringify({ choices: [{ message, finish_reason }],
    usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } }), { status: 200 });
const call = (id, name, args) => response({ tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }, 'tool_calls');

async function fixture(run) {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-native-lazy-'));
    const projectRoot = fs.realpathSync(parent), tracePath = path.join(parent, 'trace.jsonl');
    const instance = { projectRoot, creatorVersion: '2.4.15', state: 'ready', activeScene: 'TestScene' };
    const hostCalls = [], events = [], traceEvents = [];
    const operationId = '636822a9-7e9a-4a5d-81a6-6aab46932ce0';
    const server = createServer([projectRoot], { invokeAgent: async (request) => {
        hostCalls.push(request);
        const { method, params } = request;
        let result;
        if (method === 'instances.list') result = { success: true, data: [instance] };
        else if (method === 'capabilities.list') result = { success: true, data: { instance,
            commands: ['scene.snapshot', 'scene.node.inspect', 'script.read', 'script.create', 'scene.node.create'].map((id) => ({ id, status: 'available' })) } };
        else if (method === 'command.execute' && params.command === 'scene.snapshot') result = { success: true, outcome: 'completed',
            command: 'scene.snapshot', data: { sceneName: 'TestScene', nodeCount: 3 } };
        else if (method === 'operation.get') result = { success: true, outcome: 'completed', operationId,
            phases: { editor: 'passed', disk: 'passed' } };
        else throw new Error(`Unexpected project operation: ${method}`);
        return { id: request.id, result };
    } });
    const client = new Client({ name: 'native-lazy-test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(b); await client.connect(a);
    const options = { client, projectRoot, tracePath, skillFiles, skillAdapter, apiKey: 'fake-test-key', model: 'deepseek-flash',
        history: [], projectContext: null, formatProjectContext: () => null,
        writeEvent: (_path, event) => traceEvents.push(event), onEvent: (event) => events.push(event) };
    try { return await run({ client, projectRoot, tracePath, options, hostCalls, events, traceEvents, operationId }); }
    finally { await client.close(); await server.close(); fs.rmSync(parent, { recursive: true, force: true }); }
}

test('native startup injects metadata only; base hash verification is distinct from reading skill bodies', async () => fixture(async (f) => {
    const reads = [];
    const client = { listTools: () => f.client.listTools(), readResource: (input) => { reads.push(input.uri); return f.client.readResource(input); } };
    const lazy = await loadContext(client, skillFiles, f.tracePath, '', 'Plan', { promptProfile: 'native-lazy' });
    const full = await loadContext(f.client, skillFiles, f.tracePath, '', 'Plan');
    assert.deepEqual(reads, ['cocos://2x/skills/index'], 'startup does not fetch any topic/reference body');
    assert.ok(Buffer.byteLength(lazy.messages[0].content) < Buffer.byteLength(full.messages[0].content) / 2);
    assert.ok(!lazy.messages[0].content.includes(fs.readFileSync(skillFiles[0], 'utf8')));
    assert.match(lazy.messages[0].content, /A missing schema means the tool is unloaded, not nonexistent/);
    assert.match(lazy.messages[0].content, /obtain this run's actual tool catalog with cocos_2x_tools_load list=true/);
    assert.match(lazy.messages[0].content, /Host preparation receipt for this run: cocos_2x_skills_list succeeded/);
    assert.ok(lazy.toolsByName.has('cocos_2x_command_execute'), 'Plan can name registered writers without executing them');
    const skills = lazy.skillCatalogResult.structuredContent.data.skills;
    assert.ok(skills.every((entry) => !Object.hasOwn(entry, 'references')));
    const events = fs.readFileSync(f.tracePath, 'utf8').trim().split('\n').map(JSON.parse);
    assert.ok(events.some((event) => event.event === 'skill.verified' && event.source === 'startup-hash-check'));
    const skill = await invokeSkillTool(f.client, lazy.skillIndex, 'cocos_2x_skill_read', { name: 'cocos2-script-development' }, f.tracePath, '');
    assert.ok(skill.structuredContent.references.length > 0, 'reference catalog appears only when its skill is requested');
    assert.equal(f.hostCalls.length, 0);
}));

test('compact skill metadata distinguishes omitted references from a declared empty reference list', () => {
    const result = compactResult({ structuredContent: { success: true, data: { skills: [
        { name: 'metadata-only', sha256: 'a'.repeat(64) },
        { name: 'no-references', references: [] },
        { name: 'with-references', references: [{ id: 'contract.md' }] },
    ] } } });
    assert.equal(result.skills[0].referenceIds, null);
    assert.deepEqual(result.skills[1].referenceIds, []);
    assert.deepEqual(result.skills[2].referenceIds, ['contract.md']);
});

test('real MCP discovery metadata fits one ordinary receipt without archive pagination', async () => fixture(async (f) => {
    const context = await loadContext(f.client, skillFiles, f.tracePath, '', 'Ask', { promptProfile: 'native-lazy' });
    const tools = [...context.toolsByName.values()].map((tool) => ({ name: tool.name, description: tool.description,
        inputSchema: tool.inputSchema, access: tool.annotations?.readOnlyHint === true ? 'read' : 'write', role: 'task' }));
    const loader = new CreatorToolLoader({ listTools: async () => tools, callTool: async () => { throw new Error('no project calls'); } }, [], undefined, 'Ask', tools);
    loader.filterTools(await loader.listTools());
    const result = await loader.callTool({ name: 'cocos_2x_tools_load', arguments: { list: true } });
    assert.equal(result.structuredContent.success, true);
    assert.ok(result.structuredContent.data.tools.some((tool) => tool.name === 'cocos_2x_script_create_reconcile' && tool.access === 'write'));
    assert.ok(JSON.stringify(result).length < 12000, 'metadata must not trigger the default 12000-character archive threshold');
}));

test('lazy skill and reference readers reject tampered content and undeclared references', async () => fixture(async (f) => {
    const context = await loadContext(f.client, skillFiles, f.tracePath, '', 'Ask', { promptProfile: 'native-lazy' });
    const skillName = 'cocos2-script-development', skill = context.skillIndex.skills.find((entry) => entry.name === skillName);
    const tamper = { readResource: async (input) => {
        const result = await f.client.readResource(input);
        return { ...result, contents: result.contents.map((item) => typeof item.text === 'string' ? { ...item, text: item.text + '\ntampered' } : item) };
    } };
    const body = await invokeSkillTool(tamper, context.skillIndex, 'cocos_2x_skill_read', { name: skillName }, f.tracePath, '');
    assert.equal(body.structuredContent.error.code, 'SKILL_RESOURCE_HASH_MISMATCH');
    const reference = await invokeSkillTool(tamper, context.skillIndex, 'cocos_2x_skill_reference_read', {
        skillName, referenceId: skill.references[0].id,
    }, f.tracePath, '');
    assert.equal(reference.structuredContent.error.code, 'SKILL_REFERENCE_HASH_MISMATCH');
    const undeclared = await invokeSkillTool(f.client, context.skillIndex, 'cocos_2x_skill_reference_read', {
        skillName, referenceId: 'unknown-reference.md',
    }, f.tracePath, '');
    assert.equal(undeclared.structuredContent.error.code, 'SKILL_REFERENCE_NOT_DECLARED');
    assert.equal(f.hostCalls.length, 0);
}));

test('native Ask uses the Host catalog, reads a real skill/reference, then invokes a task-scoped Creator read', async () => fixture(async (f) => {
    const originalFetch = globalThis.fetch;
    let rounds = 0;
    globalThis.fetch = async (_url, request) => {
        const body = JSON.parse(request.body); rounds++;
        const names = body.tools.map((tool) => tool.function.name);
        assert.ok(!names.includes('cocos_2x_command_execute'));
        if (rounds === 1) {
            assert.ok(!names.includes('cocos_2x_scene_snapshot'));
            return call('skill', 'cocos_2x_skill_read', { name: 'cocos2-scene-composition' });
        }
        assert.ok(names.includes('cocos_2x_scene_snapshot'));
        if (rounds === 2) return call('reference', 'cocos_2x_skill_reference_read', {
            skillName: 'cocos2-scene-composition', referenceId: 'agent-foundation/scene-composition-0.1.md',
        });
        if (rounds === 3) return call('snapshot', 'cocos_2x_scene_snapshot', { projectRoot: f.projectRoot, input: {} });
        assert.match(body.messages.at(-1).content, /nodeCount/);
        return response({ content: '已读取场景，包含 3 个节点。' });
    };
    try {
        const result = await runCreatorReadOnly({ ...f.options, mode: 'Ask', task: '只读查看场景组成' });
        assert.equal(result.status, 'completed', result.reason);
        assert.equal(rounds, 4, 'no extra model round to list the already supplied skill catalog');
        assert.equal(result.receipts.filter((receipt) => receipt.name === 'cocos_2x_skills_list').length, 1);
        assert.deepEqual(f.hostCalls.map((request) => request.method), ['instances.list', 'capabilities.list', 'command.execute']);
        assert.equal(result.modelUsageRequests.length, 4);
        const profiles = f.traceEvents.filter((event) => event.event === 'model.request');
        assert.equal(profiles.length, 4);
        assert.equal(profiles[0].inputProfile.toolCount, 6);
        assert.ok(profiles[1].inputProfile.toolCount > 6);
        assert.ok(f.traceEvents.some((event) => event.event === 'tools.loaded' && event.source === 'verified-skill'));
    } finally { globalThis.fetch = originalFetch; }
}));

test('an explicit skill-only query is Host-verified without loading unrelated Creator tool schemas', async () => fixture(async (f) => {
    const originalFetch = globalThis.fetch;
    let rounds = 0;
    globalThis.fetch = async (_url, request) => {
        const body = JSON.parse(request.body); rounds++;
        assert.equal(rounds, 1, 'Host should satisfy the explicit read without a model tool-call round');
        const names = body.tools.map((tool) => tool.function.name);
        assert.equal(body.tools.length, 6, 'skill-only tasks retain only the base skill tools and loader');
        assert.ok(!names.includes('cocos_2x_script_read'), 'project script tools are unnecessary for a skill-only query');
        assert.ok(body.messages.some((message) => typeof message.content === 'string'
            && message.content.includes('"skillName":"cocos2-script-development"')
            && message.content.includes('"content":')));
        return response({ content: '已读取当前技能目录和脚本开发技能正文。' });
    };
    try {
        const task = '读取当前已安装的 CocosAgent 技能目录，并读取 cocos2-script-development 的完整技能正文；只执行这两项只读技能查询，不读取或修改项目资产。';
        const result = await runCreatorReadOnly({ ...f.options, mode: 'Ask', task });
        assert.equal(result.status, 'completed', result.reason);
        assert.equal(rounds, 1);
        const skill = result.receipts.find((receipt) => receipt.name === 'cocos_2x_skill_read');
        assert.equal(skill?.structuredContent?.success, true);
        assert.equal(skill?.structuredContent?.skillName, 'cocos2-script-development');
        assert.equal(skill?.structuredContent?.byteLength, Buffer.byteLength(skill.structuredContent.content, 'utf8'));
        const trace = fs.readFileSync(f.tracePath, 'utf8').trim().split('\n').map(JSON.parse);
        assert.ok(trace.some((event) => event.event === 'skill.read'
            && event.source === 'host-requested' && event.skillName === 'cocos2-script-development'));
        assert.ok(!f.traceEvents.some((event) => event.event === 'tools.loaded'
            && event.source === 'host-verified-skill'), 'skill evidence is retained without preloading project tools');
        assert.ok(f.events.some((event) => event.type === 'tool.finished'
            && event.toolName === 'cocos_2x_skill_read' && event.result?.structuredContent?.success === true));
        assert.deepEqual(f.hostCalls.map((call) => call.method), ['instances.list', 'capabilities.list']);
    } finally { globalThis.fetch = originalFetch; }
}));

test('native Plan receives task-specific write schemas as research data and never executable write tools', async () => fixture(async (f) => {
    const originalFetch = globalThis.fetch;
    let rounds = 0;
    globalThis.fetch = async (_url, request) => {
        const body = JSON.parse(request.body); rounds++;
        assert.ok(!body.tools.some((tool) => tool.function.name === 'cocos_2x_command_execute'));
        if (rounds === 1) return call('skill', 'cocos_2x_skill_read', { name: 'cocos2-script-development' });
        if (rounds === 2) {
            const read = JSON.parse(body.messages.at(-1).content).structuredContent;
            const command = read.planningToolSchemas.find((tool) => tool.name === 'cocos_2x_command_execute');
            assert.deepEqual(command.inputSchema.oneOf.map((branch) => branch.properties.command.const), ['scene.node.create', 'script.create']);
            return call('reference', 'cocos_2x_skill_reference_read', { skillName: read.skillName, referenceId: read.references[0].id });
        }
        return response({ content: JSON.stringify({ version: 2, title: '检查脚本', summary: '读取脚本身份后决定下一步。', steps: [{
            title: '读取脚本', description: '读取经确认的脚本。', preconditions: ['确认脚本相对路径。'],
            requiredTools: ['cocos_2x_script_read'], validation: '检查 UUID 和哈希。', recovery: '只读失败后停止。', acceptance: { kind: 'read' },
        }] }) });
    };
    try {
        const result = await runCreatorReadOnly({ ...f.options, mode: 'Plan', task: '制定单脚本只读检查计划' });
        assert.equal(result.status, 'completed', result.reason);
        assert.equal(rounds, 3);
        assert.ok(result.availableToolNames.includes('cocos_2x_command_execute'));
        assert.deepEqual(f.hostCalls.map((request) => request.method), ['instances.list', 'capabilities.list']);
    } finally { globalThis.fetch = originalFetch; }
}));

test('native recovery bypasses ordinary lazy selection and task interpretation without permitting unrelated tools', async () => fixture(async (f) => {
    const originalFetch = globalThis.fetch;
    const store = { revision: 0, pending: { field: 'operationId', value: f.operationId, toolName: 'cocos_2x_command_execute', command: 'scene.node.patch' },
        async load() { return { revision: this.revision, pending: this.pending }; },
        async save(pending, revision) { assert.equal(revision, this.revision); this.revision++; this.pending = pending; } };
    let rounds = 0;
    globalThis.fetch = async (_url, request) => {
        const body = JSON.parse(request.body); rounds++;
        assert.ok(!body.messages[0].content.startsWith('COCOS_TASK_INTENT_V1'));
        if (rounds === 1) {
            const names = body.tools.map((tool) => tool.function.name);
            assert.ok(names.includes('cocos_2x_operation_get'));
            assert.ok(!names.includes('cocos_2x_tools_load') && !names.includes('cocos_2x_scene_snapshot'));
            return call('recover', 'cocos_2x_operation_get', { projectRoot: f.projectRoot, operationId: f.operationId });
        }
        return response({ content: '已核对原操作账本。' });
    };
    try {
        await runCreatorAgent({ ...f.options, mode: 'Agent', task: '核对原操作账本', recoveryStore: store });
        assert.equal(store.pending, null);
        assert.deepEqual(f.hostCalls.map((request) => request.method), ['instances.list', 'capabilities.list', 'operation.get']);
    } finally { globalThis.fetch = originalFetch; }
}));
