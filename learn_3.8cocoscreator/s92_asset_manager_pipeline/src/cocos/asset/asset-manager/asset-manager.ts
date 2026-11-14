import type { AssetFile, AssetRecord } from "./types.ts";
import { Loader } from "./load.ts";
import { Pipeline } from "./pipeline.ts";
import { Asset } from "../assets/asset.ts";

export class AssetManager {
  readonly pipeline: Pipeline;
  readonly fetchPipeline: Pipeline;
  readonly assets = new Map<string, Asset>();
  readonly downloaded = new Map<string, AssetFile>();
  private readonly loader: Loader;

  constructor(records: Map<string, AssetRecord>, files: Map<string, AssetFile>, readonly trace: string[]) {
    this.loader = new Loader(records, files, this.downloaded, this.assets, trace);
    this.pipeline = new Pipeline("load", [
      { name: "preprocess", run: (task) => this.loader.preprocess(task) },
      { name: "load", run: (task) => this.loader.load(task) },
    ], trace);
    this.fetchPipeline = new Pipeline("preload", [
      { name: "preprocess", run: (task) => this.loader.preprocess(task) },
      { name: "fetch", run: (task) => this.loader.fetch(task) },
    ], trace);
  }

  async preloadAny(uuid: string): Promise<AssetFile> {
    const result = await this.fetchPipeline.run(uuid);
    if (!result.file) throw new Error("预加载没有返回文件: " + uuid);
    return result.file;
  }

  async loadAny(uuid: string): Promise<Asset> {
    const result = await this.pipeline.run(uuid);
    if (!result.asset) throw new Error("加载没有返回 Asset: " + uuid);
    return result.asset;
  }
}
