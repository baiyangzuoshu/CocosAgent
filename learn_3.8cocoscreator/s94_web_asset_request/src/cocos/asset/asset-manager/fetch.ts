import type { AssetFile, RequestItem } from "./types.ts";

/** 课堂中的下载器：用文件 Map 代替浏览器网络，并按 URL 复用已下载文件。 */
export class Fetcher {
  constructor(
    private readonly files: Map<string, AssetFile>,
    private readonly downloaded: Map<string, AssetFile>,
    private readonly trace: string[],
  ) {}

  async fetch(request: RequestItem): Promise<AssetFile> {
    const cached = this.downloaded.get(request.url);
    if (cached) {
      this.trace.push("文件缓存命中: " + request.url);
      return cached;
    }

    this.trace.push("GET " + request.url);
    await Promise.resolve();
    const file = this.files.get(request.url);
    if (!file) throw new Error("文件不存在: " + request.url);
    this.downloaded.set(request.url, file);
    return file;
  }
}
