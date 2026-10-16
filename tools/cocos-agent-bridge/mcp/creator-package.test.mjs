import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { buildCreatorExtensionBundle, restoreCreatorExtension, upgradeCreatorExtension } from '../package-creator-extension.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = path.resolve(TEST_DIR, '../../..');

function waitForStart(child, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
        let buffered = '';
        let stderr = '';
        let settled = false;
        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) reject(error);
            else resolve(value);
        };
        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            finish(new Error(`Creator Assistant did not start in time. stderr: ${stderr}`));
        }, timeoutMs);
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
            if (stderr.includes('listen EPERM: operation not permitted 127.0.0.1'))
                finish(null, { status: 'loopback-restricted' });
        });
        child.stdout.on('data', (chunk) => {
            buffered += String(chunk);
            const newline = buffered.indexOf('\n');
            if (newline < 0) return;
            const line = buffered.slice(0, newline).trim();
            if (!line.startsWith('READY ')) return;
            finish(null, { status: 'ready', payload: JSON.parse(line.slice(6)) });
        });
        child.once('error', (error) => finish(error));
        child.once('close', (code, signal) => {
            finish(new Error(`Creator Assistant exited before READY (${code}:${signal}). stderr: ${stderr}`));
        });
    });
}

test('Creator bundle runs its MCP server outside the research repository without Codex metadata', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-package-'));
    const output = path.join(temporary, 'creator-extension-package');
    const conventionText = '# Fixture conventions\nprivate-convention-marker: keep UI prefab paths stable.\n';
    fs.writeFileSync(path.join(temporary, 'AGENTS.md'), conventionText);
    let client;
    try {
        const built = buildCreatorExtensionBundle({ sourceRoot: SOURCE_ROOT, outputDirectory: output });
        const runtimeRoot = path.join(output, 'assistant-runtime');
        const pluginRoot = path.join(runtimeRoot, 'plugins/cocos-agent-2x');
        const serverPath = path.join(runtimeRoot, 'tools/cocos-agent-bridge/mcp/mcp-server.mjs');
        const assistantStateStorePath = path.join(runtimeRoot, 'tools/cocos-agent-bridge/mcp/assistant-state-store.mjs');
        const runtimeObserverPath = path.join(runtimeRoot, 'tools/cocos-agent-bridge/runtime-observation.js');
        assert.equal(built.runtimeDirectory, runtimeRoot);
        assert.ok(fs.existsSync(serverPath));
        assert.ok(fs.existsSync(runtimeObserverPath));
        assert.ok(fs.existsSync(assistantStateStorePath), 'Creator package contains durable Assistant state support');
        assert.ok(fs.existsSync(path.join(runtimeRoot, 'tools/cocos-agent-bridge/mcp/assistant-recovery-store.mjs')));
        assert.ok(fs.existsSync(path.join(runtimeRoot, 'tools/cocos-agent-runtime/dist/creator-recovery.js')));
        assert.ok(fs.existsSync(path.join(runtimeRoot, 'tools/cocos-agent-runtime/dist/creator-targets.js')));
        assert.ok(fs.existsSync(path.join(runtimeRoot, 'tools/cocos-agent-runtime/dist/creator-task-intent.js')));
        assert.ok(fs.existsSync(path.join(runtimeRoot, 'tools/cocos-agent-bridge/mcp/node_modules/zod/package.json')));
        assert.ok(fs.existsSync(path.join(output, 'vendor/ws/index.js')));
        const bundledWebSocket = createRequire(import.meta.url)(path.join(output, 'vendor/ws'));
        assert.equal(typeof bundledWebSocket.Server, 'function');
        assert.equal(fs.existsSync(path.join(pluginRoot, '.codex-plugin')), false);
        assert.equal(fs.existsSync(path.join(pluginRoot, '.mcp.json')), false);
        assert.equal(fs.existsSync(path.join(pluginRoot, 'scripts/configure-local-plugin.mjs')), false);
        assert.equal(fs.existsSync(path.join(runtimeRoot, 'docs/agent-foundation/probes/cocos-content-stress-2.4-live.mjs')), true);
        assert.equal(fs.readFileSync(path.join(output, 'main.js'), 'utf8').includes('../../../tools/cocos-agent-bridge'), false);

        const transport = new StdioClientTransport({
            command: process.execPath,
            args: [serverPath, '--project', temporary],
            cwd: temporary,
            stderr: 'pipe',
        });
        client = new Client({ name: 'creator-package-test', version: '1.0.0' });
        await client.connect(transport);
        const { tools } = await client.listTools();
        assert.ok(tools.some((tool) => tool.name === 'cocos_2x_scene_snapshot'));
        assert.ok(tools.some((tool) => tool.name === 'cocos_2x_runtime_observe'));
        const instructionsTool = tools.find((tool) => tool.name === 'cocos_2x_project_instructions_read');
        assert.equal(instructionsTool.annotations.readOnlyHint, true);
        const registeredProjectRoot = fs.realpathSync(temporary);
        const readInstructions = await client.callTool({ name: instructionsTool.name, arguments: { projectRoot: registeredProjectRoot } });
        const instructions = readInstructions.structuredContent || (() => {
            assert.equal(readInstructions.isError, false, readInstructions.content?.[0]?.text || 'Project instructions read failed.');
            return JSON.parse(readInstructions.content[0].text);
        })();
        assert.equal(instructions.content, conventionText);
        assert.equal(instructions.projectRoot, registeredProjectRoot);
        const { resources } = await client.listResources();
        assert.ok(resources.some((resource) => resource.uri === 'cocos://2x/skills/index'));
        const index = JSON.parse((await client.readResource({ uri: 'cocos://2x/skills/index' })).contents[0].text);
        assert.equal(index.agentPackage.name, 'cocos-agent-2x');
        assert.equal(index.skills.length, 14);
        const baseSkill = index.skills.find((skill) => skill.name === 'cocos-agent');
        const workflowRepairReference = baseSkill?.references.find((reference) =>
            reference.id.endsWith('cocos-agent-intent-context-provider-repair-0.1.md'));
        assert.ok(workflowRepairReference, 'base Agent skill declares the task understanding, summary and Provider contract');
        const indexedReferences = new Map();
        for (const skill of index.skills) {
            const skillText = (await client.readResource({ uri: skill.uri })).contents[0].text;
            assert.ok(skillText.includes(`skill ${skill.name} sha256 ${skill.sha256}`), `skill hash missing: ${skill.name}`);
            for (const reference of skill.references) indexedReferences.set(reference.uri, reference);
        }
        assert.equal(indexedReferences.size, 33);
        for (const reference of indexedReferences.values()) {
            const content = (await client.readResource({ uri: reference.uri })).contents[0];
            const bytes = content.blob ? Buffer.from(content.blob, 'base64') : Buffer.from(content.text || '', 'utf8');
            assert.equal(createHash('sha256').update(bytes).digest('hex'), reference.sha256, `reference hash mismatch: ${reference.uri}`);
        }

        const { runDeepSeekAgent: runPackagedAgent } = await import(pathToFileURL(
            path.join(runtimeRoot, 'tools/cocos-agent-bridge/mcp/deepseek-agent.mjs')).href);
        const sceneSkill = index.skills.find((skill) => skill.name === 'cocos2-scene-composition');
        assert.ok(sceneSkill);
        const sceneReference = sceneSkill.references.find((reference) => reference.id.endsWith('scene-composition-0.1.md'));
        assert.ok(sceneReference);
        const registeredRoot = registeredProjectRoot;
        const instance = { projectRoot: registeredRoot, creatorVersion: '2.4.15', state: 'ready' };
        const modelSteps = [
            ['cocos_2x_instances_list', {}],
            ['cocos_2x_capabilities_list', { projectRoot: registeredRoot }],
            ['cocos_2x_project_instructions_read', { projectRoot: registeredRoot }],
            ['cocos_2x_skills_list', {}],
            ['cocos_2x_skill_read', { name: sceneSkill.name }],
            ['cocos_2x_skill_reference_read', { skillName: sceneSkill.name, referenceId: sceneReference.id }],
            ['cocos_2x_scene_snapshot', { projectRoot: registeredRoot, input: {} }],
        ];
        let modelStepIndex = 0;
        const tracePath = path.join(temporary, 'packaged-skill-read.jsonl');
        const packagedResult = await runPackagedAgent({
            client: {
                listTools: () => client.listTools(),
                readResource: (request) => client.readResource(request),
                callTool: async ({ name, arguments: args }) => {
                    if (name === 'cocos_2x_instances_list') return { isError: false,
                        structuredContent: { success: true, data: [instance] } };
                    if (name === 'cocos_2x_capabilities_list') return { isError: false,
                        structuredContent: { success: true, data: { instance, commands: [{ id: 'scene.snapshot', status: 'available' }] } } };
                    if (name === 'cocos_2x_project_instructions_read') return client.callTool({ name, arguments: args });
                    if (name === 'cocos_2x_scene_snapshot' && args.projectRoot === registeredRoot) return { isError: false,
                        structuredContent: { success: true, outcome: 'completed', data: { scene: 'fixture-scene', nodeCount: 1 } } };
                    throw new Error(`Unexpected packaged tool call: ${name}`);
                },
            },
            task: '只读规划如何在场景中组织多个 Sprite 和 Label，并说明读回、预览与补偿要求。',
            projectRoot: registeredRoot,
            skillFiles: [path.join(pluginRoot, 'skills/cocos-agent/SKILL.md')],
            tracePath,
            apiKey: 'sk-packaged-agent-test-placeholder',
            mode: 'Ask',
            maxTurns: 8,
            callModel: async ({ tools: offeredTools, messages }) => {
                if (modelStepIndex === modelSteps.length) return { choices: [{ finish_reason: 'stop', message: { role: 'assistant',
                    content: '只读场景检查完成；已读取组合技能及其合同引用。' } }] };
                const [expectedName, expectedArguments] = modelSteps[modelStepIndex++];
                assert.ok(offeredTools.some((tool) => tool.function.name === expectedName), `packaged Agent did not offer ${expectedName}`);
                if (expectedName === 'cocos_2x_skill_reference_read') {
                    assert.ok(messages.some((message) => message.role === 'tool' && message.content.includes('# Creator 2.4.15 scene composition')));
                }
                if (expectedName === 'cocos_2x_skills_list') {
                    assert.ok(messages.some((message) => message.role === 'tool' && message.content.includes('private-convention-marker')));
                }
                if (expectedName === 'cocos_2x_scene_snapshot') {
                    assert.ok(messages.some((message) => message.role === 'tool' && message.content.includes('scene-composition-0.1.md')));
                }
                return { choices: [{ finish_reason: 'tool_calls', message: {
                    role: 'assistant', tool_calls: [{ id: `packaged-call-${modelStepIndex}`, type: 'function',
                        function: { name: expectedName, arguments: JSON.stringify(expectedArguments) } }],
                } }] };
            },
        });
        assert.equal(packagedResult.status, 'completed', `${packagedResult.status}:${packagedResult.reason}:${JSON.stringify(packagedResult.receipts.map((receipt) => ({ name: receipt.name, success: receipt.structuredContent?.success, code: receipt.structuredContent?.error?.code })))}`);
        assert.equal(modelStepIndex, modelSteps.length);
        const packagedTrace = fs.readFileSync(tracePath, 'utf8');
        assert.match(packagedTrace, /"event":"skill.read"[^\n]*"skillName":"cocos2-scene-composition"/);
        assert.match(packagedTrace, /"event":"skill.reference.read"[^\n]*"referenceId":"[^"]*scene-composition-0\.1\.md"/);
        assert.equal(packagedTrace.includes('Use this skill only with the registered'), false);
        assert.equal(packagedTrace.includes('private-convention-marker'), false, 'trace must keep project convention text private');
        assert.match(packagedTrace, /"file":"AGENTS\.md"[^\n]*"sha256":"[a-f0-9]{64}"/);

        const assistantHost = path.join(runtimeRoot, 'tools/cocos-agent-bridge/mcp/assistant-host.mjs');
        const child = spawn(process.execPath, [assistantHost, '--project', temporary, '--model', 'deepseek-flash'], {
            cwd: temporary,
            env: { ...process.env, COCOS_AGENT_RUNTIME_ROOT: runtimeRoot, DEEPSEEK_API_KEY: 'sk-package-smoke-test-not-a-real-key' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        try {
            const startup = await waitForStart(child);
            assert.ok(['ready', 'loopback-restricted'].includes(startup.status));
            if (startup.status === 'ready') {
                assert.equal(startup.payload.creatorVersion, '2.4.15');
                assert.equal(startup.payload.model, 'deepseek-flash');
            }
        } finally {
            if (child.exitCode === null && child.signalCode === null) {
                const closed = new Promise((resolve) => child.once('close', resolve));
                child.kill('SIGTERM');
                await closed;
            }
        }
    } finally {
        await client?.close().catch(() => {});
        fs.rmSync(temporary, { recursive: true, force: true });
    }
});

test('Creator runtime installer rejects an existing runtime instead of replacing it', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-existing-runtime-'));
    const extension = path.join(temporary, 'packages/cocos-agent-bridge');
    fs.mkdirSync(path.join(extension, 'assistant-runtime'), { recursive: true });
    fs.writeFileSync(path.join(extension, 'package.json'), JSON.stringify({ name: 'cocos-agent-bridge' }));
    try {
        await assert.rejects(import('../package-creator-extension.mjs').then(({ installCreatorRuntime }) =>
            installCreatorRuntime({ sourceRoot: SOURCE_ROOT, extensionDirectory: extension })), /CREATOR_RUNTIME_ALREADY_INSTALLED/);
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
});

test('Creator extension upgrade swaps a complete verified package and retains a rollback copy', () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-extension-upgrade-'));
    const extension = path.join(temporary, 'LinkUpClient/packages/cocos-agent-bridge');
    fs.mkdirSync(path.join(extension, 'assistant-runtime'), { recursive: true });
    fs.writeFileSync(path.join(extension, 'package.json'), JSON.stringify({ name: 'cocos-agent-bridge', version: '0.3.0',
        'cocos-agent': { creatorVersion: '2.4.15' } }));
    fs.writeFileSync(path.join(extension, 'main.js'), 'old-extension-marker');
    fs.writeFileSync(path.join(extension, 'assistant-runtime', 'old-runtime-marker'), 'old-runtime-marker');
    try {
        const result = upgradeCreatorExtension({ sourceRoot: SOURCE_ROOT, extensionDirectory: extension });
        assert.equal(result.previousVersion, '0.3.0');
        assert.equal(result.installedVersion, JSON.parse(fs.readFileSync(path.join(extension, 'package.json'), 'utf8')).version);
        assert.equal(result.creatorReloadRequired, true);
        assert.equal(fs.existsSync(path.join(extension, 'assistant-runtime/tools/cocos-agent-bridge/mcp/assistant-host.mjs')), true);
        assert.equal(fs.existsSync(path.join(extension, 'assistant-runtime/tools/cocos-agent-bridge/mcp/assistant-conversation-summary.mjs')), true);
        assert.equal(fs.existsSync(path.join(extension, 'assistant-runtime/tools/cocos-agent-bridge/mcp/assistant-memory-store.mjs')), true);
        assert.equal(fs.existsSync(path.join(extension, 'assistant-runtime/tools/cocos-agent-bridge/mcp/assistant-tool-result-archive.mjs')), true);
        assert.equal(fs.existsSync(path.join(extension, 'assistant-runtime/tools/cocos-agent-bridge/mcp/assistant-task-store.mjs')), true);
        assert.equal(fs.existsSync(path.join(extension, 'assistant-runtime/tools/cocos-agent-runtime/dist/task-system.js')), true);
        assert.equal(fs.existsSync(path.join(result.rollbackDirectory, 'assistant-runtime/old-runtime-marker')), true);
        assert.equal(fs.existsSync(path.join(result.rollbackDirectory, 'main.js')), true);
        const restored = restoreCreatorExtension({ extensionDirectory: extension, rollbackDirectory: result.rollbackDirectory });
        assert.equal(restored.restoredVersion, '0.3.0');
        assert.equal(restored.replacedVersion, result.installedVersion);
        assert.equal(fs.readFileSync(path.join(extension, 'main.js'), 'utf8'), 'old-extension-marker');
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('Creator extension upgrade leaves the installed extension intact when package staging fails', () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-extension-upgrade-fail-'));
    const extension = path.join(temporary, 'LinkUpClient/packages/cocos-agent-bridge');
    const badSource = path.join(temporary, 'incomplete-source');
    fs.mkdirSync(extension, { recursive: true });
    fs.mkdirSync(badSource);
    fs.writeFileSync(path.join(extension, 'package.json'), JSON.stringify({ name: 'cocos-agent-bridge', version: '0.3.0',
        'cocos-agent': { creatorVersion: '2.4.15' } }));
    fs.writeFileSync(path.join(extension, 'marker.txt'), 'preserve-me');
    try {
        assert.throws(() => upgradeCreatorExtension({ sourceRoot: badSource, extensionDirectory: extension }), /CREATOR_EXTENSION_SOURCE_MISSING/);
        assert.equal(fs.readFileSync(path.join(extension, 'marker.txt'), 'utf8'), 'preserve-me');
        assert.equal(fs.readdirSync(path.dirname(extension)).some((name) => name.includes('rollback-') || name.includes('upgrade-')), false);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
