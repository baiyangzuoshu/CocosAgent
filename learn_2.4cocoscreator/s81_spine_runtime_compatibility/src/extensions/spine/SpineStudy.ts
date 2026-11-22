type SpineVersion = { major: number; minor: number; patch: number; raw: string };
type ExportAsset = { format: "json" | "binary"; version: SpineVersion; hasAtlas: boolean; hasSkeletonPayload: boolean };
type RuntimeCapabilities = { line: string; jsonReader: boolean; binaryReader: boolean; supportedLines: string[] };
function parseVersion(text: string): SpineVersion {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) throw new Error(`invalid Spine version string: ${text}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3] ?? 0), raw: text };
}
function inspectJsonAsset(raw: string): ExportAsset {
  const data = JSON.parse(raw) as { skeleton?: { spine?: string }; bones?: unknown[] };
  if (!data.skeleton?.spine || !data.bones?.length) throw new Error("JSON export lacks skeleton.spine version or bones");
  return { format: "json", version: parseVersion(data.skeleton.spine), hasAtlas: true, hasSkeletonPayload: true };
}
function inspectBinaryHeader(bytes: Uint8Array, versionText: string): ExportAsset {
  // Actual 3.8 SkeletonBinary reads its version from the binary stream. This study receives
  // a decoded header to keep the compatibility decision visible without vendoring Spine.
  if (bytes.length < 8) throw new Error("binary skeleton payload is truncated");
  return { format: "binary", version: parseVersion(versionText), hasAtlas: true, hasSkeletonPayload: true };
}
class SpineRuntimeAdapter {
  readonly capabilities: RuntimeCapabilities = { line: "3.8", jsonReader: true, binaryReader: true, supportedLines: ["3.8"] };
  check(asset: ExportAsset): { compatible: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!asset.hasAtlas) issues.push("Atlas is missing; attachment loader cannot resolve regions");
    if (!asset.hasSkeletonPayload) issues.push("skeleton payload is missing");
    if (asset.format === "json" && !this.capabilities.jsonReader) issues.push("JSON reader is not linked into this build");
    if (asset.format === "binary" && !this.capabilities.binaryReader) issues.push("binary reader is not linked into this build");
    if (!this.capabilities.supportedLines.includes(`${asset.version.major}.${asset.version.minor}`)) {
      issues.push(`export line ${asset.version.major}.${asset.version.minor} differs from bundled Runtime ${this.capabilities.line}`);
    }
    return { compatible: issues.length === 0, issues };
  }
}
export function runLesson(): string[] {
  const runtime = new SpineRuntimeAdapter();
  const json = inspectJsonAsset(JSON.stringify({ skeleton: { spine: "3.8.75" }, bones: [{ name: "root" }] }));
  const binary = inspectBinaryHeader(new Uint8Array(16), "4.2.00");
  const log = [`bundled Runtime source banner: ${runtime.capabilities.line}`];
  for (const asset of [json, binary]) {
    const check = runtime.check(asset);
    log.push(`${asset.format} export ${asset.version.raw}: compatible=${check.compatible}`);
    log.push(...(check.issues.length ? check.issues : ["reader and version line accepted; parse still must succeed against the real asset"]));
  }
  log.push("source evidence: extensions/spine/lib/spine.js identifies Runtime 3.8; skeleton-data.js selects SkeletonJson or SkeletonBinary, builds AtlasAttachmentLoader, then reads data");
  return log;
}
