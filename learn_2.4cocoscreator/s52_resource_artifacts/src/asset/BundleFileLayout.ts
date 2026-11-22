/** Executable subset of 2.4.15 asset-manager/config.js + urlTransformer.js. */
export interface BundleRecord {
  name: string;
  base: string;
  importBase: string;
  nativeBase: string;
  uuids: string[];
  // uuid -> [asset path, class id, optional sub-asset marker]
  paths?: Record<string, [string, string, true?]>;
  scenes?: Record<string, string>;
  packs?: Record<string, string[]>;
  versions?: { import?: string[]; native?: string[] };
  redirect?: Record<string, string>;
}
export interface AssetInfo {
  uuid: string;
  path?: string;
  type?: string;
  version?: string;
  nativeVersion?: string;
  redirect?: string;
  packs: string[];
}
export interface RequestItem {
  uuid: string;
  extension: string;
  native: boolean;
  info?: AssetInfo;
  nativeName?: string;
  url?: string;
}

const cleanJoin = (...parts: string[]): string => {
  const prefix = parts[0]?.startsWith("/") ? "/" : "";
  return prefix + parts.map((part) => part.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
};

export class BundleConfig {
  readonly assets = new Map<string, AssetInfo>();
  readonly paths = new Map<string, AssetInfo[]>();
  readonly scenes = new Map<string, AssetInfo>();
  readonly packContents = new Map<string, string[]>();

  constructor(readonly record: BundleRecord) { this.init(); }

  private init(): void {
    for (const uuid of this.record.uuids) this.assets.set(uuid, { uuid, packs: [] });
    for (const [uuid, [path, type, subAsset]] of Object.entries(this.record.paths ?? {})) {
      const info = this.requireAsset(uuid);
      info.path = path;
      info.type = type;
      const siblings = this.paths.get(path) ?? [];
      // Config._initPath puts the main asset before sub-assets for path lookup.
      if (subAsset) siblings.push(info); else siblings.unshift(info);
      this.paths.set(path, siblings);
    }
    for (const [sceneName, uuid] of Object.entries(this.record.scenes ?? {})) {
      this.scenes.set(sceneName, this.requireAsset(uuid));
    }
    for (const [packUuid, uuids] of Object.entries(this.record.packs ?? {})) {
      this.packContents.set(packUuid, uuids);
      this.assets.set(packUuid, { uuid: packUuid, packs: [], type: "pack", });
      for (const uuid of uuids) {
        const packs = this.requireAsset(uuid).packs;
        // Config._initPackage gives a single-asset pack priority in the lookup array.
        if (uuids.length === 1) packs.unshift(packUuid); else packs.push(packUuid);
      }
    }
    this.applyVersions("import", this.record.versions?.import);
    this.applyVersions("native", this.record.versions?.native);
    for (const [uuid, targetBundle] of Object.entries(this.record.redirect ?? {})) {
      this.requireAsset(uuid).redirect = targetBundle;
    }
  }

  private requireAsset(uuid: string): AssetInfo {
    const info = this.assets.get(uuid);
    if (!info) throw new Error(`Bundle ${this.record.name} has no UUID ${uuid}`);
    return info;
  }

  private applyVersions(kind: "import" | "native", pairs: string[] = []): void {
    if (pairs.length % 2 !== 0) throw new Error(`${kind} versions must be UUID/version pairs`);
    for (let i = 0; i < pairs.length; i += 2) {
      const info = this.requireAsset(pairs[i]);
      if (kind === "import") info.version = pairs[i + 1];
      else info.nativeVersion = pairs[i + 1];
    }
  }

  getInfoWithPath(path: string, type?: string): AssetInfo | undefined {
    return this.paths.get(path)?.find((info) => !type || info.type === type);
  }
  getSceneInfo(name: string): AssetInfo | undefined { return this.scenes.get(name); }
  getAssetInfo(uuid: string): AssetInfo | undefined { return this.assets.get(uuid); }
}

export function combineUrl(config: BundleConfig, item: RequestItem): string {
  if (item.url) return item.url;
  const info = item.info ?? config.getAssetInfo(item.uuid);
  const base = item.native
    ? cleanJoin(config.record.base, config.record.nativeBase)
    : cleanJoin(config.record.base, config.record.importBase);
  const version = item.native ? info?.nativeVersion : info?.version;
  const versionPart = version ? `.${version}` : "";
  const uuidPath = item.uuid.slice(0, 2);
  // urlTransformer.js special-cases fonts for the WeChat WebView loader.
  if (item.extension === ".ttf") {
    if (!item.nativeName) throw new Error(".ttf request requires nativeName (__nativeName__)");
    return `${cleanJoin(base, uuidPath, `${item.uuid}${versionPart}`)}/${item.nativeName}`;
  }
  return `${cleanJoin(base, uuidPath, `${item.uuid}${versionPart}${item.extension}`)}`;
}

export function resolvePath(config: BundleConfig, path: string, type?: string): AssetInfo {
  const info = config.getInfoWithPath(path, type);
  if (!info) throw new Error(`Bundle ${config.record.name} doesn't contain ${path}`);
  return info;
}
