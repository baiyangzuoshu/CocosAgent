#!/usr/bin/env node
import { execFile } from 'node:child_process';
import readline from 'node:readline';

const SERVER_NAME = 'cocos-creator-agent';
const SERVER_VERSION = '0.2.0';
const CLI_COMMAND = process.env.COCOS_CREATOR_AGENT_CLI || 'cocos-creator-agent';
const INSTANCE_ID_SCHEMA = { type: 'string', minLength: 36, maxLength: 36 };
const READ_ONLY_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false };

// MCP names are Host-facing aliases. Descriptions and command input schemas
// come from the standalone CLI catalog; this list only adapts names/protocol.
const commandToolAdapters = [
  { commandId: 'creator.project.info', name: 'cocos_project_info' },
  { commandId: 'creator.project.search', name: 'cocos_project_search' },
  { commandId: 'creator.asset.search', name: 'cocos_asset_search' },
  { commandId: 'creator.script.read', name: 'cocos_script_read' },
  { commandId: 'creator.scene.snapshot', name: 'cocos_scene_snapshot' },
];

function invokeCli(args) {
  return new Promise((resolve, reject) => {
    execFile(CLI_COMMAND, args, { encoding: 'utf8', timeout: 40000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const detail = (stderr || stdout || error.message || String(error)).trim();
        const wrapped = new Error(detail || 'COCOS_CLI_FAILED');
        wrapped.code = error.code || 'COCOS_CLI_FAILED';
        reject(wrapped);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function invokeCliJson(args) {
  const output = await invokeCli([...args, '--format', 'json']);
  try { return JSON.parse(output); }
  catch (_) { throw new Error(`COCOS_CLI_INVALID_JSON:${output.slice(0, 300)}`); }
}

function commandInputSchema(input) {
  const properties = input.properties || {};
  if (Object.hasOwn(properties, 'instanceId')) throw new Error('Creator command input cannot use reserved MCP field: instanceId');
  return {
    ...input,
    required: [...new Set(['instanceId', ...(input.required || [])])],
    properties: { ...properties, instanceId: INSTANCE_ID_SCHEMA },
    additionalProperties: input.additionalProperties ?? false,
  };
}

const infrastructureTools = [
  {
    name: 'cocos_cli_status',
    description: 'Check whether the standalone Cocos Creator CLI is installed and read its version.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: 'cocos_instances_list',
    description: 'List Creator 2.4.15 editor instances connected to the local Cocos bridge.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: 'cocos_capabilities_list',
    description: 'Read the live command catalog for one explicit Creator instance.',
    inputSchema: {
      type: 'object', required: ['instanceId'],
      properties: { instanceId: INSTANCE_ID_SCHEMA }, additionalProperties: false,
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
];

async function getTools() {
  const tools = [...infrastructureTools];
  let catalog;
  try { catalog = await invokeCliJson(['catalog']); }
  catch (error) {
    process.stderr.write(`Cocos CLI unavailable; Creator command tools omitted: ${error.message}\n`);
    return tools;
  }
  if (!catalog || !Array.isArray(catalog.commands)) throw new Error('COCOS_CLI_CATALOG_INVALID');
  const commands = new Map(catalog.commands.map((command) => [command.id, command]));
  for (const { commandId, name } of commandToolAdapters) {
    const command = commands.get(commandId);
    if (!command) continue;
    tools.push({
      name,
      description: command.description,
      inputSchema: commandInputSchema(command.input),
      annotations: READ_ONLY_ANNOTATIONS,
    });
  }
  return tools;
}

async function handleTool(name, args = {}) {
  if (name === 'cocos_cli_status') {
    try { return { available: true, command: CLI_COMMAND, ...(await invokeCliJson(['version'])) }; }
    catch (error) {
      return { available: false, command: CLI_COMMAND, error: error.message,
        installHint: 'Install the standalone cocos-creator-agent-cli package, then restart the Host MCP server.' };
    }
  }
  if (name === 'cocos_instances_list') return invokeCliJson(['instances', 'list']);
  if (name === 'cocos_capabilities_list') {
    if (typeof args.instanceId !== 'string' || !args.instanceId) throw new Error('INSTANCE_ID_REQUIRED');
    return invokeCliJson(['capabilities', '--instance', args.instanceId]);
  }
  const adapter = commandToolAdapters.find((item) => item.name === name);
  if (!adapter) throw new Error('Unknown tool name.');
  const { instanceId, ...input } = args;
  if (typeof instanceId !== 'string' || !instanceId) throw new Error('INSTANCE_ID_REQUIRED');
  return invokeCliJson(['call', '--instance', instanceId, '--command', adapter.commandId, '--input', JSON.stringify(input)]);
}

function write(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }
function rpcError(id, code, message) { write({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(message) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return;
  const hasId = Object.prototype.hasOwnProperty.call(message, 'id');
  const id = hasId ? message.id : null;
  if (!hasId && message.method !== 'notifications/initialized') return;
  try {
    if (message.method === 'initialize') {
      write({ jsonrpc: '2.0', id, result: { protocolVersion: message.params?.protocolVersion || '2024-11-05',
        capabilities: { tools: { listChanged: false } }, serverInfo: { name: SERVER_NAME, version: SERVER_VERSION } } });
      return;
    }
    if (message.method === 'notifications/initialized') return;
    if (message.method === 'ping') { if (hasId) write({ jsonrpc: '2.0', id, result: {} }); return; }
    if (message.method === 'tools/list') { write({ jsonrpc: '2.0', id, result: { tools: await getTools() } }); return; }
    if (message.method === 'tools/call') {
      const result = await handleTool(message.params?.name, message.params?.arguments || {});
      write({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false } });
      return;
    }
    if (hasId) rpcError(id, -32601, `Method not found: ${message.method}`);
  } catch (error) {
    if (message.method === 'tools/call') {
      write({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: error.message || String(error) }], isError: true } });
    } else if (hasId) rpcError(id, -32603, error.message || String(error));
  }
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
input.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try { message = JSON.parse(line); }
  catch (_) { rpcError(null, -32700, 'Parse error.'); return; }
  handle(message).catch((error) => process.stderr.write(`MCP handler failed: ${error.message || error}\n`));
});
input.on('close', () => { process.exitCode = 0; });
