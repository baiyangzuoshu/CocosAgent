export interface SubMeta {
  uuid: string;
  importer: string;
  rawTextureUuid?: string;
}

export interface AssetMeta {
  uuid: string;
  importer: string;
  subMetas: Record<string, SubMeta>;
  isBundle?: boolean;
}

export function findSource(metaFiles: AssetMeta[], uuid: string): string | undefined {
  for (const meta of metaFiles) {
    if (meta.uuid === uuid) return `主资源 ${meta.importer}`;
    for (const [name, subMeta] of Object.entries(meta.subMetas)) {
      if (subMeta.uuid === uuid) return `子资源 ${name} (${subMeta.importer})`;
    }
  }
  return undefined;
}
