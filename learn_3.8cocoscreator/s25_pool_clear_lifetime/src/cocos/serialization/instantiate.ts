import type { Node } from "../scene-graph/node.ts";
import type { Prefab } from "../scene-graph/prefab/prefab.ts";

interface Instantiable {
  _instantiate(): Node;
}

export function instantiate(original: Node | Prefab): Node {
  return (original as Instantiable)._instantiate();
}
