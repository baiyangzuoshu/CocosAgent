export type JsbTask = "build-jsb-dev" | "build-jsb-min" | "build-jsb-preview";

export interface NativeEnginePlan {
  task: JsbTask;
  entry: "./index.js";
  output: string;
  engineBuilder: "buildJsb" | "buildJsbMin" | "buildJsbPreview";
  nativeRenderer: boolean;
  phases: readonly string[];
}

/** Models gulpfile.js JSB tasks; the external Editor project builder is separate. */
export function makeNativeEnginePlan(
  task: JsbTask,
  args: readonly string[] = [],
): NativeEnginePlan {
  const nativeRenderer = task !== "build-jsb-preview" && args.includes("--native-renderer");
  if (task === "build-jsb-dev") {
    return {
      task,
      entry: "./index.js",
      output: "./bin/cocos2d-jsb.js",
      engineBuilder: "buildJsb",
      nativeRenderer,
      phases: ["clean-cache", "build-debug-infos", "bundle JSB engine", "write output"],
    };
  }
  if (task === "build-jsb-min") {
    return {
      task,
      entry: "./index.js",
      output: "./bin/cocos2d-jsb-min.js",
      engineBuilder: "buildJsbMin",
      nativeRenderer,
      phases: ["clean-cache", "build-debug-infos", "bundle/minify JSB engine", "write output"],
    };
  }
  return {
    task,
    entry: "./index.js",
    output: "./bin/cocos2d-jsb-for-preview.js",
    engineBuilder: "buildJsbPreview",
    nativeRenderer: false,
    phases: ["build-debug-infos", "bundle JSB preview engine", "write output"],
  };
}
