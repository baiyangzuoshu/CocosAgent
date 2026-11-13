export class CCAsset {
  private _ref = 0;
  loaded = true;

  constructor(readonly _uuid: string, readonly type: string) {}

  addRef(): this {
    this._ref += 1;
    return this;
  }

  get refCount(): number {
    return this._ref;
  }
}
