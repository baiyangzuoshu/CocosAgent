import type { AssetFile, AssetRecord } from "./types.ts";

export class Fetcher {
  constructor(
    private readonly files: Map<string, AssetFile>,
    private readonly downloaded: Map<string, AssetFile>,
    private readonly trace: string[],
  ) {}

  async fetch(record: AssetRecord): Promise<AssetFile> {
    const cached = this.downloaded.get(record.url);
    if (cached) {
      this.trace.push("文件缓存命中 " + record.url);
      return cached;
    }

    this.trace.push("GET " + record.url);
    await Promise.resolve();
    const file = this.files.get(record.url);
    if (!file) throw new Error("找不到文件 " + record.url);
    this.downloaded.set(record.url, file);
    return file;
  }
}
