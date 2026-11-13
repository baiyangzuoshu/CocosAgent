import { Asset } from "../assets/asset.ts";

export function deserialize(uuid: string, data: Record<string, unknown>, trace: string[]): Asset {
  trace.push("deserialize → Asset");
  return new Asset(uuid, data);
}
