import type { AssetRecord, BundleConfigData } from "./types.ts";

/** 本课使用第 93 课查表后的结果，不重复实现完整 Config。 */
export class BundleConfig {
  constructor(private readonly data: BundleConfigData) {}

  getScene(path: string): string {
    const uuid = this.data.scenes[path];
    if (!uuid) throw new Error("Config 中找不到场景: " + path);
    return uuid;
  }

  getAsset(uuid: string): AssetRecord {
    const record = this.data.assets.get(uuid);
    if (!record) throw new Error("Config 中找不到 UUID: " + uuid);
    return record;
  }
}
