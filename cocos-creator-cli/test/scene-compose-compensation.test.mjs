import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { orderCreatedSubtreesForDeletion } = require('../creator-extension/scene-compose-compensation.cjs');

function subtree(nodeUuid, parentUuid, siblingIndex) {
  return { nodeUuid, parentUuid, subtree: [{ nodeUuid, parentUuid, siblingIndex }] };
}

test('composition compensation deletes same-parent roots in descending sibling order', () => {
  const roots = [subtree('first', 'canvas', 19), subtree('second', 'canvas', 20), subtree('third', 'canvas', 21)];
  assert.deepEqual(orderCreatedSubtreesForDeletion(roots).map((root) => root.nodeUuid), ['third', 'second', 'first']);
  assert.deepEqual(roots.map((root) => root.nodeUuid), ['first', 'second', 'third']);
});

test('composition compensation preserves first-seen parent groups while sorting each group safely', () => {
  const roots = [subtree('a0', 'parent-a', 2), subtree('b0', 'parent-b', 0), subtree('a1', 'parent-a', 3)];
  assert.deepEqual(orderCreatedSubtreesForDeletion(roots).map((root) => root.nodeUuid), ['a1', 'a0', 'b0']);
});

test('composition compensation rejects incomplete sibling identity before deleting any root', () => {
  assert.throws(() => orderCreatedSubtreesForDeletion([{
    nodeUuid: 'root', parentUuid: 'canvas', subtree: [{ nodeUuid: 'child', siblingIndex: 0 }],
  }]), /SCENE_COMPOSE_SUBTREE_SIBLING_INDEX_INVALID/);
});
