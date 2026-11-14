import type { AssetFile, AssetRecord } from "./types.ts";

/** preload 扫描依赖字段；正常 load 才解析资源数据。 */
export function parseAssetData(
  record: AssetRecord,
  file: AssetFile,
  trace: string[],
  dependencyScan: boolean,
): Record<string, unknown> {
  const serialized = file.resources.get(record.uuid);
  if (serialized === undefined) throw new Error("文件中没有 UUID " + record.uuid);

  if (record.fileKind === "native") {
    if (!dependencyScan) trace.push("parser.parse(native) " + record.type);
    return { name: serialized, dependencies: [] };
  }

  trace.push(dependencyScan
    ? "depend-util 读取依赖 " + record.type
    : "parser.parse(import) " + record.type);
  return JSON.parse(serialized) as Record<string, unknown>;
}
