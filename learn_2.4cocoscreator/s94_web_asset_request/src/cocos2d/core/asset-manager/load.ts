import { CCAsset } from "../assets/CCAsset.ts";
import { Fetcher } from "./fetch.ts";
import { Parser } from "./parser.ts";
import type { AssetRecord } from "./types.ts";

/** 负责缓存检查、文件准备、依赖递归和 Asset 创建。 */
export class LoadPipeline {
  readonly assets = new Map<string, CCAsset>();

  constructor(
    private readonly records: Map<string, AssetRecord>,
    private readonly fetcher: Fetcher,
    private readonly parser: Parser,
    private readonly trace: string[],
  ) {}

  async load(uuid: string): Promise<CCAsset> {
    const cached = this.assets.get(uuid);
    if (cached) {
      this.trace.push(`Asset 缓存命中: ${uuid}`);
      return cached;
    }

    const record = this.records.get(uuid);
    if (!record) throw new Error(`Bundle 数据中找不到 Asset: ${uuid}`);

    // 先准备并解析当前资源文件，再递归加载它引用的资源。
    await this.fetcher.fetch(record);
    this.parser.parse(record);

    for (const dependencyUuid of record.dependencies) {
      this.trace.push(`${record.type} 依赖 ${dependencyUuid}`);
      await this.load(dependencyUuid);
    }

    const asset = new CCAsset(record.uuid, record.type);
    this.assets.set(uuid, asset);
    this.trace.push(`创建并缓存 Asset: ${record.type} ${uuid}`);
    return asset;
  }
}
