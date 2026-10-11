import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AssistantMemoryFileStore, projectMemoryKey } from './assistant-memory-store.mjs';

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-project-memory-'));
    const projectA = path.join(root, 'project-a');
    const projectB = path.join(root, 'project-b');
    fs.mkdirSync(projectA);
    fs.mkdirSync(projectB);
    return { root, projectA, projectB, stateRoot: path.join(root, 'state') };
}

function snapshot(projectKey, revision, memories = []) {
    return { version: 1, projectKey, revision, memories, operations: [], tombstones: [] };
}

test('persistent memory uses canonical project isolation and owner-only local state files', async () => {
    const value = fixture();
    try {
        const first = new AssistantMemoryFileStore(value.projectA, { stateRoot: value.stateRoot });
        const second = new AssistantMemoryFileStore(value.projectB, { stateRoot: value.stateRoot });
        assert.equal(first.projectKey, projectMemoryKey(value.projectA));
        assert.notEqual(first.projectKey, second.projectKey);
        await first.save(snapshot(first.projectKey, 1, [{ id: 'memory-a', body: 'project A only' }]), 0);
        await second.save(snapshot(second.projectKey, 1, [{ id: 'memory-b', body: 'project B only' }]), 0);
        assert.equal((await first.load()).memories[0].body, 'project A only');
        assert.equal((await second.load()).memories[0].body, 'project B only');
        assert.notEqual(first.file, second.file);
        if (process.platform !== 'win32') assert.equal(fs.statSync(first.file).mode & 0o777, 0o600);
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('revision compare prevents concurrent or stale memory mutation from overwriting newer state', async () => {
    const value = fixture();
    try {
        const store = new AssistantMemoryFileStore(value.projectA, { stateRoot: value.stateRoot });
        await store.save(snapshot(store.projectKey, 1), 0);
        await assert.rejects(store.save(snapshot(store.projectKey, 1, [{ id: 'stale' }]), 0),
            (error) => error.code === 'PROJECT_MEMORY_CONCURRENT_UPDATE' && error.sideEffect === 'none');
        assert.equal((await store.load()).revision, 1);
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('simultaneous first writes serialize through a lock and one stale writer is rejected', async () => {
    const value = fixture();
    try {
        const left = new AssistantMemoryFileStore(value.projectA, { stateRoot: value.stateRoot });
        const right = new AssistantMemoryFileStore(value.projectA, { stateRoot: value.stateRoot });
        const outcomes = await Promise.allSettled([
            left.save(snapshot(left.projectKey, 1, [{ id: 'left' }]), 0),
            right.save(snapshot(right.projectKey, 1, [{ id: 'right' }]), 0),
        ]);
        assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
        assert.equal(outcomes.filter((result) => result.status === 'rejected').length, 1);
        const saved = await left.load();
        assert.equal(saved.revision, 1);
        assert.equal(saved.memories.length, 1);
        assert.equal(fs.existsSync(left.lockFile), false);
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('a dead Host lock is reclaimed after its lease expires', async () => {
    const value = fixture();
    try {
        const store = new AssistantMemoryFileStore(value.projectA, { stateRoot: value.stateRoot });
        fs.mkdirSync(store.directory, { recursive: true, mode: 0o700 });
        fs.writeFileSync(store.lockFile, JSON.stringify({ pid: 2_000_000_000, createdAt: 1, token: 'abandoned' }), { mode: 0o600 });
        const old = new Date(Date.now() - 60_000);
        fs.utimesSync(store.lockFile, old, old);
        await store.save(snapshot(store.projectKey, 1, [{ id: 'recovered-lock' }]), 0);
        assert.equal((await store.load()).memories[0].id, 'recovered-lock');
        assert.equal(fs.existsSync(store.lockFile), false);
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});
