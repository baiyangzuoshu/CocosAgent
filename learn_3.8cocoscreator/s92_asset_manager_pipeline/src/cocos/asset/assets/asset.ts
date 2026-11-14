export class Asset {
  loaded = false;

  constructor(readonly uuid: string, readonly type: string, readonly data: Record<string, unknown>) {}

  onLoaded(): void {
    // Creator 3.8 中资源完成回调为 Asset.onLoaded。
    this.loaded = true;
  }
}
