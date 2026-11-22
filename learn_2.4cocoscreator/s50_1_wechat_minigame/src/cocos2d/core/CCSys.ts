export const SystemPlatform = {
  WEB: 103,
  WECHAT_GAME: 104,
  WECHAT_GAME_SUB: 114,
} as const;

export interface SysInfo {
  platform: number;
  isMobile: boolean;
  capabilities: Record<string, boolean>;
}

export interface GlobalAdapter {
  adaptSys(sys: SysInfo): void;
}

export interface RuntimeGlobals {
  wx?: { getSystemInfoSync?: unknown; getSharedCanvas?: unknown };
  __globalAdapter?: GlobalAdapter;
}

/** Mirrors the adapter-first branch in CCSys.js; it does not emulate wx itself. */
export function initializeSys(
  sys: SysInfo,
  globals: RuntimeGlobals,
  browserFallback: () => void,
): { source: "global-adapter" | "browser-fallback"; sys: SysInfo } {
  if (globals.__globalAdapter?.adaptSys) {
    globals.__globalAdapter.adaptSys(sys);
    return { source: "global-adapter", sys };
  }
  browserFallback();
  return { source: "browser-fallback", sys };
}

/** Legacy CC_WECHATGAME detection is wx-global probing, not CC_MINIGAME. */
export function detectLegacyWechatGlobal(globals: RuntimeGlobals): boolean {
  return Boolean(globals.wx?.getSystemInfoSync || globals.wx?.getSharedCanvas);
}

export function isWechatRuntime(sys: SysInfo): boolean {
  return sys.platform === SystemPlatform.WECHAT_GAME;
}
