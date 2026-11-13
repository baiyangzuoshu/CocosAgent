import type { AssetRecord } from "./types.ts";

/** 模拟文件取得边界；真实 Creator Web 由 downloader 发起网络请求。 */
export class Fetcher {
  private readonly downloadedUrls = new Set<string>();

  constructor(private readonly trace: string[]) {}

  async fetch(record: AssetRecord): Promise<void> {
    if (this.downloadedUrls.has(record.url)) {
      this.trace.push(`文件缓存命中: ${record.url}`);
      return;
    }

    this.trace.push(`GET ${record.url}`);
    await Promise.resolve();
    this.downloadedUrls.add(record.url);
  }
}
