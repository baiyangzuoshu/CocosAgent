import { decodeUuid } from "../../core/utils/decode-uuid.ts";

export interface BundleBases {
  base: string;
  importBase: string;
  nativeBase: string;
}

function joinWebPath(parts: string[]): string {
  return parts.flatMap((part) => part.split("/")).filter(Boolean).join("/");
}

export function combine(bases: BundleBases, compressedUuid: string, extension: string, native: boolean): string {
  const uuid = decodeUuid(compressedUuid);
  const root = native ? bases.nativeBase : bases.importBase;
  const path = joinWebPath([bases.base, root, uuid.slice(0, 2), `${uuid}${extension}`]);
  return `/${path}`;
}

export function packPath(base: string, packUuid: string): string {
  const path = joinWebPath([base, "import", packUuid.slice(0, 2), `${packUuid}.json`]);
  return `/${path}`;
}
