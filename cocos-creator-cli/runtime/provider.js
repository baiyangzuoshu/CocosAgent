'use strict';

// Browser-safe runtime Provider helper for Creator 2.4 game scripts.
(function attach(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CocosCreatorAgentRuntime = api;
})(typeof window !== 'undefined' ? window : null, function createRuntimeApi() {
  const PROVIDER_ID = /^[a-z][a-z0-9-]{0,63}$/;
  const COMMAND_ID = /^[a-z][a-z0-9-]{0,47}$/;
  const ACCESS = new Set(['read', 'plan', 'write', 'control']);
  const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
  const RESERVED_INPUT_KEYS = new Set(['instanceId', 'previewSessionId']);
  const MAX_COMMANDS = 32;
  const MAX_SCHEMA_DEPTH = 6;
  const MAX_SCHEMA_NODES = 128;
  const MAX_ARGUMENT_BYTES = 16 * 1024;
  const MAX_RESULT_BYTES = 64 * 1024;
  const MAX_HANDLER_TIMEOUT_MS = 24000;
  const providers = new Map();

  function coded(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function utf8ByteLength(value) {
    let bytes = 0;
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length
        && value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    }
    return bytes;
  }

  function schemaKeys(value, allowed) {
    return Object.keys(value).every((key) => allowed.has(key));
  }

  function validateSchema(schema, depth, state) {
    state.nodes += 1;
    if (state.nodes > MAX_SCHEMA_NODES || depth > MAX_SCHEMA_DEPTH || !schema
      || typeof schema !== 'object' || Array.isArray(schema)) throw coded('RUNTIME_PROVIDER_SCHEMA_INVALID');
    if (schema.type === 'object') {
      const allowed = new Set(['type', 'properties', 'required', 'additionalProperties']);
      if (!schemaKeys(schema, allowed) || !schema.properties || typeof schema.properties !== 'object'
        || Array.isArray(schema.properties) || Object.keys(schema.properties).length > 32
        || schema.additionalProperties !== false) throw coded('RUNTIME_PROVIDER_SCHEMA_INVALID');
      for (const key of Object.keys(schema.properties)) {
        if (FORBIDDEN_KEYS.has(key) || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) throw coded('RUNTIME_PROVIDER_SCHEMA_INVALID');
      }
      for (const key of Object.keys(schema.properties)) validateSchema(schema.properties[key], depth + 1, state);
      if (schema.required !== undefined && (!Array.isArray(schema.required) || schema.required.length > 32
        || new Set(schema.required).size !== schema.required.length
        || schema.required.some((key) => typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(schema.properties, key))))
        throw coded('RUNTIME_PROVIDER_SCHEMA_INVALID');
      return;
    }
    if (schema.type === 'array') {
      if (!schemaKeys(schema, new Set(['type', 'items', 'minItems', 'maxItems'])) || !schema.items
        || !Number.isInteger(schema.minItems ?? 0) || !Number.isInteger(schema.maxItems)
        || schema.minItems < 0 || schema.maxItems < schema.minItems || schema.maxItems > 64)
        throw coded('RUNTIME_PROVIDER_SCHEMA_INVALID');
      validateSchema(schema.items, depth + 1, state);
      return;
    }
    if (!['string', 'number', 'integer', 'boolean'].includes(schema.type)) throw coded('RUNTIME_PROVIDER_SCHEMA_INVALID');
    const allowed = new Set(['type', 'enum', 'minLength', 'maxLength', 'minimum', 'maximum']);
    if (!schemaKeys(schema, allowed)) throw coded('RUNTIME_PROVIDER_SCHEMA_INVALID');
    if (schema.type === 'string') {
      if (schema.minLength !== undefined && (!Number.isInteger(schema.minLength) || schema.minLength < 0)
        || schema.maxLength !== undefined && (!Number.isInteger(schema.maxLength) || schema.maxLength > 4096)
        || (schema.minLength ?? 0) > (schema.maxLength ?? 4096)) throw coded('RUNTIME_PROVIDER_SCHEMA_INVALID');
    } else if (schema.type === 'number' || schema.type === 'integer') {
      if (schema.minimum !== undefined && !Number.isFinite(schema.minimum)
        || schema.maximum !== undefined && !Number.isFinite(schema.maximum)
        || (schema.minimum ?? -1e12) > (schema.maximum ?? 1e12)
        || Math.abs(schema.minimum ?? 0) > 1e12 || Math.abs(schema.maximum ?? 0) > 1e12)
        throw coded('RUNTIME_PROVIDER_SCHEMA_INVALID');
    } else if (Object.keys(schema).some((key) => !['type', 'enum'].includes(key))) throw coded('RUNTIME_PROVIDER_SCHEMA_INVALID');
    if (schema.enum !== undefined && (!Array.isArray(schema.enum) || schema.enum.length < 1 || schema.enum.length > 32
      || schema.enum.some((item) => schema.type === 'string' ? typeof item !== 'string' || item.length > 256
        : schema.type === 'boolean' ? typeof item !== 'boolean'
          : typeof item !== 'number' || !Number.isFinite(item) || (schema.type === 'integer' && !Number.isInteger(item)))))
      throw coded('RUNTIME_PROVIDER_SCHEMA_INVALID');
  }

  function normalizeMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)
      || !schemaKeys(metadata, new Set(['providerId', 'protocolVersion', 'commands']))
      || typeof metadata.providerId !== 'string' || !PROVIDER_ID.test(metadata.providerId)
      || metadata.protocolVersion !== '1' || !Array.isArray(metadata.commands)
      || metadata.commands.length > MAX_COMMANDS) throw coded('RUNTIME_PROVIDER_METADATA_INVALID');
    const seen = new Set();
    const commands = metadata.commands.map((command) => {
      if (!command || typeof command !== 'object' || Array.isArray(command)
        || !schemaKeys(command, new Set(['id', 'title', 'description', 'access', 'approval', 'input']))
        || typeof command.id !== 'string' || !COMMAND_ID.test(command.id) || seen.has(command.id)
        || typeof command.title !== 'string' || !command.title.trim() || command.title.length > 80
        || typeof command.description !== 'string' || !command.description.trim() || command.description.length > 500
        || !ACCESS.has(command.access) || !command.input || command.input.type !== 'object'
        || ((command.access === 'write' || command.access === 'control') && command.approval !== true)
        || ((command.access === 'read' || command.access === 'plan') && command.approval === true))
        throw coded('RUNTIME_PROVIDER_COMMAND_INVALID');
      validateSchema(command.input, 0, { nodes: 0 });
      for (const key of RESERVED_INPUT_KEYS) {
        if (Object.prototype.hasOwnProperty.call(command.input.properties || {}, key)) throw coded('RUNTIME_PROVIDER_SCHEMA_RESERVED_FIELD');
      }
      seen.add(command.id);
      return { id: command.id, title: command.title.trim(), description: command.description.trim(),
        access: command.access, approval: command.approval === true, input: JSON.parse(JSON.stringify(command.input)) };
    });
    return { providerId: metadata.providerId, protocolVersion: metadata.protocolVersion, commands };
  }

  function validateArguments(schema, input) {
    let serialized;
    try { serialized = JSON.stringify(input); } catch (_) { throw coded('RUNTIME_PROVIDER_INPUT_INVALID'); }
    if (serialized === undefined || utf8ByteLength(serialized) > MAX_ARGUMENT_BYTES
      || !input || typeof input !== 'object' || Array.isArray(input))
      throw coded('RUNTIME_PROVIDER_INPUT_INVALID');
    function visit(shape, value, depth) {
      if (depth > MAX_SCHEMA_DEPTH) throw coded('RUNTIME_PROVIDER_INPUT_INVALID');
      if (shape.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw coded('RUNTIME_PROVIDER_INPUT_INVALID');
        const props = shape.properties || {};
        if (Object.keys(value).some((key) => FORBIDDEN_KEYS.has(key) || !Object.prototype.hasOwnProperty.call(props, key)))
          throw coded('RUNTIME_PROVIDER_INPUT_UNKNOWN_FIELD');
        for (const key of shape.required || []) if (!Object.prototype.hasOwnProperty.call(value, key)) throw coded('RUNTIME_PROVIDER_INPUT_REQUIRED');
        for (const key of Object.keys(value)) visit(props[key], value[key], depth + 1);
        return;
      }
      if (shape.type === 'array') {
        if (!Array.isArray(value) || value.length < (shape.minItems ?? 0) || value.length > shape.maxItems)
          throw coded('RUNTIME_PROVIDER_INPUT_INVALID');
        for (const item of value) visit(shape.items, item, depth + 1);
        return;
      }
      const ok = shape.type === 'string' ? typeof value === 'string' && !value.includes('\0')
        && value.length >= (shape.minLength ?? 0) && value.length <= (shape.maxLength ?? 4096)
        : shape.type === 'boolean' ? typeof value === 'boolean'
          : (shape.type === 'integer' ? Number.isInteger(value) : typeof value === 'number' && Number.isFinite(value))
            && value >= (shape.minimum ?? -1e12) && value <= (shape.maximum ?? 1e12);
      if (!ok || shape.enum && !shape.enum.includes(value)) throw coded('RUNTIME_PROVIDER_INPUT_INVALID');
    }
    visit(schema, input, 0);
    return input;
  }

  function registerProvider(metadata, handlers) {
    const normalized = normalizeMetadata(metadata);
    if (providers.has(normalized.providerId)) throw coded('RUNTIME_PROVIDER_DUPLICATE');
    if (!handlers || typeof handlers !== 'object' || Array.isArray(handlers)) throw coded('RUNTIME_PROVIDER_HANDLERS_INVALID');
    const handlerIds = Object.keys(handlers);
    if (handlerIds.length !== normalized.commands.length || handlerIds.some((id) =>
      !normalized.commands.some((command) => command.id === id) || typeof handlers[id] !== 'function'))
      throw coded('RUNTIME_PROVIDER_HANDLERS_INVALID');
    providers.set(normalized.providerId, { metadata: normalized, handlers });
    return { providerId: normalized.providerId, commandCount: normalized.commands.length };
  }

  function describe() {
    return Array.from(providers.values(), (provider) => JSON.parse(JSON.stringify(provider.metadata)));
  }

  function invoke(request) {
    let timer;
    const execution = Promise.resolve().then(() => {
      if (!request || typeof request !== 'object' || Array.isArray(request)) throw coded('RUNTIME_PROVIDER_REQUEST_INVALID');
      const provider = providers.get(request.providerId);
      if (!provider) throw coded('RUNTIME_PROVIDER_NOT_FOUND');
      if (canonical(provider.metadata) !== request.expectedMetadata) throw coded('RUNTIME_PROVIDER_CHANGED');
      const command = provider.metadata.commands.find((item) => item.id === request.commandId);
      if (!command) throw coded('RUNTIME_PROVIDER_COMMAND_NOT_FOUND');
      const timeoutMs = request.timeoutMs === undefined ? MAX_HANDLER_TIMEOUT_MS : request.timeoutMs;
      if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > MAX_HANDLER_TIMEOUT_MS)
        throw coded('RUNTIME_PROVIDER_TIMEOUT_INVALID');
      const input = validateArguments(command.input, request.input);
      const clonedInput = JSON.parse(JSON.stringify(input));
      return Promise.resolve(provider.handlers[command.id](clonedInput)).then((result) => {
        const serialized = JSON.stringify(result === undefined ? null : result);
        if (serialized === undefined || utf8ByteLength(serialized) > MAX_RESULT_BYTES) throw coded('RUNTIME_PROVIDER_RESULT_TOO_LARGE');
        return JSON.parse(serialized);
      });
    });
    const bounded = new Promise((resolve, reject) => {
      const timeoutMs = Number.isInteger(request?.timeoutMs) ? request.timeoutMs : MAX_HANDLER_TIMEOUT_MS;
      timer = setTimeout(() => reject(coded('RUNTIME_PROVIDER_TIMEOUT_UNCERTAIN')), timeoutMs);
      execution.then(resolve, reject);
    });
    return bounded.then((result) => {
      clearTimeout(timer);
      return { ok: true, result };
    }, (error) => {
      clearTimeout(timer);
      return { ok: false, error: { code: error.code || 'RUNTIME_PROVIDER_COMMAND_FAILED',
        message: String(error.message || error).slice(0, 240) } };
    });
  }

  return { registerProvider, describe, invoke, normalizeMetadata, validateArguments, canonical };
});
