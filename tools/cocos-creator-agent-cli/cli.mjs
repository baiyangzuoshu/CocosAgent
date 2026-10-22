#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { bridgeStatus, stopBridge, ensureBridge, listInstances, getCapabilities, callCommand, getProjectTools,
  getExtensionCommands, callExtensionCommand, callProjectTool, startTask, listTasks, getTask, waitTask,
  cancelTask, resumeTask, pluginRoot } from './bridge/client.mjs';
import { COMMANDS, CREATOR_VERSION } from './bridge/contracts.mjs';
import { installExtension, extensionStatus, updateExtension, uninstallExtension } from './extension-lifecycle.mjs';
import { updateCli } from './release.mjs';
import { runDoctor } from './doctor.mjs';
import { discoverCreatorInstallations, openCreatorProject, runCreatorWorkflow } from './creator-workflows.mjs';
import { startProjectFileWatch } from './creator-watch.mjs';
import { loadTestPlan, loadFailedSuiteIds, parseTestShard, runTestPlan, watchTestPlan } from './creator-tests.mjs';
import { runVcsDoctor } from './vcs-integrity.mjs';
import { runVcsStatus } from './vcs-status.mjs';
import { runVcsDiff } from './vcs-diff.mjs';
import { configureMcp, mcpStatus, supportedMcpClients } from './mcp/configure.mjs';
import { availableSkills, installSkills, listSkillStatus, showSkill } from './skills.mjs';
import { diffSceneSnapshotFiles } from './semantic-diff.mjs';

const args = process.argv.slice(2);
const root = pluginRoot();
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let globalOptionError = null;
let jsonOutput = false;

