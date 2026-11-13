import { deserialize } from "./deserialize.ts";
import { getDependencies } from "./depend-util.ts";
import { parseImport } from "./parser.ts";
import { type AssetFile, Fetcher } from "./fetch.ts";
import { Asset } from "../assets/asset.ts";
import type { PipelineTask } from "./pipeline.ts";

export class Loader {
  constructor(
    private readonly files: Map<string, AssetFile>,
    private readonly downloaded: Map<string, AssetFile>,
    private readonly assets: Map<string, Asset>,
    private readonly trace: string[],
  ) {}

  async preprocess(task: PipelineTask): Promise<PipelineTask> {
    if (!task.uuid) throw new Error("請求缺少 UUID");
    this.trace.push(`preprocess: 接收 UUID ${task.uuid}`);
    return task;
  }

  async fetch(task: PipelineTask): Promise<PipelineTask> {
    const cachedFile = this.downloaded.get(task.uuid);
    if (cachedFile) {
      this.trace.push(`download cache hit ${task.uuid}`);
      return { ...task, file: cachedFile };
    }
    const file = await new Fetcher(this.files, this.trace).fetch(task.uuid);
    this.downloaded.set(task.uuid, file);
    return { ...task, file };
  }

  async load(task: PipelineTask): Promise<PipelineTask> {
    const { uuid } = task;
    const cached = this.assets.get(uuid);
    if (cached) {
      this.trace.push(`cache hit ${uuid}`);
      return { ...task, asset: cached };
    }
    const fetched = task.file ? task : await this.fetch(task);
    const file = fetched.file;
    if (!file) throw new Error(`文件尚未取得: ${uuid}`);
    const data = parseImport(file, this.trace);
    const dependencies = getDependencies(data);
    this.trace.push(`依赖 ${uuid}: ${dependencies.length ? dependencies.join(", ") : "无"}`);
    for (const dependency of dependencies) {
      await this.load({ uuid: dependency });
    }
    const asset = deserialize(uuid, data, this.trace);
    asset.onLoaded();
    this.trace.push(`Asset.onLoaded ${uuid} → loaded=${asset.loaded}`);
    this.assets.set(uuid, asset);
    return { ...fetched, asset };
  }
}
