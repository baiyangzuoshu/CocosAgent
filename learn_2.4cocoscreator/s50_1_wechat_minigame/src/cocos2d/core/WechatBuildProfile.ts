export type EngineBuildPhase = "editor" | "preview" | "build" | "test";

export interface WechatBuildFlags {
  debug: boolean;
  minigame: boolean;
  jsb: boolean;
  runtime: boolean;
}

export interface WechatBuildMacros {
  CC_BUILD: boolean;
  CC_DEBUG: boolean;
  CC_DEV: boolean;
  CC_JSB: boolean;
  CC_RUNTIME: boolean;
  CC_MINIGAME: boolean;
  CC_SUPPORT_JIT: boolean;
}

/** Models the values passed as gulp/util/utils.js flags for a minigame build. */
export function makeWechatBuildMacros(
  phase: EngineBuildPhase,
  flags: WechatBuildFlags,
): WechatBuildMacros {
  const dev = phase === "editor" || phase === "preview" || phase === "test";
  return {
    CC_BUILD: phase === "build",
    CC_DEBUG: flags.debug || dev,
    CC_DEV: dev,
    CC_JSB: flags.jsb,
    CC_RUNTIME: flags.runtime,
    CC_MINIGAME: flags.minigame,
    CC_SUPPORT_JIT: !(flags.runtime || flags.minigame),
  };
}

export function describeWechatBranches(macros: WechatBuildMacros): string[] {
  return [
    `compile-time target: CC_BUILD=${macros.CC_BUILD}, CC_MINIGAME=${macros.CC_MINIGAME}`,
    `execution environment: CC_JSB=${macros.CC_JSB}, CC_RUNTIME=${macros.CC_RUNTIME}`,
    `debug branch: ${macros.CC_DEBUG ? "kept" : "eligible for build-time removal"}`,
    `JIT default: ${macros.CC_SUPPORT_JIT ? "enabled" : "disabled for runtime/minigame"}`,
  ];
}
