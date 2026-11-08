import type Node from "../CCNode.ts";
import type Prefab from "../assets/CCPrefab.ts";

export interface Instantiable {
  _instantiate(): Node;
}

export function instantiate(original: Node | Prefab): Node {
  return (original as Instantiable)._instantiate();
}
