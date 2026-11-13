import { decodeUuid } from "./decodeUuid.ts";

export interface VersionTable {
  import: Array<number | string>;
  native: Array<number | string>;
}

export class Config {
  constructor(
    readonly uuids: string[],
    readonly paths: Record<string, [string, number]>,
    readonly packs: Record<string, number[]>,
    readonly versions: VersionTable,
  ) {}

  getPathEntry(path: string): { index: number; uuid: string } | undefined {
    for (const [key, [assetPath]] of Object.entries(this.paths)) {
      if (assetPath === path) {
        const index = Number(key);
        return { index, uuid: decodeUuid(this.uuids[index]) };
      }
    }
    return undefined;
  }

  getPack(index: number): string | undefined {
    return Object.entries(this.packs).find(([, indices]) => indices.includes(index))?.[0];
  }

  getVersion(index: number | string, native: boolean): string {
    const entries = native ? this.versions.native : this.versions.import;
    for (let offset = 0; offset < entries.length; offset += 2) {
      if (entries[offset] === index) return String(entries[offset + 1]);
    }
    return "";
  }
}
