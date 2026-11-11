import type { BundleConfig } from "../cocos/asset/asset-manager/url-transformer.ts";

export interface ReleaseManifest extends BundleConfig {
  releaseId: string;
  previousReleaseId: string;
}

export function publishSteps(manifest: ReleaseManifest): string[] {
  return [
    "upload immutable files under " + manifest.base + "/",
    "verify the uploaded files",
    "replace /release.json with release " + manifest.releaseId,
    "keep /releases/" + manifest.previousReleaseId + "/ for rollback",
  ];
}

export function rollbackStep(manifest: ReleaseManifest): string {
  return "replace /release.json with release " + manifest.previousReleaseId;
}