const HELP_LINES = [
  'Cocos Creator Agent CLI (Creator 2.4.15; Creator writes require a Creator-side approval dialog)',
  '  --version | version',
  '  help [<command> [<subcommand>]] | help search <query>',
  '  catalog [--format json]',
  '  self-update [--check] [--version <version>]',
  '  mcp configure <codex|claude-code> [--local] [--force] [--dry-run] | list | status <client> | remove <client> | serve',
  '  skill list [<codex|claude-code>] [--local] | show [<skill-name>|--list] (default: cocos2-cli) | install <client> [--local] [--skill <name>] [--force] | refresh <client> [--local] [--force]',
  '  doctor [--project-root <absolute-path>] [--instance <instance-id>]',
  '  vcs doctor --git-root <absolute-path> --project-root <absolute-path>',
  '  vcs status --git-root <absolute-path> --project-root <absolute-path>',
  '  vcs diff --git-root <absolute-path> --project-root <absolute-path> --path <assets-relative.fire-or-prefab> [--from <revision>] [--to <revision>]',
  '  bridge start | status | stop',
  '  extension install --project-root <absolute-path>',
  '  extension status --project-root <absolute-path>',
  '  extension update --project-root <absolute-path> [--force]',
  '  extension uninstall --project-root <absolute-path> [--force]',
  '  extension commands list --instance <instance-id>',
  '  extension command call --instance <instance-id> --provider <provider-id> --command <command-id> --input <json-object>',
  '  instances list',
  '  capabilities --instance <instance-id>',
  '  creator installations [--search-root <absolute-path>]',
  '  project open --project-root <absolute-path> [--creator <Creator-2.4.15.app>] [--timeout-ms N (default 120000)] [--no-wait-ready]',
  '  project info --instance <instance-id>',
  '  project-tools list --instance <instance-id>',
  '  project-tools call --instance <instance-id> --tool <tool-id> --input <json-object>',
  '  project search --instance <instance-id> --query <text> [--scope all|code|assets] [--limit N]',
  '  asset search --instance <instance-id> [--query <text>] [--limit N]',
  '  asset references --instance <instance-id> --uuid <asset-uuid>',
  '  call --instance <instance-id> --command creator.asset.move.plan --input <sourceAssetPath,destinationAssetPath>',
  '  call --instance <instance-id> --command creator.asset.move.commit --input <operationId,planHash>',
  '  call --instance <instance-id> --command creator.asset.move.reconcile --input <operationId>',
  '  call --instance <instance-id> --command creator.asset.delete.plan --input <assetUuid>',
  '  call --instance <instance-id> --command creator.asset.delete.commit --input <operationId,planHash>',
  '  call --instance <instance-id> --command creator.asset.delete.reconcile --input <operationId>',
  '  call --instance <instance-id> --command creator.asset.import-settings.plan --input <assetUuid,settings-json>',
  '  call --instance <instance-id> --command creator.asset.import-settings.commit --input <operationId,planHash>',
  '  call --instance <instance-id> --command creator.asset.import-settings.reconcile --input <operationId>',
  '  script read --instance <instance-id> --path <assets-relative.js-or.ts>',
  '  scene snapshot --instance <instance-id>',
  '  scene diff --before <snapshot.json> --after <snapshot.json>',
  '  call --instance <instance-id> --command creator.scene.node.rename.plan --input <sceneUuid,nodeUuid,newName>',
  '  call --instance <instance-id> --command creator.scene.node.rename.commit --input <operationId,planHash>',
  '  call --instance <instance-id> --command creator.scene.node.rename.reconcile --input <operationId>',
  '  call --instance <instance-id> --command creator.scene.node.delete.plan --input <sceneUuid,nodeUuid>',
  '  call --instance <instance-id> --command creator.scene.node.delete.commit --input <operationId,planHash>',
  '  call --instance <instance-id> --command creator.scene.node.delete.reconcile --input <operationId>',
  '  call --instance <instance-id> --command creator.scene.node.reparent.plan --input <sceneUuid,nodeUuid,targetParentUuid>',
  '  call --instance <instance-id> --command creator.scene.node.reparent.commit --input <operationId,planHash>',
  '  call --instance <instance-id> --command creator.scene.node.reparent.reconcile --input <operationId>',
  '  call --instance <instance-id> --command creator.scene.node.set-transform.plan --input <sceneUuid,nodeUuid,values-json>',
  '  call --instance <instance-id> --command creator.scene.node.set-transform.commit --input <operationId,planHash>',
  '  call --instance <instance-id> --command creator.scene.node.set-transform.reconcile --input <operationId>',
  '  call --instance <instance-id> --command creator.scene.button-events.set.plan --input <sceneUuid,nodeUuid,componentInstanceId,events-json>',
  '  call --instance <instance-id> --command creator.scene.button-events.set.commit --input <operationId,planHash>',
  '  call --instance <instance-id> --command creator.scene.button-events.set.reconcile --input <operationId>',
  '  call --instance <instance-id> --command creator.scene.node.add-component.plan --input <json-object>',
  '  call --instance <instance-id> --command creator.scene.node.add-component.commit --input <json-object>',
  '  call --instance <instance-id> --command creator.scene.node.add-component.reconcile --input <json-object>',
  '  call --instance <instance-id> --command creator.scene.node.remove-component.plan --input <sceneUuid,nodeUuid,componentClassName,componentInstanceId>',
  '  call --instance <instance-id> --command creator.scene.node.remove-component.commit --input <operationId,planHash>',
  '  call --instance <instance-id> --command creator.scene.node.remove-component.reconcile --input <operationId>',
  '  call --instance <instance-id> --command creator.scene.node.set-component-property.plan --input <json-object>',
  '  call --instance <instance-id> --command creator.scene.node.set-component-property.commit --input <json-object>',
  '  call --instance <instance-id> --command creator.scene.node.set-component-property.reconcile --input <json-object>',
  '  creator build --project-root <path> --creator <Creator-2.4.15.app> --platform web-mobile|web-desktop|android|ios|mac|win32 [--build-path <new-path>] [--debug] [--auto-compile] [--timeout-ms N]',
  '  creator compile --project-root <path> --creator <Creator-2.4.15.app> --platform android|ios|mac|win32 --build-path <existing-native-build-path> [--debug] [--timeout-ms N]',
  '  creator test --instance <instance-id> --session <preview-session-id> --input <actions-and-assertions-json>',
  '  creator test --project-root <path> [--list] [--suite <id>] [--rerun-failed <results.json>] [--shard <index>/<total>] [--coverage] [--instance <id>] [--session <id>] [--report-dir <new-path>]',
  '  creator watch --instance <instance-id> --session <preview-session-id> --paths <project-relative-paths-json> --input <actions-and-assertions-json> [--interval-ms N]',
  '  creator watch --project-root <path> --paths <files-or-directories-json> [--affected] [--suite <id>] [--instance <id>] [--session <id>] [--report-dir <path>]',
  '  diagnostics read --instance <instance-id> [--after-sequence N] [--limit N]',
  '  preview start --instance <instance-id> [--port 7456]',
  '  preview observe|screenshot|refresh|stop --instance <instance-id> --session <preview-session-id>',
  '  preview interact --instance <instance-id> --session <preview-session-id> --input <actions-and-assertions-json>',
  '  tasks start --instance <instance-id> --command <command-id> --input <json-object>',
  '  tasks status --id <task-id> | wait --id <task-id> [--after-sequence N] [--wait-ms N]',
  '  tasks list [--instance <instance-id>] | cancel --id <task-id>',
  '  tasks resume --instance <instance-id> --id <task-id>',
  '  call --instance <instance-id> --command <command-id> --input <json-object>',
  'Global: --format json | --json (errors are JSON on stdout)',
];

