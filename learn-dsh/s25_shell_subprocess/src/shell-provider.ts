import type {
  SandboxProvider,
  ShellExecutor,
  ShellRequest,
  ShellResult,
  ShellSpec,
  SubprocessProvider,
} from "./types.ts";

const BASH = "/bin/bash";

/** Shared foreground mechanics for the local and sandbox-backed providers. */
abstract class BashProvider implements ShellExecutor {
  constructor(
    protected readonly subprocess: SubprocessProvider,
    protected readonly trace: string[],
  ) {}

  resolve(request: ShellRequest): ShellSpec {
    return {
      command: request.command,
      workdir: request.workdir ?? Deno.cwd(),
    };
  }

  protected async runArgv(
    spec: ShellSpec,
    argv: readonly string[],
  ): Promise<ShellResult> {
    const process = this.subprocess.spawn({
      argv,
      cwd: spec.workdir,
      stdio: { stdout: "piped", stderr: "piped" },
    });
    const [exit, output] = await Promise.all([process.done, process.output]);
    return { ...exit, ...output };
  }

  protected commandArgv(spec: ShellSpec): string[] {
    return [BASH, "-c", spec.command];
  }

  abstract execute(spec: ShellSpec): Promise<ShellResult>;
}

/** Local implementation: the command goes straight to the Subprocess seam. */
export class LocalBashProvider extends BashProvider {
  async execute(spec: ShellSpec): Promise<ShellResult> {
    this.trace.push("shell provider: local");
    return this.runArgv(spec, this.commandArgv(spec));
  }
}

/** Replacement provider: confine argv first, then use the same Subprocess. */
export class SandboxedBashProvider extends BashProvider {
  constructor(
    subprocess: SubprocessProvider,
    trace: string[],
    private readonly sandbox: SandboxProvider,
  ) {
    super(subprocess, trace);
  }

  override resolve(request: ShellRequest): ShellSpec {
    const base = super.resolve(request);
    return {
      ...base,
      sandboxPolicy: {
        mode: "read-only",
        workspaceRoot: base.workdir,
      },
    };
  }

  async execute(spec: ShellSpec): Promise<ShellResult> {
    this.trace.push("shell provider: sandboxed");
    const policy = spec.sandboxPolicy;
    if (policy === undefined) {
      throw new Error("sandboxed provider requires a resolved policy");
    }

    const plan = await this.sandbox.confine(this.commandArgv(spec), policy);
    const result = await this.runArgv(spec, plan.argv);
    return {
      ...result,
      sandbox: { mode: plan.mode, enforcement: plan.enforcement },
    };
  }
}
