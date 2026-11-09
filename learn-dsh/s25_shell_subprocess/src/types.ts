export interface ShellRequest {
  readonly command: string;
  readonly workdir?: string;
}

export interface SandboxPolicy {
  readonly mode: "read-only";
  readonly workspaceRoot: string;
}

export interface ShellSpec {
  readonly command: string;
  readonly workdir: string;
  readonly sandboxPolicy?: SandboxPolicy;
}

export interface SubprocessSpawnSpec {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdio: {
    readonly stdout: "piped";
    readonly stderr: "piped";
  };
}

export interface SubprocessExit {
  readonly exitCode: number;
  readonly signal: string | null;
}

export interface SubprocessOutput {
  readonly stdout: string;
  readonly stderr: string;
}

export interface SubprocessHandle {
  readonly done: Promise<SubprocessExit>;
  readonly output: Promise<SubprocessOutput>;
}

export interface SubprocessProvider {
  spawn(spec: SubprocessSpawnSpec): SubprocessHandle;
}

export interface SandboxPlan {
  readonly argv: readonly string[];
  readonly mode: "read-only";
  /** The demo stub reports wiring only; it does not enforce host isolation. */
  readonly enforcement: "demo-only";
}

export interface SandboxProvider {
  confine(
    argv: readonly string[],
    policy: SandboxPolicy,
  ): Promise<SandboxPlan>;
}

export interface ShellResult extends SubprocessExit, SubprocessOutput {
  readonly sandbox?: {
    readonly mode: "read-only";
    readonly enforcement: "demo-only";
  };
}

export interface ShellExecutor {
  resolve(request: ShellRequest): ShellSpec;
  execute(spec: ShellSpec): Promise<ShellResult>;
}
