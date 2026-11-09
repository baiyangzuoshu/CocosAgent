import type { ShellExecutor, ShellResult } from "./types.ts";

export const LESSON_COMMAND = "printf 'shell lesson: ready\\n'";

/** The consumer depends on the Shell seam, not a specific provider. */
export async function runStatusCommand(
  shell: ShellExecutor,
): Promise<ShellResult> {
  const spec = shell.resolve({ command: LESSON_COMMAND });
  return shell.execute(spec);
}
