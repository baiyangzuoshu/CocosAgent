export type BuildMode = "debug" | "release";

export interface BuildProfile {
  engineVersion: "3.8.7";
  target: "web-desktop";
  mode: BuildMode;
}

export function selectBuildProfile(mode: BuildMode): BuildProfile {
  return { engineVersion: "3.8.7", target: "web-desktop", mode };
}
