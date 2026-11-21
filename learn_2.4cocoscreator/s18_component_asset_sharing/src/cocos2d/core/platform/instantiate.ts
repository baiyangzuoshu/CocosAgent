import { CCAsset } from "../assets/CCAsset.ts";
import Component from "../components/CCComponent.ts";
import type Node from "../CCNode.ts";
import type Prefab from "../assets/CCPrefab.ts";
import BaseNode from "../utils/base-node.ts";

function isNode(value: object): value is BaseNode {
  return value instanceof BaseNode;
}

function belongsToCloneTree(node: BaseNode, root: BaseNode): boolean {
  for (let current: BaseNode | null = node; current; current = current.getParent()) {
    if (current === root) return true;
  }
  return false;
}

function isComponent(value: object): value is Component {
  return value instanceof Component;
}

function instantiateObj(value: unknown, root: BaseNode, map: WeakMap<object, object>): unknown {
  if (value === null || typeof value !== "object") return value;

  // Creator's instantiateObj keeps every cc.Asset as the same shared object.
  if (value instanceof CCAsset) return value;

  if (isNode(value) && value !== root && !belongsToCloneTree(value, root)) return value;
  if (isComponent(value) && !belongsToCloneTree(value.node, root)) return value;

  const existing = map.get(value);
  if (existing) return existing;

  if (ArrayBuffer.isView(value)) {
    const clonedView = (value as ArrayBufferView & { slice?: () => ArrayBufferView }).slice?.();
    if (clonedView) map.set(value, clonedView as object);
    return clonedView ?? value;
  }

  const clone: object = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value));
  map.set(value, clone);

  for (const key of Object.keys(value)) {
    // The cloned parent links are rebuilt from _children after the graph copy.
    if (key === "_parent") continue;
    (clone as Record<string, unknown>)[key] = instantiateObj(
      (value as Record<string, unknown>)[key],
      root,
      map,
    );
  }
  return clone;
}

function restoreChildParentLinks(node: BaseNode, visited: WeakSet<object>): void {
  if (visited.has(node)) return;
  visited.add(node);
  for (const child of node._children) {
    child._parent = node;
    restoreChildParentLinks(child, visited);
  }
}

function doInstantiate<T extends BaseNode>(original: T, parent: BaseNode): T {
  const clone = instantiateObj(original, parent, new WeakMap()) as T;
  restoreChildParentLinks(clone, new WeakSet());
  return clone;
}

export function instantiate(original: Node | Prefab): Node {
  return original._instantiate();
}

/** Mirrors Creator's internal cc.instantiate._clone entry used by Node._instantiate. */
export namespace instantiate {
  export function _clone<T extends BaseNode>(original: T, parent: BaseNode): T {
    return doInstantiate(original, parent);
  }
}
