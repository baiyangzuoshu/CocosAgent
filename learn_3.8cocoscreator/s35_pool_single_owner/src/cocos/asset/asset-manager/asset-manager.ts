import { Asset } from "../assets/asset.ts";
import { Cache } from "./cache.ts";
import { Config } from "./config.ts";
import { LoadPipeline, type LoadComplete } from "./load.ts";

export class AssetManager {
  readonly assets = new Cache<Asset>();
  private readonly _pipeline = new LoadPipeline(this.assets, new Config());

  loadAny(uuid: string, onComplete: LoadComplete): void {
    this._pipeline.load(uuid, onComplete);
  }
}
