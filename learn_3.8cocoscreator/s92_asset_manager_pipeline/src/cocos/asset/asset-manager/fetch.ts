export interface AssetFile {
  uuid: string;
  json: string;
}

export class Fetcher {
  constructor(private readonly files: Map<string, AssetFile>, private readonly trace: string[]) {}

  async fetch(uuid: string): Promise<AssetFile> {
    this.trace.push(`fetch ${uuid}`);
    await Promise.resolve();
    const file = this.files.get(uuid);
    if (!file) throw new Error(`找不到下载文件 ${uuid}`);
    return file;
  }
}
