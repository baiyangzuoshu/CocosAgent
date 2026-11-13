import { decodeUuid } from "../../core/utils/decode-uuid.ts";

export interface ConfigData {
  uuids: string[];
  paths: Record<string, [string, number, number?]>;
  scenes: Record<string, number>;
  packs: Record<string, number[]>;
}

export class Config {
  constructor(readonly data: ConfigData) {}

  getScene(sceneName: string): { index: number; uuid: string } | undefined {
    const index = this.data.scenes[sceneName];
    return index === undefined ? undefined : { index, uuid: this.getUuid(index) };
  }

  getPathIndex(path: string): number | undefined {
    const entry = Object.entries(this.data.paths).find(([, [assetPath]]) => assetPath === path);
    return entry ? Number(entry[0]) : undefined;
  }

  getUuid(index: number): string {
    const uuid = this.data.uuids[index];
    if (!uuid) throw new Error(`Config 中没有 uuids[${index}]`);
    return decodeUuid(uuid);
  }

  getPack(index: number): string | undefined {
    return Object.entries(this.data.packs).find(([, indices]) => indices.includes(index))?.[0];
  }
}
