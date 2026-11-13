export class CCAsset {
  loaded = true;

  constructor(readonly _uuid: string, readonly data: Record<string, unknown>) {}

  onLoad(): void {
    // 资源加载完成钩子；不是 Component.onLoad。
  }
}
