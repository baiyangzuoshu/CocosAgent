import { Fetcher } from "./fetch.ts";
import { LoadPipeline } from "./load.ts";
import { Parser } from "./parser.ts";
import type { AssetRecord } from "./types.ts";

/** 对外提供 load；内部把职责交给 Fetcher、Parser 和 LoadPipeline。 */
export class AssetManager {
  readonly trace: string[] = [];
  private readonly fetcher = new Fetcher(this.trace);
  private readonly parser = new Parser(this.trace);
  private readonly pipeline: LoadPipeline;

  constructor(records: Map<string, AssetRecord>) {
    this.pipeline = new LoadPipeline(records, this.fetcher, this.parser, this.trace);
  }

  get assets() {
    return this.pipeline.assets;
  }

  load(uuid: string) {
    return this.pipeline.load(uuid);
  }
}
