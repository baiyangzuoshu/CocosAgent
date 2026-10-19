import assert from 'node:assert/strict';
import test from 'node:test';
import { CreatorToolLoader } from '../dist/creator-tool-loader.js';
import { AgentKernel } from '../dist/agent-loop.js';
import { createCreatorAgentPolicy, creatorExplicitSkillQueryOnly, creatorRequestedSkillReads } from '../dist/creator-policy.js';
import { creatorPreflightForModel } from '../dist/creator-host-adapter.js';

const LOAD = 'cocos_2x_tools_load';
const COMMAND = 'cocos_2x_command_execute';
const tool = (name, access = 'read', role = 'task', inputSchema = { type: 'object' }) => ({ name, access, role, description: name, inputSchema });
const commands = ['scene.node.patch', 'scene.node.create', 'script.create', 'runtime.preview.start'];
const commandTool = tool(COMMAND, 'write', 'task', { type: 'object', $defs: { input: { type: 'object', additionalProperties: false } },
    oneOf: commands.map((command) => ({ type: 'object', properties: { command: { type: 'string', const: command }, input: { $ref: '#/$defs/input' } },
        required: ['command', 'input'], additionalProperties: false })) });
const catalog = [tool('cocos_2x_skills_list', 'read', 'setup'), tool('cocos_2x_skill_read', 'read', 'setup'),
    tool('cocos_2x_skill_reference_read', 'read', 'setup'), tool('cocos_2x_project_instructions_read'),
    tool('cocos_2x_scene_snapshot'), tool('cocos_2x_scene_node_inspect'), tool('cocos_2x_script_read'),
    tool('cocos_2x_content_build_execute', 'write'), tool('cocos_2x_project_tool_write', 'write'),
    tool('cocos_2x_operation_get', 'read', 'recovery'), commandTool];

function fixture(mode = 'Agent', seed = [], result = { structuredContent: { success: true } }) {
    const calls = [], events = [];
    const inner = { listTools: async () => catalog, callTool: async (input) => { calls.push(input); return result; } };
    const loader = new CreatorToolLoader(inner, seed, (event) => events.push(event), mode, catalog);
    const offer = (recovery = false) => loader.listTools().then((tools) => loader.filterTools(tools, recovery));
    const load = (args) => loader.callTool({ name: LOAD, arguments: args });
    return { loader, calls, events, offer, load };
}

test('initial projection is small; seeds and task-local tools survive without exposing every schema', async () => {
    const f = fixture('Agent', ['cocos_2x_script_read', COMMAND]);
    const full = [...await f.loader.listTools(), tool('agent_todo_write', 'read', 'todo'), tool('agent_tool_result_read', 'read', 'context'),
        tool('cocos_2x_task_get', 'read', 'task-system')];
    const projected = f.loader.filterTools(full);
    assert.ok(projected.some((item) => item.name === 'cocos_2x_script_read'));
    assert.ok(projected.some((item) => item.name === 'agent_todo_write'));
    assert.ok(projected.some((item) => item.name === 'agent_tool_result_read'));
    assert.ok(projected.some((item) => item.name === 'cocos_2x_task_get'));
    assert.ok(!projected.some((item) => item.name === COMMAND));
    assert.ok(!projected.some((item) => item.name === 'cocos_2x_content_build_execute'));
    assert.equal((await f.loader.callTool({ name: 'cocos_2x_scene_snapshot', arguments: {} })).structuredContent.error.code, 'TOOL_NOT_LOADED');
    assert.equal(f.calls.length, 0);
});

test('explicit loading narrows exact original command branches and cannot dispatch an unloaded command', async () => {
    const before = JSON.stringify(catalog);
    const f = fixture(); await f.offer();
    assert.equal((await f.load({ commands: ['script.create'] })).structuredContent.success, true);
    assert.equal((await f.loader.callTool({ name: COMMAND, arguments: { command: 'script.create' } })).structuredContent.error.code, 'TOOL_NOT_LOADED',
        'loading takes effect on the next model projection');
    const projected = await f.offer(), command = projected.find((item) => item.name === COMMAND);
    assert.deepEqual(command.inputSchema.oneOf, [commandTool.inputSchema.oneOf[2]]);
    assert.deepEqual(command.inputSchema.$defs, commandTool.inputSchema.$defs);
    assert.equal((await f.loader.callTool({ name: COMMAND, arguments: { command: 'scene.node.patch' } })).structuredContent.error.code, 'COMMAND_NOT_LOADED');
    await f.loader.callTool({ name: COMMAND, arguments: { command: 'script.create', input: {} } });
    assert.equal(f.calls.length, 1);
    assert.equal(JSON.stringify(catalog), before, 'the authoritative schemas are unchanged');
});

