/** 精简版运行时 Asset；实际引擎还包含引用计数、销毁和序列化字段。 */
export class CCAsset {
  constructor(readonly uuid: string, readonly type: string) {}
}
