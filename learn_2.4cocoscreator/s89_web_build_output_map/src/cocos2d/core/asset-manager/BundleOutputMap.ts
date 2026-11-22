export type OutputRole = "page" | "style" | "engine" | "physics" | "startup" | "bundle-config" | "bundle-script" | "import" | "native";
export interface BuildArtifact { path: string; role: OutputRole; note: string; loads?: string[]; }
export interface ArtifactIssue { path: string; message: string; }
const roleOrder: OutputRole[] = ["page", "style", "engine", "physics", "startup", "bundle-config", "bundle-script", "import", "native"];

/** Evidence map of files found in 2.4NewProject/build/web-mobile; it does not generate them. */
export class BundleOutputMap {
  private readonly byPath: Map<string, BuildArtifact>;
  constructor(readonly artifacts: BuildArtifact[]) {
    this.byPath = new Map();
    for (const artifact of artifacts) {
      if (this.byPath.has(artifact.path)) throw new Error(`duplicate output path: ${artifact.path}`);
      this.byPath.set(artifact.path, artifact);
    }
  }
  validate(): ArtifactIssue[] {
    const issues: ArtifactIssue[] = [];
    for (const artifact of this.artifacts) {
      if (!artifact.path.includes(".")) issues.push({ path: artifact.path, message: "file path has no extension" });
      for (const dependency of artifact.loads ?? []) {
        if (!this.byPath.has(dependency)) issues.push({ path: artifact.path, message: `references absent mapped artifact ${dependency}` });
      }
      if (artifact.role === "bundle-config" && !/\/config\.[^.]+\.json$/.test(artifact.path)) {
        issues.push({ path: artifact.path, message: "bundle config filename should be config.<hash>.json" });
      }
    }
    if (!this.artifacts.some((a) => a.role === "page" && a.path === "index.html")) issues.push({ path: "index.html", message: "entry page is not mapped" });
    return issues;
  }
  byRole(): Map<OutputRole, BuildArtifact[]> {
    const grouped = new Map<OutputRole, BuildArtifact[]>();
    for (const role of roleOrder) grouped.set(role, this.artifacts.filter((artifact) => artifact.role === role));
    return grouped;
  }
  tree(): string[] {
    const children = new Map<string, string[]>();
    for (const artifact of this.artifacts) {
      const directory = artifact.path.slice(0, artifact.path.lastIndexOf("/")) || ".";
      children.set(directory, [...(children.get(directory) ?? []), artifact.path.slice(directory === "." ? 0 : directory.length + 1)]);
    }
    return [...children].sort(([a], [b]) => a.localeCompare(b)).flatMap(([directory, files]) => [directory + "/", ...files.map((file) => `  ${file}`)]);
  }
  lines(): string[] {
    return this.artifacts.map(({ path, role, note, loads }) =>
      `${role.padEnd(14)} ${path}\n               ${note}${loads?.length ? `\n               loads: ${loads.join(", ")}` : ""}`);
  }
}
