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
  if (!['read', 'plan', 'write', 'control'].includes(command.access)) return { ok: false, code: 'ACCESS_NOT_SUPPORTED' };
  const checked = validateValue(command.input, input, 'input');
  if (!checked.ok) return checked;
  return { ok: true, command };
}

function validateValue(schema, value, fieldPath) {
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.reduce((count, alternative) => count + (validateValue(alternative, value, fieldPath).ok ? 1 : 0), 0);
    if (matches !== 1) return { ok: false, code: 'INVALID_INPUT_FIELD', field: fieldPath };
    return { ok: true };
  }
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const matches = (type) => type === 'object' ? !!value && typeof value === 'object' && !Array.isArray(value)
    : type === 'array' ? Array.isArray(value)
      : type === 'integer' ? Number.isInteger(value)
        : type === 'number' ? typeof value === 'number' && Number.isFinite(value)
          : type === 'boolean' ? typeof value === 'boolean'
            : type === 'string' ? typeof value === 'string' : false;
  if (!types.some(matches)) return { ok: false, code: fieldPath === 'input' ? 'INVALID_INPUT' : 'INVALID_INPUT_FIELD', field: fieldPath };
  if (value === null || value === undefined) return { ok: true };
  if (typeof value === 'string') {
    if (value.includes('\0') || (schema.minLength !== undefined && value.length < schema.minLength)
      || (schema.maxLength !== undefined && value.length > schema.maxLength)
      || (schema.pattern && !new RegExp(schema.pattern).test(value))
      || (schema.enum && !schema.enum.includes(value))) return { ok: false, code: 'INVALID_INPUT_FIELD', field: fieldPath };
  }
  if (typeof value === 'number') {
    if ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)
      || (schema.enum && !schema.enum.includes(value))) return { ok: false, code: 'INVALID_INPUT_FIELD', field: fieldPath };
  }
  if (types.includes('object') && value && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    for (const key of schema.required || []) if (value[key] === undefined)
      return { ok: false, code: 'REQUIRED_INPUT_MISSING', field: `${fieldPath}.${key}` };
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(properties, key)))
      return { ok: false, code: 'UNKNOWN_INPUT_FIELD', field: fieldPath };
    for (const [key, child] of Object.entries(value)) {
      if (!Object.hasOwn(properties, key)) return { ok: false, code: 'UNKNOWN_INPUT_FIELD', field: `${fieldPath}.${key}` };
      const result = validateValue(properties[key], child, `${fieldPath}.${key}`);
      if (!result.ok) return result;
    }
  }
  if (types.includes('array') && Array.isArray(value)) {
    if ((schema.minItems !== undefined && value.length < schema.minItems) || (schema.maxItems !== undefined && value.length > schema.maxItems))
      return { ok: false, code: 'INVALID_INPUT_FIELD', field: fieldPath };
    if (schema.items) for (let index = 0; index < value.length; index += 1) {
      const result = validateValue(schema.items, value[index], `${fieldPath}[${index}]`);
      if (!result.ok) return result;
    }
  }
  return { ok: true };
}

export function publicCatalog(capabilities = []) {
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  return contract.commands.map((item) => {
    const status = byId.get(item.id);
    if (item.execution === 'bridge') return {
      id: item.id, access: item.access, description: item.description, input: item.input,
      status: status?.status === 'available' ? 'available' : 'unavailable',
      reason: status?.status === 'available' ? null : (status?.reason || 'BRIDGE_CAPABILITY_UNAVAILABLE'),
    };
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
