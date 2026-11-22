/** A small, executable model of gulp/tasks/engine.js::buildCocosJs. */
export type BuildMode = "debug" | "release";
export interface ModuleRecord {
  name: string;
  entries: string[];
  dependencies?: string[];
}
export interface MacroFlags {
  platform: "web";
  debug: boolean;
  runtime: boolean;
  minigame: boolean;
  physics: "builtin" | "cannon" | "none";
}
export interface Stage {
  name: string;
  inputs: string[];
  outputs: string[];
  detail: string;
}
export interface EngineBundlePlan {
  entry: string;
  output: string;
  excludedModules: string[];
  excludedFiles: string[];
  flags: MacroFlags;
  macros: Record<string, boolean>;
  stages: Stage[];
  sourceMap: boolean;
}

// Curated records copied from the shape of 2.4.15/modules.json. Dependency direction
// matches excludeAllDepends(): excluding Audio also excludes modules depending on Audio.
const modules: ModuleRecord[] = [
  { name: "Core", entries: [] },
  { name: "Audio", entries: ["cocos2d/audio/CCAudioEngine.js"] },
  { name: "AudioSource", entries: ["cocos2d/core/components/CCAudioSource.js"], dependencies: ["Audio"] },
  { name: "Sprite", entries: ["cocos2d/core/components/CCSprite.js"] },
  { name: "WebGL Renderer", entries: ["cocos2d/core/renderer/webgl/model-batcher.js", "cocos2d/core/renderer/webgl/assemblers/index.js", "extensions/dragonbones/webgl-assembler.js"] },
  { name: "DragonBones", entries: ["extensions/dragonbones/index.js"], dependencies: ["WebGL Renderer"] },
  { name: "Collider", entries: ["cocos2d/core/collider/index.js"] },
  { name: "Physics", entries: ["cocos2d/core/physics/index.js"], dependencies: ["Collider"] },
  { name: "3D", entries: ["cocos2d/core/3d/index.js"], dependencies: ["WebGL Renderer"] },
];

/** Mirrors the reverse dependency walk in engine.js::excludeAllDepends. */
export function expandExcludedModules(requested: readonly string[], records = modules): ModuleRecord[] {
  const byName = new Map(records.map((record) => [record.name, record]));
  const excluded = new Set<string>();
  const visit = (name: string): void => {
    if (excluded.has(name)) return; // also makes dependency cycles safe
    excluded.add(name);
    for (const candidate of records) {
      if (candidate.dependencies?.includes(name)) visit(candidate.name);
    }
  };
  requested.forEach(visit);
  const unknown = [...excluded].filter((name) => !byName.has(name));
  if (unknown.length) throw new Error(`unknown module(s): ${unknown.join(", ")}`);
  return [...excluded].map((name) => byName.get(name)!);
}

export function createMacroTable(flags: MacroFlags): Record<string, boolean> {
  const dev = flags.debug;
  const macro: Record<string, boolean> = {
    CC_BUILD: true,
    CC_EDITOR: false,
    CC_PREVIEW: false,
    CC_TEST: false,
    CC_DEV: dev,
    CC_DEBUG: dev,
    CC_JSB: false,
    CC_RUNTIME: flags.runtime,
    CC_MINIGAME: flags.minigame,
    CC_SUPPORT_JIT: !flags.runtime && !flags.minigame,
    CC_NATIVERENDERER: false,
    CC_PHYSICS_BUILTIN: flags.physics === "builtin",
    CC_PHYSICS_CANNON: flags.physics === "cannon",
  };
  return macro;
}

export function createEngineBundlePlan(
  mode: BuildMode,
  options: { entry?: string; output?: string; exclude?: string[]; sourceMap?: boolean } = {},
): EngineBundlePlan {
  const entry = options.entry ?? "cocos2d/core/CCGame.js";
  const output = options.output ?? "bin/cocos2d-js.js";
  const sourceMap = options.sourceMap !== false;
  const flags: MacroFlags = { platform: "web", debug: mode === "debug", runtime: false, minigame: false, physics: "cannon" };
  const excluded = expandExcludedModules(options.exclude ?? ["Audio", "WebGL Renderer"]);
  const excludedFiles = excluded.flatMap((module) => module.entries);
  const macros = createMacroTable(flags);
  const mapOutput = sourceMap ? [`${output}.map`] : [];
  const stages: Stage[] = [
    { name: "createBundler", inputs: [entry, "modules.json", ...excludedFiles], outputs: ["Browserify dependency graph"], detail: "Browserify resolves .js/.json/.ts entry imports; engine.js adds default skip and requested exclusions." },
    { name: "bundle", inputs: ["Browserify dependency graph"], outputs: ["unoptimized bundle"], detail: "bundle() traverses modules and emits one stream; exclusions remove entry files, not arbitrary dependency semantics." },
    { name: "uglify(build)", inputs: ["unoptimized bundle", "build macro flags"], outputs: ["macro-specialized bundle"], detail: `CC_BUILD=true, CC_DEBUG=${macros.CC_DEBUG}; build flags choose platform/backend branches.` },
    { name: "Optimizejs", inputs: ["macro-specialized bundle"], outputs: ["optimized bundle"], detail: "Optimizes the generated JavaScript after macro substitution." },
    ...(sourceMap ? [{ name: "sourcemaps.write", inputs: ["optimized bundle", "loaded maps"], outputs: mapOutput, detail: "Writes an external map beside the output bundle." }] : []),
    { name: "Gulp.dest", inputs: ["optimized bundle", ...mapOutput], outputs: [output, ...mapOutput], detail: "Writes to dirname(outputFile); buildCocosJs receives entry/output from its caller." },
  ];
  return { entry, output, excludedModules: excluded.map((module) => module.name), excludedFiles, flags, macros, stages, sourceMap };
}
