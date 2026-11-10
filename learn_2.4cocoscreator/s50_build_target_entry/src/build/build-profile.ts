export type BuildMode = "debug" | "release";

export interface BuildProfile {
  engineVersion: "2.4.15";
  target: "web-desktop";
  mode: BuildMode;
}

export function selectBuildProfile(mode: BuildMode): BuildProfile {
  return { engineVersion: "2.4.15", target: "web-desktop", mode };
}
