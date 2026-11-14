export class CCAsset {
  loaded = false;

  constructor(readonly _uuid: string, readonly type: string, readonly data: Record<string, unknown>) {}

  onLoad(): void {
    // Asset 加载完成钩子；不是 Component.onLoad。
    this.loaded = true;
  }
}
