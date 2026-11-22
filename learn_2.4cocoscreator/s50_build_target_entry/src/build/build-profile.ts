import {
  createBuildMacros,
  type BuildFlagInput,
  type BuildMacros,
  type BuildPlatform,
} from "../cocos2d/core/predefine.ts";

export type BuildMode = "debug" | "release";
export type ProjectTarget = "web-desktop" | "native-jsb";

/**
 * ProjectTarget describes the delivered project. BuildPlatform describes the
 * engine bundle phase passed to gulp/util/utils.js; they are not interchangeable.
 */
export interface BuildProfile {
  engineVersion: "2.4.15";
  target: ProjectTarget;
  platform: BuildPlatform;
  mode: BuildMode;
  flags: BuildFlagInput;
}

export interface BuildResult {
  profile: BuildProfile;
  macros: BuildMacros;
  compression: "development" | "release-web" | "release-jsb";
  debugBranch: "kept" | "removed";
}

export function createBuildProfile(
  target: ProjectTarget,
  mode: BuildMode,
): BuildProfile {
  const isNative = target === "native-jsb";
  return {
    engineVersion: "2.4.15",
    target,
    platform: "build",
    mode,
    flags: {
      debug: mode === "debug",
      jsb: isNative,
      nativeRenderer: isNative,
    },
  };
}

/** Mirrors the macro input and release/debug split used by the engine gulp tools. */
export function buildProfile(
  target: ProjectTarget,
  mode: BuildMode,
): BuildResult {
  const profile = createBuildProfile(target, mode);
  const macros = createBuildMacros(profile.platform, profile.flags);
  const compression = macros.CC_DEBUG
    ? "development"
    : macros.CC_JSB
    ? "release-jsb"
    : "release-web";
  return {
    profile,
    macros,
    compression,
    debugBranch: macros.CC_DEBUG ? "kept" : "removed",
  };
}

/** Preview is a separate engine phase; CC_DEV makes CC_DEBUG true in this phase. */
export function createPreviewMacros(): BuildMacros {
  return createBuildMacros("preview", { debug: false });
}
