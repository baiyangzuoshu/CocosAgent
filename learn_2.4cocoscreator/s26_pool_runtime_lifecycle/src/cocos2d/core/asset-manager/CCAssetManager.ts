import { CCAsset } from "../assets/CCAsset.ts";
import { Cache } from "./cache.ts";
import { Config } from "./config.ts";
import { LoadPipeline, type LoadComplete } from "./load.ts";

export class CCAssetManager {
  readonly assets = new Cache<CCAsset>();
  private readonly _pipeline = new LoadPipeline(this.assets, new Config());

  loadAny(uuid: string, onComplete: LoadComplete): void {
    this._pipeline.load(uuid, onComplete);
  }
}