function helpText(parts = []) {
  const catalogLines = [...COMMANDS.values()].map((command) => `  call --command ${command.id} (${command.access}): ${command.description}`);
  const lines = [...HELP_LINES, ...catalogLines];
  if (!parts.length) return HELP_LINES.join('\n');
  if (parts[0] === 'search') {
    const terms = parts.slice(1).join(' ').trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return 'Usage: cocos-creator-agent help search <query>';
    const matches = lines.filter((line) => terms.every((term) => line.toLowerCase().includes(term)));
    return matches.length ? matches.join('\n') : `No help matches: ${parts.slice(1).join(' ')}`;
  }
  const prefix = parts.join(' ').toLowerCase();
  const matches = HELP_LINES.filter((line) => line.trim().toLowerCase().startsWith(prefix));
  return matches.length ? matches.join('\n') : `No help matches: ${parts.join(' ')}`;
}

function normalizedErrorCode(error) {
  if (typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]+$/.test(error.code)) return error.code;
  const message = error?.message || String(error);
  if (/Unknown (command|MCP action|skill action|Creator workflow)/i.test(message)) return 'CLI_UNKNOWN_COMMAND';
  if (/Only --format json is supported/i.test(message)) return 'CLI_USAGE_ERROR';
  return message.match(/^([A-Z][A-Z0-9_]{2,})(?=[:\s]|$)/)?.[1] || 'CLI_ERROR';
}

function failureExitCode(code, message) {
  if (code.startsWith('UNKNOWN_') || code.startsWith('INVALID_') || code.startsWith('REQUIRED_')
    || code.endsWith('_REQUIRED') || code.endsWith('_UNSUPPORTED') || code.startsWith('UNSUPPORTED_')
    || code.includes('_EXCLUSIVE') || code === 'CLI_UNKNOWN_COMMAND'
    || /Unknown (command|MCP action|skill action|Creator workflow)/i.test(message)
    || code === 'CLI_USAGE_ERROR') return 2;
  if (code.startsWith('OPERATION_') || code.includes('PRECONDITION') || code.includes('APPROVAL')
    || code.includes('CONFLICT') || code.includes('RECONCILIATION')) return 5;
  if (code.startsWith('BRIDGE_') || code.startsWith('MCP_') || code.startsWith('CREATOR_INSTANCE_')) return 3;
  if (code.startsWith('CREATOR_') || code.startsWith('PROJECT_') || code.startsWith('BUILD_')
    || code.startsWith('NATIVE_')) return 4;
  return 1;
}

