export interface BundleConfig {
  base: string;
  importBase: string;
}

export interface ImportRequest {
  uuid: string;
  overrideUuid?: string;
  version?: string;
  extension: string;
}

export function combine(config: BundleConfig, item: ImportRequest): string {
  const uuid = item.overrideUuid || item.uuid;
  const version = item.version ? "." + item.version : "";
  return config.base + config.importBase + "/" + uuid.slice(0, 2) + "/" + uuid + version + item.extension;
}