test('metadata discovery never returns the complete schema catalog or calls Creator', async () => {
    const f = fixture(); await f.offer();
    const result = await f.load({ list: true });
    assert.deepEqual(result.structuredContent.data.commands, commands);
    assert.ok(result.structuredContent.data.tools.some((item) => item.name === COMMAND && item.access === 'write'));
    assert.ok(result.structuredContent.data.tools.every((item) => Object.keys(item).sort().join(',') === 'access,name'));
    assert.equal(JSON.stringify(result).includes('inputSchema'), false);
    assert.equal((await f.offer()).some((item) => item.name === COMMAND), false);
    assert.equal(f.calls.length, 0);
});

test('unknown names and mixed invalid selections reject atomically; a command tool needs a command selection', async () => {
    const f = fixture(); await f.offer();
    for (const args of [{ groups: ['scene', '__proto__'] }, { toolNames: ['cocos_2x_script_read', 'unknown'] },
        { commands: ['script.create', 'unknown'] }]) {
        assert.equal((await f.load(args)).structuredContent.error.code, 'TOOL_LOAD_NOT_IN_CATALOG');
    }
    assert.equal((await f.load({ toolNames: [COMMAND] })).structuredContent.error.code, 'COMMAND_SELECTION_REQUIRED');
    const names = (await f.offer()).map((item) => item.name);
    assert.ok(!names.includes('cocos_2x_script_read') && !names.includes(COMMAND));
});

test('local loader enforces its object, array, limit and additional-property schema', async () => {
    const f = fixture(); await f.offer();
    for (const args of [null, [], { groups: null }, { toolNames: null }, { commands: null }, { groups: 'scene' },
        { groups: ['scene', 'scene'] }, { list: 'true' }, { projectRoot: '/untrusted' }, { toolNames: Array(33).fill('x') },
        { commands: [1] }]) {
        const result = await f.load(args);
        assert.equal(result.structuredContent.error.code, 'TOOL_LOAD_INPUT_INVALID', JSON.stringify(args));
    }
    assert.equal(f.calls.length, 0);
});

test('a successful skill read enables its group in the next response without an extra discovery call', async () => {
    const original = { structuredContent: { success: true, skillName: 'cocos2-script-development', sha256: 'a'.repeat(64), content: 'verified skill body' } };
    const f = fixture('Agent', [], original); await f.offer();
    const result = await f.loader.callTool({ name: 'cocos_2x_skill_read', arguments: { name: 'cocos2-script-development' } });
    assert.strictEqual(result, original);
    const tools = await f.offer();
    assert.ok(tools.some((item) => item.name === 'cocos_2x_script_read'));
    assert.deepEqual(tools.find((item) => item.name === COMMAND).inputSchema.oneOf.map((branch) => branch.properties.command.const),
        ['scene.node.create', 'script.create']);
    assert.equal(f.calls.length, 1);
    assert.equal(f.events[0].source, 'verified-skill');
});

test('failed and unknown skill reads cannot activate a known task group', async () => {
    for (const result of [{ isError: true, structuredContent: { success: false, skillName: 'cocos2-script-development' } },
        { structuredContent: { success: true, skillName: 'new-unmapped-topic' } }]) {
        const f = fixture('Agent', [], result); await f.offer();
        await f.loader.callTool({ name: 'cocos_2x_skill_read', arguments: {} });
        assert.ok(!(await f.offer()).some((item) => item.name === 'cocos_2x_script_read'));
    }
});

for (const mode of ['Ask', 'Plan']) test(`${mode} remains read-only even when passed a complete writer catalog`, async () => {
    const f = fixture(mode); await f.offer();
    const result = await f.load({ groups: ['script', 'build'] });
    const projected = await f.offer();
    assert.ok(projected.every((item) => item.access === 'read'));
    assert.equal((await f.loader.callTool({ name: COMMAND, arguments: { command: 'script.create' } })).structuredContent.error.code, 'TOOL_NOT_LOADED');
    if (mode === 'Plan') {
        const schemas = result.structuredContent.data.planningToolSchemas;
        assert.ok(schemas.some((item) => item.name === 'cocos_2x_content_build_execute'));
        assert.equal(schemas.find((item) => item.name === COMMAND).inputSchema.oneOf.length, 2);
    }
    assert.equal(f.calls.length, 0);
});

test('recovery projection bypasses task selection while suppressing discovery and unrelated tools', async () => {
    const f = fixture();
    const projected = await f.offer(true);
    assert.deepEqual(projected.map((item) => item.name), ['cocos_2x_operation_get']);
    await f.loader.callTool({ name: 'cocos_2x_operation_get', arguments: { operationId: 'original' } });
    assert.equal(f.calls.length, 1);
    assert.equal((await f.load({ groups: ['script'] })).isError, true);
    await f.offer(false);
    assert.equal((await f.loader.callTool({ name: 'cocos_2x_operation_get', arguments: {} })).structuredContent.error.code, 'TOOL_NOT_LOADED');
});

