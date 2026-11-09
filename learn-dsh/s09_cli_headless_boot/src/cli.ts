import type { LauncherInvocation } from './types.ts';

export function parseLauncherArgs(argv: readonly string[]): LauncherInvocation {
  const args = [...argv];
  let profile: string | undefined;

  if (args[0] === '--profile') {
    profile = args[1];
    args.splice(0, 2);
  } else if (args[0] && !args[0].startsWith('-') && args[0] !== 'plugin') {
    profile = args.shift();
  }

  if (!profile) throw new Error('usage: dsh [--profile] headless [--patch file] [app args...]');
  if (profile === 'plugin') throw new Error('plugin management is outside this lesson');

  const patchFiles: string[] = [];
  for (let index = 0; index < args.length;) {
    const argument = args[index];
    if (argument !== '--patch') {
      return { profile, patchFiles, appArgs: args.slice(index) };
    }

    const patchFile = args[index + 1];
    if (!patchFile) throw new Error('--patch requires a file path');
    patchFiles.push(patchFile);
    index += 2;
  }

  return { profile, patchFiles, appArgs: [] };
}
