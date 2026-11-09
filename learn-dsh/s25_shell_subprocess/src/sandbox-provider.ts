import type { SandboxPlan, SandboxPolicy, SandboxProvider } from "./types.ts";

/**
 * Demonstrates the confine() seam for one fixed, harmless command.
 * This allowlist is not an operating-system sandbox.
 */
export class DemoReadOnlySandboxProvider implements SandboxProvider {
  constructor(
    private readonly allowedArgv: readonly string[],
    private readonly trace: string[],
  ) {}

  async confine(
    argv: readonly string[],
    policy: SandboxPolicy,
  ): Promise<SandboxPlan> {
    this.trace.push(`sandbox.confine: mode=${policy.mode}`);
    if (policy.mode !== "read-only") {
      throw new Error("demo sandbox only accepts read-only mode");
    }
    if (!sameArgv(argv, this.allowedArgv)) {
      throw new Error("demo sandbox only accepts the fixed lesson command");
    }

    // A real provider returns the platform runner's wrapped argv. This stub
    // preserves argv so the harmless printf can run, but does no OS isolation.
    return {
      argv: [...argv],
      mode: policy.mode,
      enforcement: "demo-only",
    };
  }
}

function sameArgv(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}
