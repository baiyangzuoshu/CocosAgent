import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCommand } from '../bridge/contracts.mjs';

const require = createRequire(import.meta.url);
const { classifyPrefabInstanceOverride, validPrefabInstanceOverridePlan } =
  require('../creator-extension/prefab-instance-operations.cjs');
const uuid = 'e98a93d5-9707-45a6-88f6-50a40a1511f4';
const hash = (letter) => letter.repeat(64);

function command(id) {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../creator-extension/command-contract.json'), 'utf8'));
  return contract.commands.find((entry) => entry.id === id);
}

function plan(action = 'apply') {
  return {
    operation: 'creator.prefab.instance.override', action, sceneUuid: uuid, selectedNodeUuid: uuid,
    prefabRootUuid: uuid, prefabUuid: uuid, targetUrl: 'db://assets/prefabs/Root.prefab',
    expectedBefore: { instanceStateSha256: hash('a'), sceneSourceSha256: hash('b'),
      sceneMetaSha256: hash('c'), prefabSourceSha256: hash('d'), prefabMetaSha256: hash('e') },
  };
}

function after() {
  return { sceneUuid: uuid, prefabUuid: uuid, prefabRootUuid: uuid, targetUrl: 'db://assets/prefabs/Root.prefab',
    instanceStateSha256: hash('a'), sceneSourceSha256: hash('b'), sceneMetaSha256: hash('c'),
    prefabSourceSha256: hash('d'), prefabMetaSha256: hash('e') };
}

test('Prefab instance override contract exposes a read-only plan, approved write, and non-replaying reconcile', () => {
  const request = { sceneUuid: uuid, nodeUuid: uuid, action: 'apply' };
  const planCommand = command('creator.prefab.instance.override.plan');
  const commitCommand = command('creator.prefab.instance.override.commit');
  const reconcileCommand = command('creator.prefab.instance.override.reconcile');
  assert.equal(planCommand.access, 'plan');
  assert.equal(validateCommand(planCommand.id, request).ok, true);
  assert.equal(validateCommand(planCommand.id, { ...request, action: 'revert' }).ok, true);
  assert.equal(validateCommand(planCommand.id, { ...request, action: 'delete' }).ok, false);
  assert.equal(commitCommand.access, 'write');
  assert.equal(commitCommand.approval, true);
  assert.equal(reconcileCommand.access, 'plan');
  assert.match(reconcileCommand.description, /Never reissues/i);
});

test('Prefab instance plans require exact hash preconditions and action identity', () => {
  assert.equal(validPrefabInstanceOverridePlan(plan('apply')), true);
  assert.equal(validPrefabInstanceOverridePlan(plan('revert')), true);
  assert.equal(validPrefabInstanceOverridePlan({ ...plan(), action: 'delete' }), false);
  assert.equal(validPrefabInstanceOverridePlan({ ...plan(), expectedBefore: { ...plan().expectedBefore,
    prefabMetaSha256: 'stale' } }), false);
});

test('Apply is observed only when the linked Prefab source changed without metadata identity drift', () => {
  const p = plan('apply');
  assert.equal(classifyPrefabInstanceOverride(p, { ...after(), prefabSourceSha256: hash('f') }), 'effect-observed');
  assert.equal(classifyPrefabInstanceOverride(p, after()), 'not-applied');
  assert.equal(classifyPrefabInstanceOverride(p, { ...after(), sceneSourceSha256: hash('f') }), 'needs-reconciliation');
  assert.equal(classifyPrefabInstanceOverride(p, { ...after(), prefabMetaSha256: hash('f') }), 'conflict');
  assert.equal(classifyPrefabInstanceOverride(p, { ...after(), sceneMetaSha256: hash('f') }), 'conflict');
});

test('Revert requires both a changed live instance and saved scene while preserving the linked Prefab', () => {
  const p = plan('revert');
  assert.equal(classifyPrefabInstanceOverride(p, { ...after(), instanceStateSha256: hash('f'),
    sceneSourceSha256: hash('f') }), 'effect-observed');
  assert.equal(classifyPrefabInstanceOverride(p, { ...after(), instanceStateSha256: hash('f') }), 'needs-reconciliation');
  assert.equal(classifyPrefabInstanceOverride(p, { ...after(), prefabSourceSha256: hash('f') }), 'conflict');
  assert.equal(classifyPrefabInstanceOverride(p, { ...after(), prefabRootUuid: 'different' }), 'conflict');
});
