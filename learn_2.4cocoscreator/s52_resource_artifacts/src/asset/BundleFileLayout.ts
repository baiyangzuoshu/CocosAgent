export interface BundleBases {
  base: string;
  importBase: string;
  nativeBase: string;
}

export interface AssetFile {
  uuid: string;
  importExtension: string;
  nativeExtension: string;
  version?: string;
  nativeVersion?: string;
}

export function resolveBundleUrl(bases: BundleBases, asset: AssetFile, native: boolean): string {
  const base = bases.base + (native ? bases.nativeBase : bases.importBase);
  const version = native ? asset.nativeVersion : asset.version;
  const extension = native ? asset.nativeExtension : asset.importExtension;
  const suffix = version ? `.${version}` : "";
  return `${base}${asset.uuid.slice(0, 2)}/${asset.uuid}${suffix}${extension}`;
}
