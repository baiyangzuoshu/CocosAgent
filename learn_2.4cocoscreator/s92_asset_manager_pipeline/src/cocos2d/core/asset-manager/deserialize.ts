import { CCAsset } from "../assets/CCAsset.ts";

export function deserialize(uuid: string, data: Record<string, unknown>, trace: string[]): CCAsset {
  trace.push("deserialize → CCAsset");
  return new CCAsset(uuid, data);
}
