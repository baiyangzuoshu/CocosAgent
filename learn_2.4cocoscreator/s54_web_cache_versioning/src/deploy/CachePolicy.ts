export type CacheControl =
  | "no-cache"
  | "public, max-age=31536000, immutable"
  | "no-store";

export function cacheControlFor(path: string): CacheControl {
  if (path === "/index.html" || path === "/release.json") {
    return "no-cache";
  }
  if (path.startsWith("/releases/")) {
    return "public, max-age=31536000, immutable";
  }
  return "no-store";
}
