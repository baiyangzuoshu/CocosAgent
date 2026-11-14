import { BundleConfig } from "./config.ts";
import type { Asset } from "../assets/asset.ts";

/** Bundle 用场景工程路径查出 UUID，再交给 AssetManager 加载。 */
export class Bundle {
  constructor(
    private readonly config: BundleConfig,
    private readonly loadAny: (uuid: string) => Promise<Asset>,
    private readonly trace: string[],
  ) {}

  loadScene(path: string): Promise<Asset> {
    const uuid = this.config.getScene(path);
    this.trace.push("Bundle.loadScene: " + path + " → " + uuid);
    return this.loadAny(uuid);
  }
}
