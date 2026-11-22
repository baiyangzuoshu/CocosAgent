import {
  describeWechatBranches,
  makeWechatBuildMacros,
} from "./cocos2d/core/WechatBuildProfile.ts";
import {
  detectLegacyWechatGlobal,
  initializeSys,
  isWechatRuntime,
  SystemPlatform,
  type SysInfo,
} from "./cocos2d/core/CCSys.ts";
import { needsIos14BufferFix } from "./cocos2d/core/renderer/MeshBufferCompatibility.ts";

const outputElement = document.querySelector<HTMLPreElement>("#log");
if (!outputElement) throw new Error("找不到 #log");
const output: HTMLPreElement = outputElement;

function section(title: string, rows: readonly string[]): void {
  output.textContent += `${title}\n${rows.map((row) => `  ${row}`).join("\n")}\n\n`;
}

const macros = makeWechatBuildMacros("build", {
  debug: false,
  minigame: true,
  jsb: false,
  runtime: false,
});
section("构建期宏：小游戏 Release", describeWechatBranches(macros));

const sys: SysInfo = { platform: SystemPlatform.WEB, isMobile: false, capabilities: {} };
const adapted = initializeSys(sys, {
  __globalAdapter: {
    adaptSys(target) {
      target.platform = SystemPlatform.WECHAT_GAME;
      target.isMobile = true;
      target.capabilities = { canvas: true, opengl: true };
    },
  },
}, () => {
  sys.platform = SystemPlatform.WEB;
});
section("运行时系统识别", [
  `source=${adapted.source}; platform=${adapted.sys.platform}; isWechat=${isWechatRuntime(adapted.sys)}`,
  `legacy wx global probe=${detectLegacyWechatGlobal({ wx: { getSystemInfoSync() {} } })}`,
  "Creator 2.4.15 的 CCSys.js 先调用 __globalAdapter.adaptSys，再走平台默认分支。",
  "CC_MINIGAME 是构建 flag；运行时具体微信平台通过 cc.sys.platform 判断。",
]);

const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) Version/14.0";
const fix = needsIos14BufferFix({
  platform: SystemPlatform.WECHAT_GAME,
  os: "ios",
  isBrowser: false,
  isIOSHighPerformanceMode: true,
  userAgent: ua,
});
section("实际引擎兼容分支：MeshBuffer", [
  `WeChat + iOS 14 + high-performance mode => FIX_IOS14_BUFFER=${fix}`,
  "浏览器分支使用 cc.sys.isBrowser；微信小游戏分支读取 GameGlobal.isIOSHighPerformanceMode。",
]);

section("构建与宿主边界", [
  "此示例模拟宏和 Sys/兼容性决策，不生成小游戏工程或 wx-adapter。",
  "当前 engine/2.4.15engine 快照不含 Creator Editor 的微信小游戏 Builder 与完整 __globalAdapter。",
  "网页演示不能验证微信开发者工具、真机 API、分包和上传产物。",
]);
