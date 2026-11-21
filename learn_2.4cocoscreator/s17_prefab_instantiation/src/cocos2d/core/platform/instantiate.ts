import { CCAsset } from "../assets/CCAsset.ts";

export interface Instantiable {
  _instantiate(): object;
}

function isNodeLike(value: object): value is object & {
  _parent: unknown;
  _children: object[];
  getParent(): object | null;
} {
  const candidate = value as { _parent?: unknown; _children?: unknown; getParent?: unknown };
  return Array.isArray(candidate._children) && typeof candidate.getParent === "function";
}

function isDescendantOf(node: object, root: object): boolean {
  let current: object | null = node;
  while (current) {
    if (current === root) return true;
    current = isNodeLike(current) ? current.getParent() : null;
  }
  return false;
}

function isComponentLike(value: object): value is object & { node: object } {
  return "node" in value && isNodeLike((value as { node: object }).node);
}

function cloneValue(value: unknown, root: object, seen: WeakMap<object, object>): unknown {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof CCAsset) return value;

  if (isNodeLike(value) && value !== root && !isDescendantOf(value, root)) return value;
  if (isComponentLike(value) && !isDescendantOf(value.node, root)) return value;

  const prior = seen.get(value);
  if (prior) return prior;

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView & { slice?: () => ArrayBufferView };
    const clonedView = view.slice?.();
    if (!clonedView) return value;
    seen.set(value, clonedView as object);
    return clonedView;
  }
  if (value instanceof ArrayBuffer) return value.slice(0);

  const clone: object = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value));
  seen.set(value, clone);

  for (const key of Object.keys(value)) {
    // Parent pointers are rebuilt from each cloned node's children.
    if (key === "_parent") continue;
    (clone as Record<string, unknown>)[key] = cloneValue(
      (value as Record<string, unknown>)[key],
      root,
      seen,
    );
  }
  return clone;
}

function restoreParents(node: object, parent: object | null, visited: WeakSet<object>): void {
  if (!isNodeLike(node) || visited.has(node)) return;
  visited.add(node);
  node._parent = parent;
  for (const child of node._children) restoreParents(child, node, visited);
}

/** Cropped counterpart of Creator's graph clone: clone owned data, keep Assets shared. */
export function cloneGraph<T extends object>(original: T): T {
  const clone = cloneValue(original, original, new WeakMap()) as T;
  restoreParents(clone, null, new WeakSet());
  return clone;
}

export function instantiate<T extends object>(original: { _instantiate(): T }): T {
  return original._instantiate();
}
