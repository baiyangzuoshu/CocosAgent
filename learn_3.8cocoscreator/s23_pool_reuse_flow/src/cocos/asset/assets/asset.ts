export interface AssetData {
  name: string;
  textureUrl: string;
  atlasSize: { width: number; height: number };
  rect: { x: number; y: number; width: number; height: number };
}

export class Asset {
  constructor(
    readonly _uuid: string,
    readonly data: AssetData,
  ) {}
}
