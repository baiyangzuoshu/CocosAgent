export class Asset {
  constructor(readonly uuid: string, readonly data: Record<string, unknown>) {}

  onLoaded(): void {
    // 资源加载完成钩子；不是 Component.onLoad。
  }
}
