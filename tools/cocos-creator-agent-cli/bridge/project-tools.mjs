import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { COMMANDS } from './contracts.mjs';

const MAX_REGISTRY_BYTES = 64 * 1024;
const MAX_TOOLS = 64;
const TOOL_ID = /^[a-z][a-z0-9-]{0,47}$/;

function missing(error) { return error && error.code === 'ENOENT'; }

export function readProjectTools(projectRoot) {
  const directory = path.join(projectRoot, '.cocos-agent');
  const filename = path.join(directory, 'tools.json');
  let dirStat;
  try { dirStat = fs.lstatSync(directory); }
  catch (error) {
    if (missing(error)) return { schemaVersion: 1, status: 'not-configured', registryHash: null, tools: [] };
    throw error;
  }
  if (!dirStat.isDirectory() || dirStat.isSymbolicLink()) throw coded('PROJECT_TOOLS_DIRECTORY_UNSAFE');
  const realDirectory = fs.realpathSync(directory);
  if (realDirectory !== path.resolve(directory)) throw coded('PROJECT_TOOLS_DIRECTORY_UNSAFE');

  let fileStat;
  try { fileStat = fs.lstatSync(filename); }
  catch (error) {
    if (missing(error)) return { schemaVersion: 1, status: 'not-configured', registryHash: null, tools: [] };
    throw error;
  }
  if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.size > MAX_REGISTRY_BYTES)
    throw coded('PROJECT_TOOLS_REGISTRY_UNSAFE');
  const bytes = fs.readFileSync(filename);
  const registryHash = createHash('sha256').update(bytes).digest('hex');
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); }
  catch (_) { throw coded('PROJECT_TOOLS_REGISTRY_INVALID_JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1
    || !Array.isArray(value.tools) || value.tools.length > MAX_TOOLS
    || Object.keys(value).some((key) => !['schemaVersion', 'tools'].includes(key)))
    throw coded('PROJECT_TOOLS_REGISTRY_INVALID');

  const seen = new Set();
  const tools = value.tools.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || Object.keys(item).some((key) => !['id', 'title', 'description', 'commandId'].includes(key))
      || typeof item.id !== 'string' || !TOOL_ID.test(item.id) || seen.has(item.id)
      || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 80
      || typeof item.description !== 'string' || !item.description.trim() || item.description.length > 500
      || typeof item.commandId !== 'string') throw coded('PROJECT_TOOL_DECLARATION_INVALID');
    seen.add(item.id);
    const command = COMMANDS.get(item.commandId);
    // Project registries can alias existing read-only Creator operations. They
    // cannot add executable callbacks, widen a schema, or register writes.
    if (!command || command.access !== 'read' || command.execution === 'bridge')
      throw coded('PROJECT_TOOL_COMMAND_NOT_ALLOWED');
    return { id: item.id, title: item.title.trim(), description: item.description.trim(),
      commandId: command.id, access: 'read', input: command.input };
  });
  return { schemaVersion: 1, status: 'ready', registryHash, registryPath: filename, tools };
}

export function resolveProjectTool(projectRoot, toolId) {
  const registry = readProjectTools(projectRoot);
  const tool = registry.tools.find((item) => item.id === toolId);
  if (!tool) throw coded('PROJECT_TOOL_NOT_FOUND');
  return { registry, tool };
}

function coded(code) { return Object.assign(new Error(code), { code }); }