test('loaded groups do not leak into another run', async () => {
    const first = fixture(); await first.offer(); await first.load({ groups: ['scene'] });
    assert.ok((await first.offer()).some((item) => item.name === 'cocos_2x_scene_snapshot'));
    assert.ok(!(await fixture().offer()).some((item) => item.name === 'cocos_2x_scene_snapshot'));
});

test('a prepared catalog removes redundant discovery from the default offer but allows explicit refresh', async () => {
    const calls = [];
    const loader = new CreatorToolLoader({ listTools: async () => catalog, callTool: async (input) => {
        calls.push(input); return { structuredContent: { success: true } };
    } }, [], undefined, 'Agent', catalog, true);
    let offered = loader.filterTools(await loader.listTools());
    assert.ok(!offered.some((tool) => tool.name === 'cocos_2x_skills_list'));
    assert.ok(offered.some((tool) => tool.name === 'cocos_2x_skill_read'));
    await loader.callTool({ name: LOAD, arguments: { toolNames: ['cocos_2x_skills_list'] } });
    offered = loader.filterTools(await loader.listTools());
    assert.ok(offered.some((tool) => tool.name === 'cocos_2x_skills_list'));
    await loader.callTool({ name: 'cocos_2x_skills_list', arguments: {} });
    assert.equal(calls.length, 1);
});

test('a genuine Host catalog receipt skips the redundant model catalog call but cannot skip the task skill/reference gate', async () => {
    const catalogReceipt = { toolName: 'cocos_2x_skills_list', callId: 'host-catalog', access: 'read', role: 'setup',
        result: { structuredContent: { success: true, data: { skills: [{ name: 'cocos2-script-development' }] } } } };
    const policy = createCreatorAgentPolicy({ mode: 'Agent', baseInstructions: '', skillReceipts: [catalogReceipt], approveWrite: async () => true }).createRunPolicy({});
    const context = { tool: tool('cocos_2x_script_read'), arguments: {}, receipts: [], availableTools: catalog };
    assert.match(policy.beforeTool(context).message, /best matching non-base skill/);
    context.receipts.push({ ...catalogReceipt, toolName: 'cocos_2x_skill_read', result: { structuredContent: {
        success: true, skillName: 'cocos2-script-development', references: [{ id: 'contract.md' }],
    } } });
    assert.match(policy.beforeTool(context).message, /listed command-contract reference/);
    context.receipts.push({ ...catalogReceipt, toolName: 'cocos_2x_skill_reference_read', result: { structuredContent: {
        success: true, skillName: 'cocos2-script-development', referenceId: 'contract.md',
    } } });
    assert.equal(policy.beforeTool(context).action, 'allow');
});

test('request profiles describe the exact narrowed tools and contain counts, never prompt data', async () => {
    const f = fixture('Ask', ['cocos_2x_script_read']);
    const events = [];
    let sent;
    const kernel = new AgentKernel({ tools: f.loader, systemPrompt: '系统提示',
        provider: { complete: async (input) => { sent = input; return { message: { role: 'assistant', content: 'Answer' }, finishReason: 'stop' }; } },
        policy: { approveWrite: async () => false, createRunPolicy: () => ({ filterTools: (tools) => f.loader.filterTools(tools) }) },
        hooks: { onEvent: (event) => events.push(event) } });
    await kernel.run({ mode: 'Ask', task: 'unlogged request body' });
    const event = events.find((item) => item.type === 'model.requested');
    assert.equal(event.inputProfile.toolCount, sent.tools.length);
    assert.equal(event.inputProfile.toolsJsonBytes, Buffer.byteLength(JSON.stringify(sent.tools.map((item) => ({ type: 'function',
        function: { name: item.name, description: item.description, parameters: item.inputSchema } })))));
    assert.equal(event.inputProfile.messagesJsonBytes, Buffer.byteLength(JSON.stringify(sent.messages)));
    assert.equal(event.inputProfile.commandSchemaCount, 0);
    assert.equal(event.attempt, 1);
    assert.equal(JSON.stringify(event).includes('unlogged request body'), false);
});

