import { makeNativeEnginePlan, type JsbTask } from "./build/NativeEngineTasks.ts";
import { resolveSystemIdentity } from "./cocos2d/core/CCSys.ts";
import { resolveNativeRuntime, type NativeMacros } from "./cocos2d/core/NativeRuntime.ts";

const outputElement = document.querySelector<HTMLPreElement>("#log");
if (!outputElement) throw new Error("找不到 #log");
const output: HTMLPreElement = outputElement;

function section(title: string, rows: readonly string[]): void {
  output.textContent += `${title}\n${rows.map((row) => `  ${row}`).join("\n")}\n\n`;
}

const tasks: JsbTask[] = ["build-jsb-dev", "build-jsb-min", "build-jsb-preview"];
for (const task of tasks) {
  const plan = makeNativeEnginePlan(task, ["--native-renderer"]);
  section(task, [
    `Engine.${plan.engineBuilder}(${plan.entry}, ${plan.output})`,
    `nativeRenderer=${plan.nativeRenderer}; phases=${plan.phases.join(" -> ")}`,
  ]);
}

const scenarios: Array<{ name: string; macros: NativeMacros }> = [
  { name: "JSB + native renderer", macros: { CC_JSB: true, CC_NATIVERENDERER: true, CC_RUNTIME: false } },
  { name: "manual JSB macro override (branch demonstration only)", macros: { CC_JSB: true, CC_NATIVERENDERER: false, CC_RUNTIME: false } },
  { name: "Web Runtime", macros: { CC_JSB: false, CC_NATIVERENDERER: false, CC_RUNTIME: true } },
];
for (const scenario of scenarios) {
  const globals = { window: true, document: true, jsb: true, runtime: scenario.macros.CC_RUNTIME };
  const identity = resolveSystemIdentity(scenario.macros, globals);
  const route = resolveNativeRuntime(scenario.macros, {
    requestAnimationFrame: () => 1,
    setPreferredFramesPerSecond: () => undefined,
    canvas: {},
    gfx: {},
  });
  section(scenario.name, [
    `cc.sys.isNative=${identity.isNative}; isBrowser=${identity.isBrowser} (DOM globals present=${globals.window && globals.document})`,
    `frame scheduler=${route.frameScheduler}; fps=${route.preferredFrameRateCall}`,
    `canvas=${route.rendererContainer}; graphics=${route.graphicsDevice}`,
  ]);
}

section("原生构建证据边界", [
  "Gulp JSB engine tasks are in the engine snapshot; Editor's app-project builder is outside it.",
  "Native C++ bindings and host frame callback implementation are not in this JS engine directory.",
  "This page models branch selection; it cannot prove an iOS/Android/macOS package was built or launched.",
]);
