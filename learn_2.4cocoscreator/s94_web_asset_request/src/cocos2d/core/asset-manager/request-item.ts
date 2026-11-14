import type { AssetRecord, RequestItem } from "./types.ts";

/** Runtime 用请求类型区分同一资源的 import/native 数据。 */
export function createRequestItem(record: AssetRecord): RequestItem {
  return {
    id: record.uuid + "@" + record.fileKind,
    uuid: record.uuid,
    type: record.fileKind,
    url: record.url,
    record,
  };
}
