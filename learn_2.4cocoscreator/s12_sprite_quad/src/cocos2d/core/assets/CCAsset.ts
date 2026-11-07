export interface AssetData {
  name: string;
  health: number;
}

export class CCAsset {
  constructor(
    readonly _uuid: string,
    readonly data: AssetData,
  ) {}
}
