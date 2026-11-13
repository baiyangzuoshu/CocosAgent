import { decodeUuid } from "./decodeUuid.ts";

export interface VersionTable {
  import: Array<number | string>;
  native: Array<number | string>;
}

export interface ConfigData {
  uuids: string[];
  paths: Record<string, [string, number]>;
  scenes: Record<string, number>;
  packs: Record<string, number[]>;
  versions: VersionTable;
}

export class Config {
  constructor(readonly data: ConfigData) {}

  getScene(sceneName: string): { index: number; uuid: string } | undefined {
    const index = this.data.scenes[sceneName];
    return index === undefined ? undefined : { index, uuid: this.getUuid(index) };
  }

  getPathEntry(path: string): { index: number; uuid: string } | undefined {
    for (const [key, [assetPath]] of Object.entries(this.data.paths)) {
      if (assetPath === path) {
        const index = Number(key);
        return { index, uuid: this.getUuid(index) };
      }
    }
    return undefined;
  }

  getUuid(index: number): string {
    const uuid = this.data.uuids[index];
    if (!uuid) throw new Error(`Config 中没有 uuids[${index}]`);
    return decodeUuid(uuid);
  }

  getPack(index: number): string | undefined {
    return Object.entries(this.data.packs).find(([, indices]) => indices.includes(index))?.[0];
  }

  getVersion(key: number | string, native: boolean): string {
    const entries = native ? this.data.versions.native : this.data.versions.import;
    for (let offset = 0; offset < entries.length; offset += 2) {
      if (entries[offset] === key) return String(entries[offset + 1]);
    }
    return "";
  }
}
