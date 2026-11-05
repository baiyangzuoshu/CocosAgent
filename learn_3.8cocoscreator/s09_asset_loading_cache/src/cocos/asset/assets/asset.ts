export interface AssetData {
  name: string;
  health: number;
}

export class Asset {
  constructor(
    readonly _uuid: string,
    readonly data: AssetData,
  ) {}
}
