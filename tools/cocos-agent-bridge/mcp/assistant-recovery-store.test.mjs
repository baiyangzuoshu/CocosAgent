import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AssistantRecoveryStore } from './assistant-recovery-store.mjs';

test('recovery state survives a new Host store, rejects stale CAS and wrong projects, and drains all migrated pending operations', async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-recovery-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const options = { stateRoot: path.join(root, 'state') };
    const store = new AssistantRecoveryStore(root, options);
    const runs = ['op-a', 'op-b'].map((operationId) => ({ id: operationId, status: 'needs-review', receipts: [
        { operationId, toolName: 'cocos_2x_command_execute', sideEffect: 'unknown' },
    ] }));
    await store.migrateRuns(runs);
    let current = await new AssistantRecoveryStore(root, options).load();
    assert.equal(current.pending.value, 'op-a');
    assert.equal(current.queued[0].value, 'op-b');
    await assert.rejects(store.save(null, 0), /RECOVERY_REVISION_CONFLICT/);
    await store.save(null, current.revision);
    current = await store.load();
    assert.equal(current.pending.value, 'op-b');
    await store.save(null, current.revision);
    assert.equal((await store.load()).pending, null);
    await store.migrateRuns(runs);
    assert.equal((await store.load()).pending, null, 'old bounded history cannot re-lock a reconciled store');
    const parsed = JSON.parse(fs.readFileSync(store.file, 'utf8')); parsed.projectKey = 'wrong';
    fs.writeFileSync(store.file, JSON.stringify(parsed));
    await assert.rejects(store.load(), /RECOVERY_STORE_INVALID/);
});
