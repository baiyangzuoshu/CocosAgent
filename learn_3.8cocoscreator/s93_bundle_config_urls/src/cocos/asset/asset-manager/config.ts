import { decodeUuid } from "../../core/utils/decode-uuid.ts";

export interface PathRecord {
  index: number;
  path: string;
}

export class Config {
  constructor(
    readonly uuids: string[],
    readonly paths: Record<string, [string, number, number?]>,
    readonly packs: Record<string, number[]>,
  ) {}

  getSceneIndex(path: string): number | undefined {
    const entry = Object.entries(this.paths).find(([, [assetPath]]) => assetPath === path);
    return entry ? Number(entry[0]) : undefined;
  }

  getUuid(index: number): string {
    return decodeUuid(this.uuids[index]);
  }

  getPack(index: number): string | undefined {
    return Object.entries(this.packs).find(([, indices]) => indices.includes(index))?.[0];
  }
}
