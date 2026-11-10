import type Node from "../CCNode.ts";

export default class Prefab {
  private _instantiatedTimes = 0;

  constructor(public data: Node) {}

  _instantiate(): Node {
    this._instantiatedTimes++;
    return this.data._instantiate();
  }

  get instantiatedTimes(): number {
    return this._instantiatedTimes;
  }
}
