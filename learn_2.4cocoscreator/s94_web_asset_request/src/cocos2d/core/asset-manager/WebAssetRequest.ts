export interface AssetRecord {
  uuid: string;
  type: string;
  dependencies: string[];
}

export class WebAssetRequest {
  readonly cache = new Map<string, AssetRecord>();
  readonly trace: string[] = [];
  private readonly downloadedFiles = new Set<string>();

  constructor(private readonly records: Map<string, AssetRecord>) {}

  async load(uuid: string, url: string): Promise<AssetRecord> {
    const cached = this.cache.get(uuid);
    if (cached) {
      this.trace.push(`assets cache hit: ${uuid}`);
      return cached;
    }
    if (this.downloadedFiles.has(url)) {
      this.trace.push(`files cache hit: ${url}`);
    } else {
      this.trace.push(`GET ${url}`);
      await Promise.resolve();
      this.downloadedFiles.add(url);
    }
    const record = this.records.get(uuid);
    if (!record) throw new Error(`Asset 记录缺失: ${uuid}`);
    this.cache.set(uuid, record);
    this.trace.push(`deserialize ${record.type}: ${uuid}`);
    return record;
  }
}
