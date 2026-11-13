export type OutputRole = "page" | "engine" | "startup" | "bundle-config" | "bundle-script" | "import" | "native";

export interface BuildArtifact {
  path: string;
  role: OutputRole;
  note: string;
}

export class BundleOutputMap {
  constructor(readonly artifacts: BuildArtifact[]) {}

  lines(): string[] {
    return this.artifacts.map(({ path, role, note }) => `${role.padEnd(14)} ${path}\n               ${note}`);
  }
}
