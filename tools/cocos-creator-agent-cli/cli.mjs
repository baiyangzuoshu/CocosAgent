#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { bridgeStatus, stopBridge, ensureBridge, listInstances, getCapabilities, callCommand, pluginRoot } from './bridge/client.mjs';
import { COMMANDS, CREATOR_VERSION } from './bridge/contracts.mjs';

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

function validateProjectRoot(projectRoot) {
  if (!projectRoot || !path.isAbsolute(projectRoot)) throw new Error('--project-root must be an absolute path');
  const rootPath = fs.realpathSync(projectRoot);
  const stat = fs.statSync(rootPath);
  const projectFile = path.join(rootPath, 'project.json');
  const projectStat = fs.lstatSync(projectFile);
  if (!stat.isDirectory() || !projectStat.isFile() || projectStat.isSymbolicLink()) throw new Error('Target is not a Cocos Creator project root.');
  return rootPath;
}

function installExtension(projectRoot) {
  const targetRoot = validateProjectRoot(projectRoot);
  const packagesPath = path.join(targetRoot, 'packages');
  if (fs.existsSync(packagesPath)) {
    const packagesStat = fs.lstatSync(packagesPath);
    if (!packagesStat.isDirectory() || packagesStat.isSymbolicLink()) throw new Error('Refusing to install through a non-directory or symbolic-link packages path.');
  } else fs.mkdirSync(packagesPath);
  const destination = path.join(packagesPath, 'cocos-creator-agent-extension');
  try {
    fs.lstatSync(destination);
    throw new Error(`Refusing to overwrite existing extension: ${destination}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const source = path.join(root, 'creator-extension');
  const sourceStat = fs.lstatSync(source);
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw new Error('Bundled Creator extension directory is unavailable.');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, errorOnExist: true, filter: (filename) => {
    try { return !fs.lstatSync(filename).isSymbolicLink(); } catch (_) { return false; }
  } });
  return { installed: true, projectRoot: targetRoot, extensionPath: destination,
    note: 'Creator must reload this project package before the extension can register.' };
}

async function main() {
  if (globalOptionError) throw new Error(globalOptionError);
  const [group, action, ...rest] = args;
  if (group === '--help' || group === '-h' || !group) {
    process.stdout.write([
      'Cocos Creator Agent CLI (Creator 2.4.15, read-only command set)',
      '  --version | version',
      '  catalog [--format json]',
      '  bridge start | status | stop',
      '  extension install --project-root <absolute-path>',
      '  instances list',
      '  capabilities --instance <instance-id>',
      '  project info --instance <instance-id>',
      '  project search --instance <instance-id> --query <text> [--scope all|code|assets] [--limit N]',
      '  asset search --instance <instance-id> [--query <text>] [--limit N]',
      '  script read --instance <instance-id> --path <assets-relative.js-or.ts>',
      '  scene snapshot --instance <instance-id>',
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
  if (group === 'bridge' && action === 'status') { print(await bridgeStatus()); return; }
  if (group === 'bridge' && action === 'start') {
    const state = await ensureBridge();
    print({ running: true, bridgeId: state.bridgeId, host: state.host, port: state.port, pid: state.pid });
    return;
  }
  if (group === 'bridge' && action === 'stop') { print(await stopBridge()); return; }
  if (group === 'extension' && action === 'install') { print(installExtension(value('--project-root'))); return; }

  const instanceId = value('--instance');
  if (group === 'instances' && action === 'list') { print(await listInstances()); return; }
  if (group === 'capabilities') { print(await getCapabilities(instanceId)); return; }
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
  throw new Error('Unknown command. Run cocos-creator-agent --help.');
}

main().catch((error) => fail(error.message || String(error)));
