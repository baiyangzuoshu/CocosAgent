export type BuildMode = "debug" | "release";

export interface EngineBundlePlan {
  entry: string;
  output: string;
  macros: { CC_BUILD: boolean; CC_DEBUG: boolean; CC_JSB: boolean };
  stages: string[];
}

export function createEngineBundlePlan(mode: BuildMode): EngineBundlePlan {
  return {
    entry: "<sourceFile supplied by caller>",
    output: "<outputFile supplied by caller>",
    macros: { CC_BUILD: true, CC_DEBUG: mode === "debug", CC_JSB: false },
    stages: [
      "Browserify: resolve entry imports; exclude default skips and configured modules",
      "Terser: specialize code with build macros",
      "Optimizejs: optimize the bundled JavaScript",
      "Gulp.dest: write the caller-selected output file",
    ],
  };
}
