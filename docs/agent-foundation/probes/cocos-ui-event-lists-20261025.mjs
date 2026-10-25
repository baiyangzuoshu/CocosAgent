// A bounded acceptance probe. Every Creator read/write goes through the public CLI.
// Usage: node <this-file> <collect|multi|clear|restore-clear|restore-base|inspect> <instance-id> <journal.json>
// An interrupted commit is never replayed. Inspect its recorded operation ID and reconcile first.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const [action, instanceId, journalPath] = process.argv.slice(2);
if (!instanceId || !journalPath) throw new Error('action, instanceId and journal path required');
const sceneUuid = '2c12110c-6f11-4a89-bcd4-1941dc757ca4';
const projectRoot = '/Users/youjunmao/WORK/Cocos_Engine/tank';
const targets = ['96907646-d467-4b3b-8870-e0bc076a31fb', 'a82641c0-22e3-4ef4-b390-9fd1a7d16a26'];
const eventProperties = {
  'cc.Button': ['clickEvents'], 'cc.Toggle': ['clickEvents', 'checkEvents'],
  'cc.ToggleContainer': ['checkEvents'], 'cc.Slider': ['slideEvents'], 'cc.ScrollView': ['scrollEvents'],
  'cc.PageView': ['scrollEvents', 'pageEvents'],
  'cc.EditBox': ['editingDidBegan', 'textChanged', 'editingDidEnded', 'editingReturn'],
};
let journal = fs.existsSync(journalPath) ? JSON.parse(fs.readFileSync(journalPath, 'utf8')) : { schemaVersion: 1, calls: [], rows: [] };
const save = () => fs.writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
function call(command, input = {}) {
  const record = { sequence: journal.calls.length + 1, instanceId, command, input, startedAt: new Date().toISOString() };
  journal.calls.push(record); save();
  let receipt;
  try {
    receipt = JSON.parse(execFileSync('cocos-creator-agent', ['call', '--instance', instanceId,
      '--command', command, '--input', JSON.stringify(input), '--format', 'json'],
    { encoding: 'utf8', timeout: 65000, maxBuffer: 8 * 1024 * 1024 }));
  } catch (error) { record.failure = String(error.stdout || error.message); save(); throw error; }
  record.receipt = receipt; save();
  assert.equal(receipt.projectRoot, projectRoot);
  assert.equal(receipt.creatorVersion, '2.4.15');
  return receipt.result;
}
function inspect(row) {
  const result = call('creator.scene.ui.inspect', { sceneUuid, nodeUuid: row.nodeUuid });
  const component = result.components.find((item) => item.componentClassName === row.componentClassName);
  assert.equal(component.componentInstanceId, row.componentInstanceId);
  assert.equal(component.eventListsUnavailable?.[row.eventProperty], undefined);
  return component.eventLists[row.eventProperty];
}
function expectedMulti(row) {
  return targets.map((targetUuid, index) => ({ targetUuid, component: 'CliAcceptanceButtonState',
    handler: 'onUiEvent', customEventData: `${row.componentClassName}.${row.eventProperty}:${index + 1}` }));
}
function mutation(row, expectedBefore, events, compensationSource) {
  assert.deepEqual(inspect(row), expectedBefore);
  const command = compensationSource ? 'creator.scene.ui-events.set.compensate' : 'creator.scene.ui-events.set';
  const input = compensationSource ? { sourceOperationId: compensationSource }
    : { sceneUuid, nodeUuid: row.nodeUuid, componentClassName: row.componentClassName,
      eventProperty: row.eventProperty, componentInstanceId: row.componentInstanceId, events };
  const plan = call(`${command}.plan`, input);
  // Review the complete exact diff against the only mutation authorized by this probe.
  assert.equal(plan.sceneUuid, sceneUuid);
  assert.equal(plan.nodeUuid, row.nodeUuid);
  assert.equal(plan.componentClassName, row.componentClassName);
  assert.equal(plan.eventProperty, row.eventProperty);
  assert.equal(plan.componentInstanceId, row.componentInstanceId);
  assert.deepEqual(plan.expectedBefore, expectedBefore);
  assert.deepEqual(plan.expectedAfter, events);
  const result = call(`${command}.commit`, { operationId: plan.operationId, planHash: plan.planHash });
  assert.equal(result.status, 'completed', JSON.stringify(result));
  assert.equal(result.scenePersistenceConfirmed, true);
  assert.deepEqual(result.events, events);
  assert.deepEqual(inspect(row), events);
  return { operationId: plan.operationId, planHash: plan.planHash, sourceSha256: result.diskReadback.sourceSha256,
    metaSha256: result.diskReadback.metaSha256 };
}

