import CCObject from "../platform/CCObject.ts";

/** Assets are shared references during instantiate, not graph-cloned objects. */
export class CCAsset extends CCObject {
  constructor(readonly uuid: string, readonly name: string) {
    super();
  }
}
