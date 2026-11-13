export interface SubMeta {
  uuid: string;
  importer: string;
}

export interface AssetMeta {
  uuid: string;
  importer: string;
  imported: boolean;
  subMetas: Record<string, SubMeta>;
  userData?: Record<string, unknown>;
}

export function findSource(meta: AssetMeta, uuid: string): string | undefined {
  if (meta.uuid === uuid) return `主资源 ${meta.importer}`;
  for (const [subId, subMeta] of Object.entries(meta.subMetas)) {
    if (subMeta.uuid === uuid) return `子资源 @${subId} (${subMeta.importer})`;
  }
  return undefined;
}
