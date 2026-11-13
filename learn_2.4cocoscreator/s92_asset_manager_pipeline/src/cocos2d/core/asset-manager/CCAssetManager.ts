import { type AssetFile, Fetcher } from "./fetch.ts";
import { Loader } from "./load.ts";
import { Pipeline } from "./pipeline.ts";
import { CCAsset } from "../assets/CCAsset.ts";

export class CCAssetManager {
  readonly pipeline = new Pipeline(["preprocess", "load"]);
  readonly fetchPipeline = new Pipeline(["preprocess", "fetch"]);
  readonly transformPipeline = new Pipeline(["parse", "combine"]);
  readonly assets = new Map<string, CCAsset>();
  readonly downloaded = new Map<string, AssetFile>();

  constructor(private readonly files: Map<string, AssetFile>, readonly trace: string[]) {}

  async preloadAny(uuid: string): Promise<AssetFile> {
    this.trace.push(`pipeline: ${this.fetchPipeline.describe()}`);
    this.trace.push(`preprocess ${uuid}`);
    const file = await new Fetcher(this.files, this.trace).fetch(uuid);
    this.downloaded.set(uuid, file);
    return file;
  }

  async loadAny(uuid: string): Promise<CCAsset> {
    this.trace.push(`pipeline: ${this.pipeline.describe()}`);
    this.trace.push(`preprocess ${uuid}`);
    return new Loader(this.files, this.downloaded, this.assets, this.trace).load(uuid);
  }
}
