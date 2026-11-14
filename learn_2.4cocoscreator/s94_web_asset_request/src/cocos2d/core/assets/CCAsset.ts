/** 精简版运行时 Asset；实际引擎还包含引用计数、销毁和更多序列化字段。 */
export class CCAsset {
  loaded = false;

  constructor(readonly uuid: string, readonly type: string, readonly data: Record<string, unknown>) {}

  onLoad(): void {
    this.loaded = true;
  }
}
