import { deserialize } from "./deserialize.ts";
import { getDependencies } from "./depend-util.ts";
import { parseAssetData } from "./parser.ts";
import { Fetcher } from "./fetch.ts";
import { CCAsset } from "../assets/CCAsset.ts";
import type { AssetFile, AssetRecord } from "./types.ts";
import type { PipelineTask } from "./pipeline.ts";

export class Loader {
  private readonly fetcher: Fetcher;

  constructor(
    private readonly records: Map<string, AssetRecord>,
    files: Map<string, AssetFile>,
    private readonly downloaded: Map<string, AssetFile>,
    private readonly assets: Map<string, CCAsset>,
    private readonly trace: string[],
  ) {
    this.fetcher = new Fetcher(files, downloaded, trace);
  }

  async preprocess(task: PipelineTask): Promise<PipelineTask> {
    if (!task.uuid) throw new Error("请求缺少 UUID");
    const record = this.requireRecord(task.uuid);
    this.trace.push("preprocess: " + record.type + " → " + record.url);
    return { ...task, record };
  }

  /** fetch 阶段取当前文件，并沿序列化数据递归预取依赖文件。 */
  async fetch(task: PipelineTask): Promise<PipelineTask> {
    const record = task.record ?? this.requireRecord(task.uuid);
    const file = await this.fetchTree(record, new Set<string>());
    return { ...task, record, file };
  }

  private async fetchTree(record: AssetRecord, visited: Set<string>): Promise<AssetFile> {
    const cachedFile = this.downloaded.get(record.url);
    if (visited.has(record.uuid)) {
      if (!cachedFile) throw new Error("依赖循环中缺少文件 " + record.url);
      return cachedFile;
    }
    visited.add(record.uuid);

    const file = await this.fetcher.fetch(record);
    if (record.fileKind === "import") {
      const data = parseAssetData(record, file, this.trace, true);
      for (const dependency of getDependencies(data)) {
        await this.fetchTree(this.requireRecord(dependency), visited);
      }
    }
    return file;
  }

  async load(task: PipelineTask): Promise<PipelineTask> {
    const { uuid } = task;
    const cached = this.assets.get(uuid);
    if (cached) {
      this.trace.push("Asset 缓存命中 " + cached.type);
      return { ...task, asset: cached };
    }

    const record = task.record ?? this.requireRecord(uuid);
    const fetched = task.file ? task : await this.fetch({ ...task, record });
    const file = fetched.file;
    if (!file) throw new Error("文件尚未取得: " + uuid);

    const data = parseAssetData(record, file, this.trace, false);
    const dependencies = getDependencies(data);
    const dependencyNames = dependencies.map((id) => this.requireRecord(id).type);
    this.trace.push(record.type + " 依赖: " + (dependencyNames.length ? dependencyNames.join(", ") : "无"));
    for (const dependency of dependencies) {
      await this.load({ uuid: dependency });
    }

    const asset = deserialize(uuid, record.type, data, this.trace);
    asset.onLoad();
    this.trace.push("Asset.onLoad " + record.type);
    this.assets.set(uuid, asset);
    return { ...fetched, asset };
  }

  private requireRecord(uuid: string): AssetRecord {
    const record = this.records.get(uuid);
    if (!record) throw new Error("Bundle 索引中找不到 UUID " + uuid);
    return record;
  }
}
