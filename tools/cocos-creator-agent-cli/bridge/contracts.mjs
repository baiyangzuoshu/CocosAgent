import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const contractPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension/command-contract.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

export const PROTOCOL_VERSION = '0.1';
export const CREATOR_VERSION = contract.creatorVersion;
export const COMMANDS = new Map(contract.commands.map((item) => [item.id, item]));

export function validateCommand(commandId, input) {
  const command = COMMANDS.get(commandId);
  if (!command) return { ok: false, code: 'UNKNOWN_COMMAND' };
  if (command.access !== 'read') return { ok: false, code: 'ACCESS_NOT_SUPPORTED' };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, code: 'INVALID_INPUT' };
  const schema = command.input;
  const required = schema.required || [];
  if (required.some((key) => input[key] === undefined)) return { ok: false, code: 'REQUIRED_INPUT_MISSING' };
  if (schema.additionalProperties === false && Object.keys(input).some((key) => !schema.properties[key]))
    return { ok: false, code: 'UNKNOWN_INPUT_FIELD' };
  for (const [key, value] of Object.entries(input)) {
    const field = schema.properties[key];
    if (!field) return { ok: false, code: 'UNKNOWN_INPUT_FIELD' };
    if (field.type === 'string') {
      if (typeof value !== 'string' || value.includes('\0')
        || (field.minLength !== undefined && value.length < field.minLength)
        || (field.maxLength !== undefined && value.length > field.maxLength)
        || (field.pattern && !new RegExp(field.pattern).test(value))
        || (field.enum && !field.enum.includes(value))) return { ok: false, code: 'INVALID_INPUT_FIELD', field: key };
    } else if (field.type === 'integer') {
      if (!Number.isInteger(value) || value < field.minimum || value > field.maximum)
        return { ok: false, code: 'INVALID_INPUT_FIELD', field: key };
    } else return { ok: false, code: 'UNSUPPORTED_CONTRACT_TYPE', field: key };
  }
  return { ok: true, command };
}

export function publicCatalog(capabilities = []) {
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  return contract.commands.map((item) => {
    const status = byId.get(item.id);
    return {
      id: item.id,
      access: item.access,
      description: item.description,
      input: item.input,
      status: status?.status === 'available' ? 'available' : 'unavailable',
      reason: status?.status === 'available' ? null : (status?.reason || 'COMMAND_NOT_ADVERTISED'),
    };
  });
}
