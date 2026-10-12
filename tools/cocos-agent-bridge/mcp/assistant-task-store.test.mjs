import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AssistantTaskStore } from './assistant-task-store.mjs';

test('task graph state is durable and isolated by canonical Creator project', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-assistant-tasks-'));
    const projectA = path.join(root, 'a');
    const projectB = path.join(root, 'b');
    fs.mkdirSync(projectA); fs.mkdirSync(projectB);
    const stateRoot = path.join(root, 'state');
    try {
        const task = { id: 'task_1234abcd', subject: 'Add sprite', description: 'Attach sprite', status: 'in_progress',
            blockedBy: [], acceptanceCriteria: [{ id: 'scene-readback', description: 'Read back scene', requiredTools: ['cocos_2x_scene_snapshot'],
                evidence: [], status: 'pending' }], owner: 'creator-agent', createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z' };
        new AssistantTaskStore(projectA, { stateRoot }).save([task]);
        assert.deepEqual(new AssistantTaskStore(projectA, { stateRoot }).load(), [task]);
        assert.deepEqual(new AssistantTaskStore(projectB, { stateRoot }).load(), []);
        if (process.platform !== 'win32') assert.equal(fs.statSync(new AssistantTaskStore(projectA, { stateRoot }).file).mode & 0o777, 0o600);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('malformed task graph state fails closed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-assistant-tasks-'));
    const project = path.join(root, 'project'); fs.mkdirSync(project);
    const store = new AssistantTaskStore(project, { stateRoot: path.join(root, 'state') });
    try {
        fs.mkdirSync(store.directory, { recursive: true }); fs.writeFileSync(store.file, '{bad');
        assert.throws(() => store.load(), SyntaxError);
        fs.writeFileSync(store.file, JSON.stringify({ version: 2, tasks: [] }));
        assert.throws(() => store.load(), /ASSISTANT_TASK_STATE_INVALID/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
