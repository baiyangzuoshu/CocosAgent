export type ResourceFileKind = "import" | "native";

/** 本课从 Bundle Config 中摘出的单个资源记录。 */
export interface AssetRecord {
  uuid: string;
  type: string;
  dependencies: string[];
  url: string;
  fileKind: ResourceFileKind;
}
