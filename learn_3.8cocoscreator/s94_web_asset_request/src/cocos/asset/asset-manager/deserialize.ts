import { Asset } from "../assets/asset.ts";

/** 把本课解析后的字段包装成一个最小运行时 Asset。 */
export function deserialize(uuid: string, type: string, data: Record<string, unknown>): Asset {
  return new Asset(uuid, type, data);
}
