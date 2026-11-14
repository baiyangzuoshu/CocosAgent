export type FileKind = "import" | "native";

export interface AssetRecord {
  uuid: string;
  type: string;
  url: string;
  fileKind: FileKind;
}

/** A built file can contain one or more Asset entries, addressed by UUID. */
export interface AssetFile {
  url: string;
  resources: Map<string, string>;
}
