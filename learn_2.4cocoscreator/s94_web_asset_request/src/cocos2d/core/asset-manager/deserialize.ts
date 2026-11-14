import { CCAsset } from "../assets/CCAsset.ts";

/** 把本课解析后的字段包装成一个最小运行时 Asset。 */
export function deserialize(uuid: string, type: string, data: Record<string, unknown>): CCAsset {
  return new CCAsset(uuid, type, data);
}
