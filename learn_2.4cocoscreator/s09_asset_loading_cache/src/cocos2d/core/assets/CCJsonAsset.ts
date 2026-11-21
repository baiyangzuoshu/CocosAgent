import { CCAsset, type AssetData } from "./CCAsset.ts";

/** Source-shaped crop of cc.JsonAsset: a typed Asset exposing parsed JSON. */
export class JsonAsset extends CCAsset {
  constructor(uuid: string, readonly json: AssetData) {
    super(uuid);
  }
}
