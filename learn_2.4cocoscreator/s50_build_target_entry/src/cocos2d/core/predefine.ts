export type BuildPlatform = "editor" | "preview" | "build" | "test";

/** These flags follow the accepted flag names in engine/gulp/util/utils.js. */
export interface BuildFlagInput {
  support_jit?: boolean;
  jsb?: boolean;
  runtime?: boolean;
  debug?: boolean;
  nativeRenderer?: boolean;
  minigame?: boolean;
  physics_builtin?: boolean;
  physics_cannon?: boolean;
  force_setting_support_jit?: boolean;
}

export interface BuildMacros {
  CC_EDITOR: boolean;
  CC_PREVIEW: boolean;
  CC_BUILD: boolean;
  CC_TEST: boolean;
  CC_SUPPORT_JIT: boolean;
  CC_JSB: boolean;
  CC_RUNTIME: boolean;
  CC_DEBUG: boolean;
  CC_NATIVERENDERER: boolean;
  CC_MINIGAME: boolean;
  CC_PHYSICS_BUILTIN: boolean;
  CC_PHYSICS_CANNON: boolean;
  CC_DEV: boolean;
}

const PLATFORM_MACROS: Record<BuildPlatform, keyof BuildMacros> = {
  editor: "CC_EDITOR",
  preview: "CC_PREVIEW",
  build: "CC_BUILD",
  test: "CC_TEST",
};

const FLAG_MACROS: Record<Exclude<keyof BuildFlagInput, "force_setting_support_jit">, keyof BuildMacros> = {
  support_jit: "CC_SUPPORT_JIT",
  jsb: "CC_JSB",
  runtime: "CC_RUNTIME",
  debug: "CC_DEBUG",
  nativeRenderer: "CC_NATIVERENDERER",
  minigame: "CC_MINIGAME",
  physics_builtin: "CC_PHYSICS_BUILTIN",
  physics_cannon: "CC_PHYSICS_CANNON",
};

/**
 * Teaching implementation of engine/gulp/util/utils.js:getMacros.
 * The editor build package itself is outside this engine source snapshot.
 */
export function createBuildMacros(
  platform: BuildPlatform,
  flags: BuildFlagInput = {},
): BuildMacros {
  const macros: BuildMacros = {
    CC_EDITOR: false,
    CC_PREVIEW: false,
    CC_BUILD: false,
    CC_TEST: false,
    CC_SUPPORT_JIT: false,
    CC_JSB: false,
    CC_RUNTIME: false,
    CC_DEBUG: false,
    CC_NATIVERENDERER: false,
    CC_MINIGAME: false,
    CC_PHYSICS_BUILTIN: false,
    CC_PHYSICS_CANNON: false,
    CC_DEV: false,
  };

  macros[PLATFORM_MACROS[platform]] = true;
  for (const [flag, macro] of Object.entries(FLAG_MACROS)) {
    macros[macro] = Boolean(flags[flag as keyof BuildFlagInput]);
  }

  macros.CC_DEV = macros.CC_EDITOR || macros.CC_PREVIEW || macros.CC_TEST;
  macros.CC_DEBUG = macros.CC_DEBUG || macros.CC_DEV;
  macros.CC_SUPPORT_JIT = flags.force_setting_support_jit !== undefined
    ? flags.force_setting_support_jit
    : !(macros.CC_RUNTIME || macros.CC_MINIGAME);
  // Creator 2.4.15's gulp utility derives this macro from JSB.
  macros.CC_NATIVERENDERER = macros.CC_JSB;
  return macros;
}

export function evaluateDebugBranch(macros: BuildMacros): string {
  return macros.CC_DEBUG
    ? "debug branch remains available"
    : "debug branch is removed during macro-based compression";
}
