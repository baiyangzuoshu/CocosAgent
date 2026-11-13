export class Asset {
  loaded = false;

  constructor(readonly uuid: string, readonly data: Record<string, unknown>) {}

  onLoaded(): void {
    // Asset 加载完成钩子；不是 Component 生命周期。
    this.loaded = true;
  }
}
