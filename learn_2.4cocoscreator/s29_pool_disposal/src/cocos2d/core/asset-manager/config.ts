export interface AssetInfo {
  url: string;
}

const assetInfos: Record<string, AssetInfo> = {
  "hero-uuid": { url: "./assets/hero.json" },
};

export class Config {
  getInfoWithUuid(uuid: string): AssetInfo | undefined {
    return assetInfos[uuid];
  }
}
