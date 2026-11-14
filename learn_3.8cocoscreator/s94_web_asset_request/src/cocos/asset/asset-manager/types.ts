import type { Asset } from "../assets/asset.ts";

export type FileKind = "import" | "native";

/** Bundle Config 已解析出的一个 UUID 记录；URL 来自第 93 课的查表结果。 */
export interface AssetRecord {
  uuid: string;
  type: string;
  url: string;
  fileKind: FileKind;
}

/** 教学用文件：一个 import pack 可以包含多个 UUID 条目。 */
export interface AssetFile {
  url: string;
  resources: Map<string, string>;
}

export interface BundleConfigData {
  scenes: Record<string, string>;
  assets: Map<string, AssetRecord>;
}

export interface PipelineTask {
  uuid: string;
  request?: RequestItem;
  file?: AssetFile;
  asset?: Asset;
}

export interface RequestItem {
  id: string;
  uuid: string;
  type: FileKind;
  url: string;
  record: AssetRecord;
}
