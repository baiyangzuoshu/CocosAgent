import type { BuildMode } from "../../build/build-profile.ts";

export interface BuildMacros {
  CC_BUILD: boolean;
  CC_DEBUG: boolean;
  CC_JSB: boolean;
}

export function createBuildMacros(mode: BuildMode): BuildMacros {
  return {
    CC_BUILD: true,
    CC_DEBUG: mode === "debug",
    CC_JSB: false,
  };
}
