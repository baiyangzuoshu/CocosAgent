export interface BundleConfig {
  base: string;
  importBase: string;
}

export interface ImportRequest {
  uuid: string;
  version?: string;
  extension: string;
}

export function combine(config: BundleConfig, item: ImportRequest): string {
  const version = item.version ? "." + item.version : "";
  return config.base + config.importBase + "/" + item.uuid.slice(0, 2) + "/" + item.uuid + version + item.extension;
}
