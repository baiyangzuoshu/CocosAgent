import type { AssetFile, RequestItem } from "./types.ts";

/** 从文件中按 UUID 取出一个资源条目；import 与 native 使用不同读法。 */
export class Parser {
  constructor(private readonly trace: string[]) {}

  parse(request: RequestItem, file: AssetFile): Record<string, unknown> {
    const entry = file.resources.get(request.uuid);
    if (entry === undefined) throw new Error("文件中没有 UUID: " + request.uuid);

    if (request.type === "import") {
      this.trace.push("parser.parse(import): " + request.uuid);
      return JSON.parse(entry) as Record<string, unknown>;
    }

    this.trace.push("parser.parse(native): " + request.record.type);
    return { name: entry };
  }
}
