export class Asset {
  private refs = 0;

  constructor(readonly uuid: string, readonly type: string) {}

  addRef(): this {
    this.refs += 1;
    return this;
  }

  get refCount(): number {
    return this.refs;
  }
}
