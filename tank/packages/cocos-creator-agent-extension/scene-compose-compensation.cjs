'use strict';

function orderCreatedSubtreesForDeletion(createdSubtrees) {
  if (!Array.isArray(createdSubtrees)) throw new TypeError('SCENE_COMPOSE_SUBTREES_INVALID');
  const parentGroups = new Map();
  createdSubtrees.forEach((root, inputIndex) => {
    if (!root || typeof root.parentUuid !== 'string' || !Array.isArray(root.subtree))
      throw new TypeError('SCENE_COMPOSE_SUBTREE_INVALID');
    const rootNode = root.subtree.find((node) => node && node.nodeUuid === root.nodeUuid);
    if (!rootNode || !Number.isSafeInteger(rootNode.siblingIndex))
      throw new TypeError('SCENE_COMPOSE_SUBTREE_SIBLING_INDEX_INVALID');
    if (!parentGroups.has(root.parentUuid)) parentGroups.set(root.parentUuid, []);
    parentGroups.get(root.parentUuid).push({ root, siblingIndex: rootNode.siblingIndex, inputIndex });
  });

  const ordered = [];
  for (const roots of parentGroups.values()) {
    roots.sort((a, b) => b.siblingIndex - a.siblingIndex || a.inputIndex - b.inputIndex);
    ordered.push(...roots.map(({ root }) => root));
  }
  return ordered;
}

module.exports = { orderCreatedSubtreesForDeletion };
