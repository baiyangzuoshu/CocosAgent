import { director, game } from "./exports/base.ts";

const status = document.querySelector<HTMLParagraphElement>("#status");

if (!status) {
  throw new Error("找不到页面状态节点 #status");
}

const host = globalThis as typeof globalThis & {
  cc?: Record<string, unknown>;
  CocosEngine?: string;
};

status.textContent = [
  `CocosEngine: ${host.CocosEngine}`,
  `模块导出: ${game.constructor.name}, ${director.constructor.name}`,
  `兼容命名空间: ${host.cc?.game === game && host.cc?.director === director}`,
].join(" · ");