function setFailureExitCode(code) {
  process.exitCode = Math.max(process.exitCode || 0, code);
}

for (let index = args.length - 1; index >= 0; index -= 1) {
  if (args[index] === '--json') { jsonOutput = true; args.splice(index, 1); }
  else if (args[index] === '--format') {
    if (args[index + 1] !== 'json') globalOptionError = 'Only --format json is supported.';
    else jsonOutput = true;
    args.splice(index, 2);
  }
}

function fail(error, code = 2) {
  const message = error?.message || String(error);
  const errorCode = normalizedErrorCode(error);
  const exitCode = error?.exitCode || (code !== 2 ? code : failureExitCode(errorCode, message));
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, success: false, exitCode,
      error: {
      code: errorCode, kind: exitCode === 2 ? 'usage' : exitCode === 3 ? 'bridge' : exitCode === 4 ? 'creator' : exitCode === 5 ? 'conflict' : 'runtime', message,
      ...(error?.detail === undefined ? {} : { detail: error.detail }),
    } })}\n`);
  } else process.stderr.write(`${message}\n`);
  process.exitCode = exitCode;
}

function value(flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
}

function print(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }

function parseInput() {
  const raw = value('--input', '{}');
  let result;
  try { result = JSON.parse(raw); }
  catch (_) { throw Object.assign(new Error('--input must be valid JSON'), { code: 'INPUT_JSON_INVALID' }); }
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw Object.assign(new Error('--input must be a JSON object'), { code: 'INPUT_OBJECT_REQUIRED' });
  return result;
}

const extensionSource = path.join(root, 'creator-extension');

async function main() {
  if (globalOptionError) throw Object.assign(new Error(globalOptionError), { code: 'CLI_USAGE_ERROR' });
  const [group, action, ...rest] = args;
  if (group === 'help') {
    process.stdout.write(`${helpText(args.slice(1))}\n`);
    return;
  }
  if (!group || group === '--help' || group === '-h' || args.some((item) => item === '--help' || item === '-h')) {
    const helpArgs = !group || group === '--help' || group === '-h' ? [] : args.filter((item) => item !== '--help' && item !== '-h');
    process.stdout.write(`${helpText(helpArgs)}\n`);
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
  if (group === 'mcp') {
    if (action === 'serve') { await import('./mcp/server.mjs'); return; }
    if (action === 'list' || action === '--list') {
      print({ clients: supportedMcpClients().map((client) => ({ ...client,
        status: mcpStatus(client.id).status })) });
      return;
    }
    if (action === 'status') {
      const client = rest[0];
      print(mcpStatus(client));
      return;
    }
    if (action === 'configure') {
      const client = rest[0];
      print(configureMcp(client, { force: args.includes('--force'), local: args.includes('--local'), dryRun: args.includes('--dry-run') }));
      return;
    }
    if (action === 'remove') {
      const client = rest[0];
      const current = mcpStatus(client);
      if (current.status === 'not-configured' || current.status === 'client-not-installed') {
        print({ client, server: 'cocos-creator-agent', status: current.status });
        return;
      }
      if (current.status !== 'configured') throw new Error(`MCP_SERVER_CONFLICT: ${client} has a different ${current.server} configuration; remove it through the client after reviewing it.`);
      const command = client === 'codex' ? 'codex' : client === 'claude-code' ? 'claude' : null;
      if (!command) throw new Error('CLIENT_UNSUPPORTED: choose codex or claude-code');
      const { spawnSync } = await import('node:child_process');
      const removeArgs = client === 'codex' ? ['mcp', 'remove', 'cocos-creator-agent']
        : ['mcp', 'remove', '--scope', args.includes('--local') ? 'local' : 'user', 'cocos-creator-agent'];
      const result = spawnSync(command, removeArgs, { encoding: 'utf8', timeout: 30000, windowsHide: true });
      if (result.status !== 0) throw new Error(`MCP_REMOVE_FAILED: ${(result.stderr || result.stdout || result.error?.message || '').trim()}`);
      print({ client, server: 'cocos-creator-agent', status: 'removed' });
      return;
    }
    throw new Error('Unknown MCP action. Use mcp --help.');
  }
  if (group === 'skill') {
    if (action === 'show') {
      if (args.includes('--list')) { print(showSkill(undefined, { list: true })); return; }
      const name = rest.find((item) => !item.startsWith('--')) || 'cocos2-cli';
      const content = showSkill(name);
      if (jsonOutput) print({ name, content });
      else process.stdout.write(content);
      return;
    }
    if (action === 'list') {
      const client = rest.find((item) => !item.startsWith('--'));
      if (client) print({ client, skills: listSkillStatus(client, { local: args.includes('--local') }) });
      else print({ skills: availableSkills().map((name) => ({ name, path: `skills/${name}/SKILL.md` })) });
      return;
    }
    if (action === 'install' || action === 'refresh') {
      const client = rest[0];
      const selected = args.flatMap((item, index) => item === '--skill' && args[index + 1] ? [args[index + 1]] : []);
      const managed = action === 'refresh' && selected.length === 0
        ? listSkillStatus(client, { local: args.includes('--local') }).filter((item) => ['installed', 'modified'].includes(item.status)).map((item) => item.name)
        : selected;
      if (!['codex', 'claude-code'].includes(client)) throw new Error('SKILL_CLIENT_REQUIRED: choose codex or claude-code');
      if (action === 'refresh' && selected.length === 0 && managed.length === 0) {
        print({ client, scope: args.includes('--local') ? 'project' : 'user', results: [], success: true, installedCount: 0 });
        return;
      }
      const result = installSkills(client, { local: args.includes('--local'), force: args.includes('--force'),
        dryRun: args.includes('--dry-run'), selected: managed, packageVersion: packageInfo.version });
      print(result);
      if (!result.success) process.exitCode = 1;
      return;
    }
    throw new Error('Unknown skill action. Use skill --help.');
  }
  if (group === 'doctor') {
    const report = await runDoctor({ packageInfo, projectRoot: value('--project-root'), instanceId: value('--instance') });
    print(report);
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (group === 'vcs' && action === 'doctor') {
    const report = runVcsDoctor({ gitRoot: value('--git-root'), projectRoot: value('--project-root') });
    print(report);
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (group === 'vcs' && action === 'status') {
    print(runVcsStatus({ gitRoot: value('--git-root'), projectRoot: value('--project-root') }));
    return;
  }
  if (group === 'vcs' && action === 'diff') {
    print(runVcsDiff({ gitRoot: value('--git-root'), projectRoot: value('--project-root'),
      assetPath: value('--path'), from: value('--from', 'HEAD'), to: value('--to') }));
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
  if (group === 'extension' && action === 'commands' && rest[0] === 'list') {
    print(await getExtensionCommands(value('--instance'))); return;
  }
  if (group === 'extension' && action === 'command' && rest[0] === 'call') {
    print(await callExtensionCommand(value('--instance'), value('--provider'), value('--command'), parseInput(),
      { expectedFingerprint: value('--fingerprint') })); return;
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
  if (group === 'project' && action === 'open') {
    const result = await openCreatorProject({ projectRoot: value('--project-root'), creatorPath: value('--creator'),
      waitReady: !args.includes('--no-wait-ready'),
      timeoutMs: value('--timeout-ms') === undefined ? 120000 : Number(value('--timeout-ms')) });
    print(result);
    if (!result.success) setFailureExitCode(4);
    return;
  }
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
  if (group === 'asset' && action === 'references') {
    print(await callCommand(instanceId, 'creator.asset.references', { assetUuid: value('--uuid') })); return;
  }
  if (group === 'script' && action === 'read') {
    print(await callCommand(instanceId, 'creator.script.read', { scriptPath: value('--path') })); return;
  }
  if (group === 'scene' && action === 'snapshot') { print(await callCommand(instanceId, 'creator.scene.snapshot', {})); return; }
  if (group === 'scene' && action === 'diff') {
    const before = value('--before');
    const after = value('--after');
    if (!before || !after) throw new Error('scene diff requires --before and --after snapshot files');
    print(diffSceneSnapshotFiles(before, after)); return;
  }
  if (group === 'creator') {
    if (action === 'installations') {
      const searchRoot = value('--search-root');
      print(discoverCreatorInstallations(searchRoot ? { searchRoots: [searchRoot] } : {}));
      return;
    }
    if ((action === 'test' || action === 'watch') && value('--project-root') !== undefined) {
      const projectRoot = value('--project-root');
      if (value('--rerun-failed') !== undefined && action !== 'test')
        throw Object.assign(new Error('--rerun-failed is supported only by creator test'), { code: 'TEST_RERUN_FAILED_UNSUPPORTED' });
      if ((value('--shard') !== undefined || args.includes('--coverage')) && action !== 'test')
        throw Object.assign(new Error('--shard and --coverage are supported only by creator test'), { code: 'TEST_NODE_OPTIONS_UNSUPPORTED' });
      if (value('--rerun-failed') !== undefined && args.includes('--list'))
        throw Object.assign(new Error('--rerun-failed cannot be combined with --list'), { code: 'TEST_RERUN_FAILED_EXCLUSIVE' });
      if ((value('--shard') !== undefined || args.includes('--coverage')) && args.includes('--list'))
        throw Object.assign(new Error('--shard and --coverage require a test run, not --list'), { code: 'TEST_NODE_OPTIONS_UNSUPPORTED' });
      if (action === 'test' && args.includes('--list')) { print(loadTestPlan(projectRoot)); return; }
      const suiteIds = args.flatMap((item, index) => item === '--suite' ? [args[index + 1]] : []);
      if (action === 'test' && value('--rerun-failed') !== undefined) {
        if (suiteIds.length) throw Object.assign(new Error('--rerun-failed cannot be combined with --suite'), { code: 'TEST_RERUN_FAILED_EXCLUSIVE' });
        suiteIds.push(...loadFailedSuiteIds(projectRoot, value('--rerun-failed')));
      }
      const controller = new AbortController();
      const stop = () => controller.abort();
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
      try {
        const options = { projectRoot, suiteIds, instanceId, previewSessionId: value('--session'),
          reportDir: value('--report-dir'), signal: controller.signal,
          ...(action === 'test' ? { shard: parseTestShard(value('--shard')), coverage: args.includes('--coverage') } : {}) };
        if (action === 'test') {
          const result = await runTestPlan(options);
          print(result);
          if (!result.passed) setFailureExitCode(10);
        } else {
          let paths;
          try { paths = JSON.parse(value('--paths', '')); } catch (_) { throw new Error('--paths must be a JSON array of project-relative files or directories'); }
          if (!Array.isArray(paths) || !paths.length) throw new Error('WATCH_PATHS_INVALID');
          const result = await watchTestPlan({ ...options, paths, affected: args.includes('--affected'),
            intervalMs: value('--interval-ms') === undefined ? undefined : Number(value('--interval-ms')) },
          { signal: controller.signal, onEvent: (event) => process.stdout.write(JSON.stringify(event) + '\n') });
          if (!result.lastTestPassed) setFailureExitCode(10);
        }
      } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
      return;
    }
    if (action === 'test') {
      const testInput = parseInput();
      if (Object.hasOwn(testInput, 'previewSessionId')) throw new Error('PREVIEW_SESSION_ID_MUST_USE_SESSION_OPTION');
      const receipt = await callCommand(instanceId, 'creator.preview.interact', {
        ...testInput, previewSessionId: value('--session'),
      });
      const passed = receipt.result?.passed === true;
      print({ ...receipt, test: { passed, assertionCount: receipt.result?.assertions?.length || 0 } });
      if (!passed) setFailureExitCode(10);
      return;
    }
    if (action === 'watch') {
      const previewSessionId = value('--session');
      if (typeof previewSessionId !== 'string' || !previewSessionId) throw new Error('PREVIEW_SESSION_REQUIRED');
      let watchPaths;
      try { watchPaths = JSON.parse(value('--paths', '')); } catch (_) { throw new Error('--paths must be a JSON array of project-relative file paths'); }
      if (!Array.isArray(watchPaths)) throw new Error('--paths must be a JSON array of project-relative file paths');
      const testInput = parseInput();
      if (Object.hasOwn(testInput, 'previewSessionId')) throw new Error('PREVIEW_SESSION_ID_MUST_USE_SESSION_OPTION');
      const live = await listInstances({ start: false });
      const instance = (live.instances || []).find((item) => item.instanceId === instanceId);
      if (!instance) throw new Error('CREATOR_INSTANCE_NOT_FOUND');
      await callCommand(instanceId, 'creator.preview.observe', { previewSessionId });

      const signal = new AbortController();
      const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
      let sequence = 0;
      let lastPassed = true;
      let runQueue = Promise.resolve();
      const runCheck = (trigger, changedPaths = []) => {
        runQueue = runQueue.then(async () => {
          sequence += 1;
          try {
            if (trigger === 'file-change') {
              await callCommand(instanceId, 'creator.preview.refresh', { previewSessionId });
            }
            const receipt = await callCommand(instanceId, 'creator.preview.interact', {
              ...testInput, previewSessionId,
            });
            const passed = receipt.result?.passed === true;
            lastPassed = passed;
            emit({ type: 'preview-test', sequence, trigger, changedPaths,
              test: { passed, assertionCount: receipt.result?.assertions?.length || 0 }, receipt });
          } catch (error) {
            lastPassed = false;
            emit({ type: 'preview-test-error', sequence, trigger, changedPaths, error: error.message || String(error) });
          }
        });
        return runQueue;
      };
      const stop = () => signal.abort();
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
      let watcher;
      try {
        watcher = startProjectFileWatch({ projectRoot: instance.projectRoot, paths: watchPaths,
          intervalMs: value('--interval-ms') === undefined ? undefined : Number(value('--interval-ms')),
          signal: signal.signal, onChange: (changedPaths) => runCheck('file-change', changedPaths),
          onError: (error) => emit({ type: 'watch-error', error: error.code || error.message || String(error) }) });
        emit({ type: 'watch-started', instanceId, projectRoot: watcher.projectRoot, paths: watcher.paths,
          previewSessionId, creatorVersion: instance.creatorVersion, extensionVersion: instance.extensionVersion });
        await runCheck('initial');
        await watcher.done;
        await runQueue;
      } finally {
        stop();
        process.removeListener('SIGINT', stop);
        process.removeListener('SIGTERM', stop);
      }
      if (!lastPassed) setFailureExitCode(10);
      emit({ type: 'watch-stopped', runs: sequence, lastTestPassed: lastPassed });
      return;
    }
    if (action === 'build' || action === 'compile') {
      const result = await runCreatorWorkflow({ operation: action,
        projectRoot: value('--project-root'), creatorPath: value('--creator'), platform: value('--platform'),
        buildPath: value('--build-path'), debug: args.includes('--debug'), autoCompile: args.includes('--auto-compile'),
        timeoutMs: value('--timeout-ms') === undefined ? 1200000 : Number(value('--timeout-ms')) });
      print(result);
      if (!result.success) setFailureExitCode(4);
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
  throw Object.assign(new Error('Unknown command. Run cocos-creator-agent --help.'), { code: 'CLI_UNKNOWN_COMMAND' });
}

main().catch((error) => fail(error));
