import { decodeUuid } from "./decodeUuid.ts";

export interface BundleBases {
  base: string;
  importBase: string;
  nativeBase: string;
}

function joinWebPath(parts: string[]): string {
  return parts.flatMap((part) => part.split("/")).filter(Boolean).join("/");
}

export function combine(bases: BundleBases, uuid: string, extension: string, version = "", native = false): string {
  const root = native ? bases.nativeBase : bases.importBase;
  const suffix = version ? `.${version}` : "";
  const fullUuid = decodeUuid(uuid);
  const path = joinWebPath([bases.base, root, fullUuid.slice(0, 2), `${fullUuid}${suffix}${extension}`]);
  return `/${path}`;
}

export function packPath(base: string, packUuid: string, version: string): string {
  const suffix = version ? `.${version}` : "";
  const path = joinWebPath([base, "import", packUuid.slice(0, 2), `${packUuid}${suffix}.json`]);
  return `/${path}`;
}
