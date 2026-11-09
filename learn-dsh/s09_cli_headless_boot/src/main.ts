import { parseLauncherArgs } from './cli.ts';
import { Context } from './context.ts';
import { startHeadlessStartup } from './headless-startup.ts';
import { runHeadless } from './headless-runner.ts';
import { profiles } from './profiles.ts';

const invocation = parseLauncherArgs(Deno.args);
const profile = profiles[invocation.profile];
if (!profile) throw new Error(`unknown profile: ${invocation.profile}`);

console.log(`[cli] selected profile=${invocation.profile}`);
console.log(`[profile] bundles=${profile.bundles.join(' -> ')}`);
console.log(`[profile] entries=${profile.entries.join(' -> ')}`);
if (invocation.patchFiles.length > 0) {
  console.log(`[profile] patch overlays=${invocation.patchFiles.join(', ')}`);
}

const ctx = new Context();
ctx.provide('cmdlineArgs', Object.freeze([...invocation.appArgs]));
console.log(`[launcher] provided cmdlineArgs=${JSON.stringify(invocation.appArgs)}`);

startHeadlessStartup(ctx);
await runHeadless(ctx);
