import {
  buildProfile,
  createPreviewMacros,
  type ProjectTarget,
} from "./build/build-profile.ts";
import { evaluateDebugBranch } from "./cocos2d/core/predefine.ts";
import {
  determineRenderBackend,
  normalizeGameConfig,
} from "./cocos2d/core/CCGame.ts";

const outputElement = document.querySelector<HTMLPreElement>("#log");
if (!outputElement) throw new Error("找不到 #log");
const output: HTMLPreElement = outputElement;

function write(title: string, lines: readonly string[]): void {
  output.textContent += `${title}\n${lines.map((line) => `  ${line}`).join("\n")}\n\n`;
}

function macroSummary(macros: ReturnType<typeof buildProfile>["macros"]): string {
  return [
    `CC_EDITOR=${macros.CC_EDITOR}`,
    `CC_PREVIEW=${macros.CC_PREVIEW}`,
    `CC_BUILD=${macros.CC_BUILD}`,
    `CC_TEST=${macros.CC_TEST}`,
    `CC_DEV=${macros.CC_DEV}`,
    `CC_DEBUG=${macros.CC_DEBUG}`,
    `CC_JSB=${macros.CC_JSB}`,
    `CC_NATIVERENDERER=${macros.CC_NATIVERENDERER}`,
    `CC_MINIGAME=${macros.CC_MINIGAME}`,
    `CC_SUPPORT_JIT=${macros.CC_SUPPORT_JIT}`,
    `CC_PHYSICS_BUILTIN=${macros.CC_PHYSICS_BUILTIN}`,
    `CC_PHYSICS_CANNON=${macros.CC_PHYSICS_CANNON}`,
  ].join(" | ");
}

const cases: Array<{ target: ProjectTarget; mode: "debug" | "release" }> = [
  { target: "web-desktop", mode: "debug" },
  { target: "web-desktop", mode: "release" },
  { target: "native-jsb", mode: "debug" },
];

for (const { target, mode } of cases) {
  const result = buildProfile(target, mode);
  write(`${target} / ${mode}`, [
    `build phase=${result.profile.platform}; engine=${result.profile.engineVersion}`,
    `flags=${JSON.stringify(result.profile.flags)}`,
    macroSummary(result.macros),
    `compression profile=${result.compression}`,
    evaluateDebugBranch(result.macros),
  ]);
}

const previewMacros = createPreviewMacros();
write("browser preview (different engine phase)", [
  `CC_PREVIEW=${previewMacros.CC_PREVIEW}; CC_DEV=${previewMacros.CC_DEV}; CC_DEBUG=${previewMacros.CC_DEBUG}`,
  "Preview is not a published build, so dev macros keep CC_DEBUG enabled.",
]);

const gameConfig = normalizeGameConfig({
  frameRate: 60,
  renderMode: 2,
  showFPS: true,
});
const backend = determineRenderBackend(gameConfig, { canvas: true, opengl: true });
write("runtime CCGame.config", [
  `normalized=${JSON.stringify(gameConfig)}`,
  `requested renderMode=${gameConfig.renderMode}; available backend selected=${backend}`,
  "Changing frameRate/renderMode does not change the build target or compile-time macros.",
]);

write("evidence boundary", [
  "This page models getMacros and selected CCGame config behavior from Creator 2.4.15.",
  "It does not invoke the Creator Editor Builder or emit a Creator game package.",
]);
