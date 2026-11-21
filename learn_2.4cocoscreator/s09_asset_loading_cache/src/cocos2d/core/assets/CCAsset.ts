export interface AssetData {
  name: string;
  health: number;
}

/** Minimal lesson model of Creator's common Asset identity. */
export class CCAsset {
  loaded = true;
  refCount = 0;
  _native = "";

  constructor(readonly _uuid: string) {}

  addRef(): this {
    this.refCount++;
    return this;
  }

  decRef(): number {
    this.refCount = Math.max(0, this.refCount - 1);
    return this.refCount;
  }
}
