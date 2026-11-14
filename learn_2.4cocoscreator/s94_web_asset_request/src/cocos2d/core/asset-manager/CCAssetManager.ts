import { Bundle } from "./bundle.ts";
import { BundleConfig } from "./config.ts";
import { Fetcher } from "./fetch.ts";
import { Loader } from "./load.ts";
import { Parser } from "./parser.ts";
import { Pipeline } from "./pipeline.ts";
import type { AssetFile, BundleConfigData, PipelineTask } from "./types.ts";
import { CCAsset } from "../assets/CCAsset.ts";

/** AssetManager 组装 Bundle、请求管线、文件缓存和 Asset 缓存。 */
export class CCAssetManager {
  readonly trace: string[] = [];
  readonly assets = new Map<string, CCAsset>();
  readonly downloaded = new Map<string, AssetFile>();
  readonly config: BundleConfig;
  readonly bundle: Bundle;
  private readonly pipeline: Pipeline;

  constructor(configData: BundleConfigData, files: Map<string, AssetFile>) {
    this.config = new BundleConfig(configData);
    const fetcher = new Fetcher(files, this.downloaded, this.trace);
    const parser = new Parser(this.trace);
    const loader = new Loader(this.config, fetcher, parser, this.assets, this.trace);
    this.pipeline = new Pipeline(loader, this.trace);
    this.bundle = new Bundle(this.config, (uuid) => this.loadAny(uuid), this.trace);
  }

  async loadAny(uuid: string): Promise<CCAsset> {
    const result: PipelineTask = await this.pipeline.run(uuid);
    if (!result.asset) throw new Error("load 管线没有返回 Asset: " + uuid);
    return result.asset;
  }

  loadScene(path: string): Promise<CCAsset> {
    return this.bundle.loadScene(path);
  }
}
