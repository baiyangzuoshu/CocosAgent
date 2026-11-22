export class CCAsset {
  private _ref = 0;
  loaded = true;

  constructor(readonly _uuid: string, readonly type: string, private readonly tryRelease: (asset: CCAsset) => void = () => {}) {}

  addRef(): this {
    this._ref += 1;
    return this;
  }

  decRef(autoRelease = true): this {
    if (this._ref > 0) this._ref -= 1;
    if (autoRelease) this.tryRelease(this);
    return this;
  }

  get refCount(): number {
    return this._ref;
  }
}
