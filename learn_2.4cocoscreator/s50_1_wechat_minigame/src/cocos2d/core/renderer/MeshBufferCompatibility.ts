import { SystemPlatform } from "../CCSys.ts";

export interface RuntimeCompatibilityInput {
  platform: number;
  os: "ios" | "osx" | "other";
  isBrowser: boolean;
  isIOSHighPerformanceMode: boolean;
  userAgent: string;
}

/** Mirrors the platform predicate in 2.4.15 webgl/mesh-buffer.js. */
export function needsIos14BufferFix(input: RuntimeCompatibilityInput): boolean {
  const apple = input.os === "ios" || input.os === "osx";
  const affectedVersion = /(OS 1[4-9])|(Version\/1[4-9])/.test(input.userAgent);
  if (input.platform === SystemPlatform.WECHAT_GAME) {
    return apple && input.isIOSHighPerformanceMode && affectedVersion;
  }
  return apple && input.isBrowser && affectedVersion;
}