const info = call('creator.project.info');
assert.equal(info.activeSceneUuid, sceneUuid);
if (action === 'collect') {
  assert.equal(journal.rows.length, 0);
  const scene = call('creator.scene.snapshot');
  assert.equal(scene.nodeCount, 23);
  assert.equal(scene.truncated, false);
  for (const [componentClassName, properties] of Object.entries(eventProperties)) {
    const node = scene.nodes.find((item) => item.components.includes(componentClassName));
    const result = call('creator.scene.ui.inspect', { sceneUuid, nodeUuid: node.uuid });
    const component = result.components.find((item) => item.componentClassName === componentClassName);
    for (const eventProperty of properties) {
      assert.ok(Array.isArray(component.eventLists[eventProperty]));
      journal.rows.push({ componentClassName, eventProperty, nodeUuid: node.uuid, nodePath: node.path,
        componentInstanceId: component.componentInstanceId, before: component.eventLists[eventProperty] });
    }
  }
  journal.projectRoot = projectRoot; journal.sceneUuid = sceneUuid; journal.targets = targets; save();
} else {
  assert.equal(journal.rows.length, 12);
  for (const row of journal.rows) {
    // Resume only after exact readback proves a prior journaled stage completed.
    // This allows recovery from a later CREATOR_INSTANCE_BUSY without replaying
    // already-applied mutations or trusting the journal alone.
    const completedStage = action === 'multi' ? row.multi
      : action === 'clear' ? row.clear
        : action === 'restore-clear' ? row.restoredClear
          : action === 'restore-base' ? row.restoredBase : null;
    if (completedStage) {
      const expected = action === 'multi' || action === 'restore-clear' ? expectedMulti(row)
        : action === 'clear' ? [] : row.before;
      assert.deepEqual(inspect(row), expected, `Journaled ${action} state does not match Creator readback`);
      continue;
    }
    if (action === 'inspect') {
      const expected = row.restoredBase ? row.before : row.restoredClear ? expectedMulti(row) : row.clear ? [] : row.multi ? expectedMulti(row) : row.before;
      assert.deepEqual(inspect(row), expected);
      continue;
    }
    assert.ok(['multi', 'clear', 'restore-clear', 'restore-base'].includes(action));
    if (action === 'multi') {
      assert.equal(row.multi, undefined, 'Do not replay a completed mutation');
      row.multi = mutation(row, row.before, expectedMulti(row));
    } else if (action === 'clear') {
      assert.ok(row.multi); assert.equal(row.clear, undefined);
      row.clear = mutation(row, expectedMulti(row), []);
    } else if (action === 'restore-clear') {
      assert.ok(row.clear); assert.equal(row.restoredClear, undefined);
      row.restoredClear = mutation(row, [], expectedMulti(row), row.clear.operationId);
    } else {
      assert.ok(row.restoredClear); assert.equal(row.restoredBase, undefined);
      row.restoredBase = mutation(row, expectedMulti(row), row.before, row.multi.operationId);
    }
    save();
    process.stdout.write(`${row.componentClassName}.${row.eventProperty}: ${action} persisted\n`);
  }
}
process.stdout.write(`${JSON.stringify({ action, rows: journal.rows.length, calls: journal.calls.length, journalPath })}\n`);
