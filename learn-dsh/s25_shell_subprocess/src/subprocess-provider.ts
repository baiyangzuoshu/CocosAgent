import type {
  SubprocessHandle,
  SubprocessProvider,
  SubprocessSpawnSpec,
} from "./types.ts";

/** A tiny host provider that starts one direct argv as a managed child. */
export class DenoSubprocessProvider implements SubprocessProvider {
  constructor(private readonly trace: string[]) {}

  spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    this.trace.push(`subprocess.spawn: ${formatArgv(spec.argv)}`);
    const settled = new Deno.Command(spec.argv[0], {
      args: [...spec.argv.slice(1)],
      cwd: spec.cwd,
      clearEnv: true,
      stdout: spec.stdio.stdout,
      stderr: spec.stdio.stderr,
    }).output();

    return {
      done: settled.then(({ code, signal }) => ({
        exitCode: code,
        signal,
      })),
      output: settled.then(({ stdout, stderr }) => ({
        stdout: new TextDecoder().decode(stdout),
        stderr: new TextDecoder().decode(stderr),
      })),
    };
  }
}

function formatArgv(argv: readonly string[]): string {
  return JSON.stringify(argv);
}
