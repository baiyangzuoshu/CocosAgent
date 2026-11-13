import type { AssetRecord } from "./types.ts";

/** import pack 和 native 文件走不同的解析分支。 */
export class Parser {
  private readonly parsedImportUrls = new Set<string>();

  constructor(private readonly trace: string[]) {}

  parse(record: AssetRecord): void {
    if (record.fileKind === "import") {
      if (this.parsedImportUrls.has(record.url)) {
        this.trace.push(`从已解析的 pack 取出: ${record.type}`);
      } else {
        this.trace.push(`解析 import pack: ${record.url}`);
        this.parsedImportUrls.add(record.url);
      }
      return;
    }

    this.trace.push(`解析 native ${record.type}: ${record.url}`);
  }
}
