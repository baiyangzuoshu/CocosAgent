import { Asset, type AssetData } from "../assets/asset.ts";
import { Cache } from "./cache.ts";
import { Config } from "./config.ts";

export type LoadComplete = (error: Error | null, asset: Asset | null) => void;

export class LoadPipeline {
  constructor(
    private readonly _assets: Cache<Asset>,
    private readonly _config: Config,
  ) {}

  load(uuid: string, onComplete: LoadComplete): void {
    const cached = this._assets.get(uuid);
    if (cached) {
      queueMicrotask(() => onComplete(null, cached));
      return;
    }

    const info = this._config.getInfoWithUuid(uuid);
    if (!info) {
      onComplete(new Error(`找不到 UUID: ${uuid}`), null);
      return;
    }

    fetch(info.url)
      .then((response) => {
        if (!response.ok) throw new Error(`加载失败: ${response.status}`);
        return response.json() as Promise<AssetData>;
      })
      .then((data) => {
        const asset = new Asset(uuid, data);
        this._assets.add(uuid, asset);
        onComplete(null, asset);
      })
      .catch((error: unknown) => {
        onComplete(error instanceof Error ? error : new Error(String(error)), null);
      });
  }
}
