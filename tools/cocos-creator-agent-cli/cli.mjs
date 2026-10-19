#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { bridgeStatus, stopBridge, ensureBridge, listInstances, getCapabilities, callCommand, getProjectTools,
  callProjectTool, startTask, listTasks, getTask, waitTask, cancelTask, resumeTask, pluginRoot } from './bridge/client.mjs';
import { COMMANDS, CREATOR_VERSION } from './bridge/contracts.mjs';
import { installExtension, extensionStatus, updateExtension, uninstallExtension } from './extension-lifecycle.mjs';
import { updateCli } from './release.mjs';
import { runDoctor } from './doctor.mjs';
import { runCreatorWorkflow } from './creator-workflows.mjs';

const args = process.argv.slice(2);
const root = pluginRoot();
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let globalOptionError = null;

for (let index = args.length - 1; index >= 0; index -= 1) {
  if (args[index] === '--json') args.splice(index, 1);
  else if (args[index] === '--format') {
    if (args[index + 1] !== 'json') globalOptionError = 'Only --format json is supported.';
    args.splice(index, 2);
  }
}

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exitCode = code;
}

function value(flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
}

function print(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }

function parseInput() {
  const raw = value('--input', '{}');
  let result;
  try { result = JSON.parse(raw); } catch (_) { throw new Error('--input must be valid JSON'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('--input must be a JSON object');
  return result;
}

const extensionSource = path.join(root, 'creator-extension');

async function main() {
  if (globalOptionError) throw new Error(globalOptionError);
  const [group, action, ...rest] = args;
  if (group === '--help' || group === '-h' || !group) {
    process.stdout.write([
      'Cocos Creator Agent CLI (Creator 2.4.15; Creator writes require a Creator-side approval dialog)',
      '  --version | version',
      '  catalog [--format json]',
      '  self-update [--check] [--version <version>]',
      '  doctor [--project-root <absolute-path>] [--instance <instance-id>]',
      '  bridge start | status | stop',
      '  extension install --project-root <absolute-path>',
      '  extension status --project-root <absolute-path>',
      '  extension update --project-root <absolute-path> [--force]',
      '  extension uninstall --project-root <absolute-path> [--force]',
      '  instances list',
      '  capabilities --instance <instance-id>',
      '  project info --instance <instance-id>',
      '  project-tools list --instance <instance-id>',
      '  project-tools call --instance <instance-id> --tool <tool-id> --input <json-object>',
      '  project search --instance <instance-id> --query <text> [--scope all|code|assets] [--limit N]',
      '  asset search --instance <instance-id> [--query <text>] [--limit N]',
      '  script read --instance <instance-id> --path <assets-relative.js-or.ts>',
      '  scene snapshot --instance <instance-id>',
      '  creator build --project-root <path> --creator <Creator-2.4.15.app> --platform web-mobile|web-desktop|android|ios|mac|win32 [--build-path <new-path>] [--debug] [--auto-compile] [--timeout-ms N]',
      '  creator compile --project-root <path> --creator <Creator-2.4.15.app> --platform android|ios|mac|win32 --build-path <existing-native-build-path> [--debug] [--timeout-ms N]',
      '  creator test --instance <instance-id> --session <preview-session-id> --input <actions-and-assertions-json>',
      '  diagnostics read --instance <instance-id> [--after-sequence N] [--limit N]',
      '  preview start --instance <instance-id> [--port 7456]',
      '  preview observe|screenshot|refresh|stop --instance <instance-id> --session <preview-session-id>',
      '  preview interact --instance <instance-id> --session <preview-session-id> --input <actions-and-assertions-json>',
      '  tasks start --instance <instance-id> --command <command-id> --input <json-object>',
      '  tasks status --id <task-id> | wait --id <task-id> [--after-sequence N] [--wait-ms N]',
      '  tasks list [--instance <instance-id>] | cancel --id <task-id>',
      '  tasks resume --instance <instance-id> --id <task-id>',
      '  call --instance <instance-id> --command <command-id> --input <json-object>',
    ].join('\n') + '\n');
    return;
  }
  if (group === '--version' || group === '-v') { process.stdout.write(`${packageInfo.version}\n`); return; }
  if (group === 'version') { print({ name: packageInfo.name, version: packageInfo.version, creatorVersion: CREATOR_VERSION }); return; }
  if (group === 'catalog') {
    print({ schemaVersion: 1, creatorVersion: CREATOR_VERSION, commands: [...COMMANDS.values()] });
    return;
  }
  if (group === 'self-update') {
    print(await updateCli(packageInfo, { checkOnly: args.includes('--check'), version: value('--version') }));
    return;
  }
  if (group === 'doctor') {
    const report = await runDoctor({ packageInfo, projectRoot: value('--project-root'), instanceId: value('--instance') });
    print(report);
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (group === 'bridge' && action === 'status') { print(await bridgeStatus()); return; }
  if (group === 'bridge' && action === 'start') {
    const state = await ensureBridge();
    print({ running: true, bridgeId: state.bridgeId, host: state.host, port: state.port, pid: state.pid });
    return;
  }
  if (group === 'bridge' && action === 'stop') { print(await stopBridge()); return; }
  if (group === 'extension' && action === 'install') {
    print(installExtension(value('--project-root'), extensionSource, packageInfo.version)); return;
  }
  if (group === 'extension' && action === 'status') { print(extensionStatus(value('--project-root'), extensionSource)); return; }
  if (group === 'extension' && action === 'update') {
    print(updateExtension(value('--project-root'), extensionSource, packageInfo.version, { force: args.includes('--force') })); return;
  }
  if (group === 'extension' && action === 'uninstall') {
    print(uninstallExtension(value('--project-root'), extensionSource, { force: args.includes('--force') })); return;
  }

  const instanceId = value('--instance');
  if (group === 'instances' && action === 'list') { print(await listInstances()); return; }
  if (group === 'capabilities') { print(await getCapabilities(instanceId)); return; }
  if (group === 'project-tools' && action === 'list') { print(await getProjectTools(instanceId)); return; }
  if (group === 'project-tools' && action === 'call') {
    print(await callProjectTool(instanceId, value('--tool'), parseInput(), { expectedRegistryHash: value('--registry-hash') })); return;
  }
  if (group === 'tasks') {
    if (action === 'start') { print(await startTask(instanceId, value('--command'), parseInput())); return; }
    if (action === 'list') { print(await listTasks(instanceId)); return; }
    if (action === 'status') { print(await getTask(value('--id'))); return; }
    if (action === 'wait') {
      print(await waitTask(value('--id'), {
        ...(value('--after-sequence') !== undefined ? { afterSequence: Number(value('--after-sequence')) } : {}),
        ...(value('--wait-ms') !== undefined ? { waitMs: Number(value('--wait-ms')) } : {}),
      })); return;
    }
    if (action === 'cancel') { print(await cancelTask(value('--id'))); return; }
    if (action === 'resume') { print(await resumeTask(instanceId, value('--id'))); return; }
    throw new Error('Unknown tasks action.');
  }
  if (group === 'call') { print(await callCommand(instanceId, value('--command'), parseInput())); return; }
  if (group === 'project' && action === 'info') { print(await callCommand(instanceId, 'creator.project.info', {})); return; }
  if (group === 'project' && action === 'search') {
    const input = { query: value('--query'), ...(value('--scope') ? { scope: value('--scope') } : {}),
      ...(value('--limit') ? { limit: Number(value('--limit')) } : {}) };
    print(await callCommand(instanceId, 'creator.project.search', input)); return;
  }
  if (group === 'asset' && action === 'search') {
    const input = { ...(value('--query') ? { query: value('--query') } : {}),
      ...(value('--limit') ? { limit: Number(value('--limit')) } : {}) };
    print(await callCommand(instanceId, 'creator.asset.search', input)); return;
  }
  if (group === 'script' && action === 'read') {
    print(await callCommand(instanceId, 'creator.script.read', { scriptPath: value('--path') })); return;
  }
  if (group === 'scene' && action === 'snapshot') { print(await callCommand(instanceId, 'creator.scene.snapshot', {})); return; }
  if (group === 'creator') {
    if (action === 'test') {
      const testInput = parseInput();
      if (Object.hasOwn(testInput, 'previewSessionId')) throw new Error('PREVIEW_SESSION_ID_MUST_USE_SESSION_OPTION');
      const receipt = await callCommand(instanceId, 'creator.preview.interact', {
        ...testInput, previewSessionId: value('--session'),
      });
      const passed = receipt.result?.passed === true;
      print({ ...receipt, test: { passed, assertionCount: receipt.result?.assertions?.length || 0 } });
      if (!passed) process.exitCode = 1;
      return;
    }
    if (action === 'build' || action === 'compile') {
      const result = await runCreatorWorkflow({ operation: action,
        projectRoot: value('--project-root'), creatorPath: value('--creator'), platform: value('--platform'),
        buildPath: value('--build-path'), debug: args.includes('--debug'), autoCompile: args.includes('--auto-compile'),
        timeoutMs: value('--timeout-ms') === undefined ? 1200000 : Number(value('--timeout-ms')) });
      print(result);
      if (!result.success) process.exitCode = 1;
      return;
    }
    throw new Error('Unknown Creator workflow.');
  }
  if (group === 'diagnostics' && action === 'read') {
    const input = { ...(value('--after-sequence') ? { afterSequence: Number(value('--after-sequence')) } : {}),
      ...(value('--limit') ? { limit: Number(value('--limit')) } : {}) };
    print(await callCommand(instanceId, 'creator.diagnostics.read', input)); return;
  }
  if (group === 'preview') {
    const commandByAction = { start: 'creator.preview.start', observe: 'creator.preview.observe', screenshot: 'creator.preview.screenshot',
      interact: 'creator.preview.interact', refresh: 'creator.preview.refresh', stop: 'creator.preview.stop' };
    const command = commandByAction[action];
    if (!command) throw new Error('Unknown preview action.');
    if (action === 'start') {
      print(await callCommand(instanceId, command, { ...(value('--port') ? { port: Number(value('--port')) } : {}) })); return;
    }
    const input = { previewSessionId: value('--session') };
    if (action === 'interact') Object.assign(input, parseInput());
    if (action === 'observe' && value('--after-sequence')) input.afterSequence = Number(value('--after-sequence'));
    print(await callCommand(instanceId, command, input)); return;
  }
  throw new Error('Unknown command. Run cocos-creator-agent --help.');
}

main().catch((error) => fail(error.message || String(error)));