test('preflight projection defers inline schemas while preserving capability gates, identity and original receipts', () => {
    const original = { structuredContent: { success: true, data: {
        instance: { projectRoot: '/exact/project', creatorVersion: '2.4.15', contractCompatibility: { status: 'matched' },
            expectedRuntime: { mcp: { sourceFingerprint: 'exact-fingerprint' } } },
        commands: [{ id: 'script.create', access: 'write', status: 'available', reason: null,
            inputSchema: 'catalog.schema.json#/$defs/scriptCreateInput2x', input: { required: ['source'] }, preconditions: ['assetDbReady'] }],
    } } };
    const saved = JSON.stringify(original);
    const model = creatorPreflightForModel('cocos_2x_capabilities_list', original);
    assert.equal(Object.hasOwn(model.data.commands[0], 'input'), false);
    assert.deepEqual(model.data.instance, original.structuredContent.data.instance);
    for (const key of ['id', 'access', 'status', 'reason', 'inputSchema', 'preconditions']) {
        assert.deepEqual(model.data.commands[0][key], original.structuredContent.data.commands[0][key]);
    }
    assert.match(model.data.commandSchemas, /deferred/);
    assert.equal(JSON.stringify(original), saved);
    assert.strictEqual(creatorPreflightForModel('cocos_2x_instances_list', original), original.structuredContent);
    const failed = { isError: true, structuredContent: { success: false, error: { code: 'CONTRACT_MISMATCH' } } };
    assert.strictEqual(creatorPreflightForModel('cocos_2x_capabilities_list', failed), failed.structuredContent);
});

test('explicit skill read requirements distinguish current reads from questions and prohibitions', () => {
    const index = { skills: [{ name: 'cocos2-script-development' }, { name: 'cocos-agent' }] };
    assert.deepEqual(creatorRequestedSkillReads('读取当前技能目录，并读取 cocos2-script-development 的完整技能正文；不读取项目资产。', index), ['cocos2-script-development']);
    assert.deepEqual(creatorRequestedSkillReads('Read cocos-agent and cocos2-script-development.', index).sort(), ['cocos-agent', 'cocos2-script-development'].sort());
    for (const task of ['不要读取 cocos2-script-development', '不再加载 cocos-agent', 'Do not read cocos-agent',
        'Never load cocos-agent', '解释如何读取 cocos-agent', 'Explain how to read cocos-agent', 'cocos-agent 是什么？', 'Read cocos-agent-unknown']) {
        assert.deepEqual(creatorRequestedSkillReads(task, index), [], task);
    }
});

test('an explicitly skill-query-only task does not seed unrelated Creator tool groups', () => {
    const requested = ['cocos2-script-development'];
    assert.equal(creatorExplicitSkillQueryOnly('只执行这两项只读技能查询，不读取或修改项目资产。', requested), true);
    assert.equal(creatorExplicitSkillQueryOnly('Only perform these two read-only skill queries.', requested), true);
    assert.equal(creatorExplicitSkillQueryOnly('读取技能后检查当前脚本。', requested), false);
    assert.equal(creatorExplicitSkillQueryOnly('只执行这两项只读技能查询。', []), false);
});

test('an explicit body read cannot complete from historical prose, metadata, a failed read or another skill', () => {
    const policy = createCreatorAgentPolicy({ mode: 'Ask', baseInstructions: '', requiredSkillReads: ['cocos2-script-development'], approveWrite: async () => false }).createRunPolicy({});
    const context = { message: { role: 'assistant', content: 'Already read in the preceding turn.' }, finishReason: 'stop', receipts: [], availableTools: catalog };
    assert.equal(policy.onAssistantStop(context).action, 'continue');
    context.receipts.push({ toolName: 'cocos_2x_skill_read', result: { isError: true, structuredContent: { success: false, skillName: 'cocos2-script-development' } } });
    context.receipts.push({ toolName: 'cocos_2x_skill_read', result: { structuredContent: { success: true, skillName: 'cocos-agent' } } });
    assert.equal(policy.onAssistantStop(context).action, 'continue');
    const stop = policy.onAssistantStop(context);
    assert.equal(stop.reason, 'requested-skill-body-not-read');
    assert.equal(stop.finalText, null);
});

test('a current successful explicit skill read satisfies the gate; recovery locks retain precedence', () => {
    const policy = createCreatorAgentPolicy({ mode: 'Ask', baseInstructions: '', requiredSkillReads: ['cocos2-script-development'], approveWrite: async () => false }).createRunPolicy({});
    const context = { message: { role: 'assistant', content: 'Read complete.' }, finishReason: 'stop', receipts: [{ toolName: 'cocos_2x_skill_read',
        result: { structuredContent: { success: true, skillName: 'cocos2-script-development' } } }], availableTools: catalog };
    assert.equal(policy.onAssistantStop(context), undefined);
    const locked = createCreatorAgentPolicy({ mode: 'Agent', baseInstructions: '', requiredSkillReads: ['cocos2-script-development'],
        pendingRecovery: { field: 'operationId', value: 'original', toolName: COMMAND }, approveWrite: async () => false }).createRunPolicy({});
    assert.notEqual(locked.onAssistantStop({ ...context, receipts: [] })?.reason, 'requested-skill-body-not-read');
    assert.equal(locked.recoveryRequired(), true);
});
