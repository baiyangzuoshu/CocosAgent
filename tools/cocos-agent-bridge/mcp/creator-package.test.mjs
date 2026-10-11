import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { buildCreatorExtensionBundle } from '../package-creator-extension.mjs';

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
    let client;
    try {
        const built = buildCreatorExtensionBundle({ sourceRoot: SOURCE_ROOT, outputDirectory: output });
        const runtimeRoot = path.join(output, 'assistant-runtime');
        const pluginRoot = path.join(runtimeRoot, 'plugins/cocos-agent-2x');
        const serverPath = path.join(runtimeRoot, 'tools/cocos-agent-bridge/mcp/mcp-server.mjs');
        assert.equal(built.runtimeDirectory, runtimeRoot);
        assert.ok(fs.existsSync(serverPath));
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
        const { resources } = await client.listResources();
        assert.ok(resources.some((resource) => resource.uri === 'cocos://2x/skills/index'));
        const index = JSON.parse((await client.readResource({ uri: 'cocos://2x/skills/index' })).contents[0].text);
        assert.equal(index.agentPackage.name, 'cocos-agent-2x');
        assert.equal(index.skills.length, 11);
        const indexedReferences = new Map();
        for (const skill of index.skills) {
            const skillText = (await client.readResource({ uri: skill.uri })).contents[0].text;
            assert.ok(skillText.includes(`skill ${skill.name} sha256 ${skill.sha256}`), `skill hash missing: ${skill.name}`);
            for (const reference of skill.references) indexedReferences.set(reference.uri, reference);
        }
        assert.equal(indexedReferences.size, 29);
        for (const reference of indexedReferences.values()) {
            const content = (await client.readResource({ uri: reference.uri })).contents[0];
            const bytes = content.blob ? Buffer.from(content.blob, 'base64') : Buffer.from(content.text || '', 'utf8');
            assert.equal(createHash('sha256').update(bytes).digest('hex'), reference.sha256, `reference hash mismatch: ${reference.uri}`);
        }

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
