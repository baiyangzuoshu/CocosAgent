export interface SubMeta { uuid: string; importer: string; rawTextureUuid?: string; }
export interface AssetMeta { uuid: string; importer: string; subMetas: Record<string, SubMeta>; isBundle?: boolean; }
export interface AssetIdentity { uuid: string; importer: string; kind: "main" | "sub"; ownerUuid: string; name?: string; rawTextureUuid?: string; }

/** Maps the stable .meta UUID namespace, including generated sub-assets. */
export class AssetMetaIndex {
  private readonly byUuid = new Map<string, AssetIdentity>();
  constructor(readonly files: readonly AssetMeta[]) {
    for (const meta of files) {
      this.add({ uuid: meta.uuid, importer: meta.importer, kind: "main", ownerUuid: meta.uuid });
      for (const [name, subMeta] of Object.entries(meta.subMetas)) {
        this.add({ uuid: subMeta.uuid, importer: subMeta.importer, kind: "sub", ownerUuid: meta.uuid, name, rawTextureUuid: subMeta.rawTextureUuid });
      }
    }
  }
  private add(identity: AssetIdentity): void {
    const previous = this.byUuid.get(identity.uuid);
    if (previous) throw new Error(`duplicate UUID ${identity.uuid}: ${previous.importer} and ${identity.importer}`);
    this.byUuid.set(identity.uuid, identity);
  }
  find(uuid: string): AssetIdentity | undefined { return this.byUuid.get(uuid); }
  findOwner(uuid: string): AssetMeta | undefined {
    const identity = this.find(uuid);
    return identity && this.files.find((file) => file.uuid === identity.ownerUuid);
  }
  validateReferences(): string[] {
    const issues: string[] = [];
    for (const identity of this.byUuid.values()) {
      if (identity.rawTextureUuid && !this.byUuid.has(identity.rawTextureUuid)) issues.push(`${identity.uuid} references unknown rawTextureUuid ${identity.rawTextureUuid}`);
    }
    return issues;
  }
  get size(): number { return this.byUuid.size; }
}

export function findSource(metaFiles: AssetMeta[], uuid: string): string | undefined {
  const identity = new AssetMetaIndex(metaFiles).find(uuid);
  if (!identity) return undefined;
  return identity.kind === "main"
    ? `主资源 ${identity.importer}`
    : `子资源 ${identity.name} (${identity.importer})，归属主 UUID ${identity.ownerUuid}`;
}
