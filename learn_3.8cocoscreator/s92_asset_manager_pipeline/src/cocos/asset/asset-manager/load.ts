import { deserialize } from "./deserialize.ts";
import { parseImport } from "./parser.ts";
import { type AssetFile, Fetcher } from "./fetch.ts";
import { Asset } from "../assets/asset.ts";

export class Loader {
  constructor(
    private readonly files: Map<string, AssetFile>,
    private readonly downloaded: Map<string, AssetFile>,
    private readonly assets: Map<string, Asset>,
    private readonly trace: string[],
  ) {}

  async load(uuid: string): Promise<Asset> {
    const cached = this.assets.get(uuid);
    if (cached) {
      this.trace.push(`cache hit ${uuid}`);
      return cached;
    }
    const file = this.downloaded.get(uuid) ?? await new Fetcher(this.files, this.trace).fetch(uuid);
    this.downloaded.set(uuid, file);
    const data = parseImport(file, this.trace);
    for (const dependency of (data.dependencies as string[] | undefined) ?? []) {
      await this.load(dependency);
    }
    const asset = deserialize(uuid, data, this.trace);
    asset.onLoaded();
    this.trace.push(`Asset.onLoaded ${uuid}`);
    this.assets.set(uuid, asset);
    return asset;
  }
}
