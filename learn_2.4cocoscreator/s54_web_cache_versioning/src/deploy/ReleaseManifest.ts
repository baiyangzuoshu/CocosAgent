import type { BundleConfig } from "../cocos2d/core/asset-manager/urlTransformer.ts";

export interface ReleaseManifest extends BundleConfig {
  releaseId: string;
  previousReleaseId: string;
  bundles?: Record<string, string>;
}
export type PublishPhase = "planned" | "uploaded" | "verified" | "active" | "rolled-back";
export function validateManifest(manifest: ReleaseManifest): string[] {
  const issues: string[] = [];
  if (!/^[a-zA-Z0-9_-]+$/.test(manifest.releaseId)) issues.push("releaseId contains unsafe path characters");
  if (!manifest.base.startsWith(`/releases/${manifest.releaseId}`)) issues.push("base must point into this immutable release directory");
  if (!manifest.importBase.startsWith("/")) issues.push("importBase must be an absolute URL path");
  if (manifest.previousReleaseId === manifest.releaseId) issues.push("previous release must differ from active release");
  return issues;
}
export class ReleasePublishPlan {
  phase: PublishPhase = "planned";
  private readonly verifiedFiles = new Set<string>();
  constructor(readonly manifest: ReleaseManifest, readonly expectedFiles: readonly string[]) {
    const issues = validateManifest(manifest);
    if (issues.length) throw new Error(issues.join("; "));
  }
  markUploaded(paths: readonly string[]): void {
    if (this.phase !== "planned") throw new Error(`cannot upload in phase ${this.phase}`);
    for (const path of paths) this.verifiedFiles.add(path);
    this.phase = "uploaded";
  }
  verify(check: (path: string) => boolean): void {
    if (this.phase !== "uploaded") throw new Error("upload files before verification");
    const missing = this.expectedFiles.filter((path) => !this.verifiedFiles.has(path) || !check(path));
    if (missing.length) throw new Error(`release verification failed: ${missing.join(", ")}`);
    this.phase = "verified";
  }
  activate(): void { if (this.phase !== "verified") throw new Error("only a verified release can become active"); this.phase = "active"; }
  rollback(): void {
    if (this.phase !== "active") throw new Error("rollback applies only after activation");
    this.phase = "rolled-back";
  }
  get steps(): string[] {
    return [
      `upload immutable files under ${this.manifest.base}/`,
      `verify all ${this.expectedFiles.length} expected files`,
      `replace /release.json with release ${this.manifest.releaseId}`,
      `keep /releases/${this.manifest.previousReleaseId}/ available for rollback`,
    ];
  }
}
export function publishSteps(manifest: ReleaseManifest): string[] {
  const issues = validateManifest(manifest);
  if (issues.length) throw new Error(issues.join("; "));
  return [
    `upload immutable files under ${manifest.base}/`,
    "verify every expected file before switching the pointer",
    `replace /release.json with release ${manifest.releaseId}`,
    `keep /releases/${manifest.previousReleaseId}/ available for rollback`,
  ];
}
export function rollbackStep(manifest: ReleaseManifest): string {
  return `replace /release.json with release ${manifest.previousReleaseId}`;
}
