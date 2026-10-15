import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AssistantToolResultArchive } from './assistant-tool-result-archive.mjs';

test('tool result archive is private, chunked, and isolated by exact run and call identity', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-evidence-'));
    const trace = path.join(root, 'run.jsonl');
    try {
        const archive = new AssistantToolResultArchive(trace);
        const directory = `${trace}.tool-results`;
        if (process.platform !== 'win32') assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
        const original = JSON.stringify({ structuredContent: { success: true, scene: 'S'.repeat(10_000) } });
        await archive.save({ runId: 'run-a', callId: 'call-a', toolName: 'scene.snapshot', payload: original });
        if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(directory, `${(await import('node:crypto')).default.createHash('sha256').update('call-a').digest('hex')}.json`)).mode & 0o777, 0o600);
        const first = await archive.read({ runId: 'run-a', callId: 'call-a', offset: 0, limit: 4000 });
        assert.equal(first.payload, original.slice(0, 4000));
        assert.equal(first.totalChars, original.length);
        assert.equal(first.nextOffset, 4000);
        assert.equal(await archive.read({ runId: 'run-b', callId: 'call-a', offset: 0, limit: 100 }), null);
        assert.equal(await archive.read({ runId: 'run-a', callId: '../run.jsonl', offset: 0, limit: 100 }), null);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
