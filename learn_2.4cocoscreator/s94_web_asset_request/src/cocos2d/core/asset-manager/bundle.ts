import { BundleConfig } from "./config.ts";
import type { CCAsset } from "../assets/CCAsset.ts";

/** Bundle 用场景工程路径查出 UUID，再交给 AssetManager 加载。 */
export class Bundle {
  constructor(
    private readonly config: BundleConfig,
    private readonly loadAny: (uuid: string) => Promise<CCAsset>,
    private readonly trace: string[],
  ) {}

  loadScene(path: string): Promise<CCAsset> {
    const uuid = this.config.getScene(path);
    this.trace.push("Bundle.loadScene: " + path + " → " + uuid);
    return this.loadAny(uuid);
  }
}
