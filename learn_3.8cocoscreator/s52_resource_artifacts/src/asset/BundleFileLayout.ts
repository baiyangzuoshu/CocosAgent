export interface BundleBases {
  base: string;
  importBase: string;
  nativeBase: string;
}

export interface AssetFile {
  uuid: string;
  importExtension?: string;
  nativeExtension: string;
  version?: string;
  nativeVersion?: string;
  overrideUuid?: string;
}

export function resolveBundleUrl(bases: BundleBases, asset: AssetFile, native: boolean): string {
  const base = bases.base + (native ? bases.nativeBase : bases.importBase);
  const uuid = asset.overrideUuid ?? asset.uuid;
  const version = native ? asset.nativeVersion : asset.version;
  const extension = native ? asset.nativeExtension : (asset.importExtension ?? ".json");
  const suffix = version ? `.${version}` : "";
  return `${base}${uuid.slice(0, 2)}/${uuid}${suffix}${extension}`;
}
