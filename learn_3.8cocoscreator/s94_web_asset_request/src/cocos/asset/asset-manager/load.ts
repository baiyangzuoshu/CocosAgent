import { BundleConfig } from "./config.ts";
import { collectDependencies } from "./depend-util.ts";
import { deserialize } from "./deserialize.ts";
import { Fetcher } from "./fetch.ts";
import { Parser } from "./parser.ts";
import { createRequestItem } from "./request-item.ts";
import { Asset } from "../assets/asset.ts";
import type { PipelineTask } from "./types.ts";

/** load 阶段：取文件、解析条目、加载依赖，最后创建并缓存 Asset。 */
export class Loader {
  constructor(
    private readonly config: BundleConfig,
    private readonly fetcher: Fetcher,
    private readonly parser: Parser,
    private readonly assets: Map<string, Asset>,
    private readonly trace: string[],
  ) {}

  preprocess(task: PipelineTask): PipelineTask {
    const request = createRequestItem(this.config.getAsset(task.uuid));
    this.trace.push("preprocess: " + request.id + " → " + request.url);
    return { ...task, request };
  }

  async load(task: PipelineTask): Promise<PipelineTask> {
    const cached = this.assets.get(task.uuid);
    if (cached) {
      this.trace.push("Asset 缓存命中: " + cached.constructor.name + " " + task.uuid);
      return { ...task, asset: cached };
    }

    const prepared = task.request ? task : this.preprocess(task);
    const request = prepared.request;
    if (!request) throw new Error("请求没有 RequestItem: " + task.uuid);

    const file = await this.fetcher.fetch(request);
    const data = this.parser.parse(request, file);
    const dependencies = collectDependencies(data);
    this.trace.push(request.record.type + " 的依赖 UUID 数: " + dependencies.length);

    for (const dependency of dependencies) {
      await this.load({ uuid: dependency });
    }

    const asset = deserialize(request.uuid, request.record.type, data);
    asset.onLoaded();
    this.assets.set(request.uuid, asset);
    this.trace.push("创建并缓存 Asset: " + request.record.type + " " + request.uuid);
    return { ...prepared, file, asset };
  }
}
