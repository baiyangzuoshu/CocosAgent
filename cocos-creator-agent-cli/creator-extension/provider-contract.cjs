'use strict';

const crypto = require('crypto');

const PROVIDER_ID = /^[a-z][a-z0-9-]{0,63}$/;
const COMMAND_ID = /^[a-z][a-z0-9-]{0,47}$/;
const ACCESS = new Set(['read', 'plan', 'write', 'control']);
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_COMMANDS = 32;
const MAX_SCHEMA_DEPTH = 6;
const MAX_SCHEMA_NODES = 128;
const MAX_ARGUMENT_BYTES = 16 * 1024;

function coded(code) { return Object.assign(new Error(code), { code }); }

function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function schemaKeys(schema, allowed) {
    return Object.keys(schema).every((key) => allowed.has(key));
}

function validateSchema(schema, depth = 0, state = { nodes: 0 }) {
    state.nodes += 1;
    if (state.nodes > MAX_SCHEMA_NODES || depth > MAX_SCHEMA_DEPTH || !schema
        || typeof schema !== 'object' || Array.isArray(schema)) throw coded('EXTENSION_COMMAND_SCHEMA_INVALID');
    if (schema.type === 'object') {
        const allowed = new Set(['type', 'properties', 'required', 'additionalProperties']);
        if (!schemaKeys(schema, allowed) || !schema.properties || typeof schema.properties !== 'object'
            || Array.isArray(schema.properties) || Object.keys(schema.properties).length > 32
            || schema.additionalProperties !== false) throw coded('EXTENSION_COMMAND_SCHEMA_INVALID');
        for (const key of Object.keys(schema.properties)) {
            if (FORBIDDEN_KEYS.has(key) || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) throw coded('EXTENSION_COMMAND_SCHEMA_INVALID');
            validateSchema(schema.properties[key], depth + 1, state);
        }
        if (schema.required !== undefined && (!Array.isArray(schema.required) || schema.required.length > 32
            || new Set(schema.required).size !== schema.required.length
            || schema.required.some((key) => typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(schema.properties, key))))
            throw coded('EXTENSION_COMMAND_SCHEMA_INVALID');
        return;
    }
    if (schema.type === 'array') {
        if (!schemaKeys(schema, new Set(['type', 'items', 'minItems', 'maxItems'])) || !schema.items
            || !Number.isInteger(schema.minItems ?? 0) || !Number.isInteger(schema.maxItems)
            || schema.minItems < 0 || schema.maxItems < schema.minItems || schema.maxItems > 64)
            throw coded('EXTENSION_COMMAND_SCHEMA_INVALID');
        validateSchema(schema.items, depth + 1, state);
        return;
    }
    if (!['string', 'number', 'integer', 'boolean'].includes(schema.type)) throw coded('EXTENSION_COMMAND_SCHEMA_INVALID');
    const allowed = new Set(['type', 'enum', 'minLength', 'maxLength', 'minimum', 'maximum']);
    if (!schemaKeys(schema, allowed)) throw coded('EXTENSION_COMMAND_SCHEMA_INVALID');
    if (schema.type === 'string') {
        if (schema.minLength !== undefined && (!Number.isInteger(schema.minLength) || schema.minLength < 0)
            || schema.maxLength !== undefined && (!Number.isInteger(schema.maxLength) || schema.maxLength > 4096)
            || (schema.minLength ?? 0) > (schema.maxLength ?? 4096)) throw coded('EXTENSION_COMMAND_SCHEMA_INVALID');
    } else if (schema.type === 'number' || schema.type === 'integer') {
        if (schema.minimum !== undefined && !Number.isFinite(schema.minimum)
            || schema.maximum !== undefined && !Number.isFinite(schema.maximum)
            || (schema.minimum ?? -1e12) > (schema.maximum ?? 1e12)
            || Math.abs(schema.minimum ?? 0) > 1e12 || Math.abs(schema.maximum ?? 0) > 1e12)
            throw coded('EXTENSION_COMMAND_SCHEMA_INVALID');
    } else if (Object.keys(schema).some((key) => !['type', 'enum'].includes(key))) throw coded('EXTENSION_COMMAND_SCHEMA_INVALID');
    if (schema.enum !== undefined && (!Array.isArray(schema.enum) || schema.enum.length < 1 || schema.enum.length > 32
        || schema.enum.some((item) => schema.type === 'string' ? typeof item !== 'string' || item.length > 256
            : schema.type === 'boolean' ? typeof item !== 'boolean'
              : typeof item !== 'number' || !Number.isFinite(item) || (schema.type === 'integer' && !Number.isInteger(item)))))
        throw coded('EXTENSION_COMMAND_SCHEMA_INVALID');
}

function normalizeProvider(packageName, metadata) {
    if (typeof packageName !== 'string' || !PROVIDER_ID.test(packageName) || !metadata || typeof metadata !== 'object'
        || Array.isArray(metadata) || metadata.creatorVersion !== '2.4.15' || metadata.protocolVersion !== '1'
        || !Array.isArray(metadata.commands) || metadata.commands.length > MAX_COMMANDS
        || Object.keys(metadata).some((key) => !['creatorVersion', 'protocolVersion', 'commands'].includes(key)))
        throw coded('EXTENSION_PROVIDER_METADATA_INVALID');
    const seen = new Set();
    const commands = metadata.commands.map((command) => {
        if (!command || typeof command !== 'object' || Array.isArray(command)
            || Object.keys(command).some((key) => !['id', 'title', 'description', 'access', 'approval', 'input'].includes(key))
            || typeof command.id !== 'string' || !COMMAND_ID.test(command.id) || seen.has(command.id)
            || typeof command.title !== 'string' || !command.title.trim() || command.title.length > 80
            || typeof command.description !== 'string' || !command.description.trim() || command.description.length > 500
            || !ACCESS.has(command.access) || !command.input || command.input.type !== 'object'
            || Object.prototype.hasOwnProperty.call(command.input.properties || {}, 'instanceId')
            || ((command.access === 'write' || command.access === 'control') && command.approval !== true)
            || ((command.access === 'read' || command.access === 'plan') && command.approval === true))
            throw coded('EXTENSION_COMMAND_DECLARATION_INVALID');
        validateSchema(command.input);
        seen.add(command.id);
        return { id: command.id, title: command.title.trim(), description: command.description.trim(),
            access: command.access, approval: command.approval === true, input: command.input };
    });
    const fingerprint = crypto.createHash('sha256').update(canonical(metadata)).digest('hex');
    return { providerId: packageName, creatorVersion: metadata.creatorVersion,
        protocolVersion: metadata.protocolVersion, providerFingerprint: fingerprint, commands };
}

function validateArguments(schema, input) {
    let bytes;
    try { bytes = Buffer.byteLength(JSON.stringify(input)); } catch (_) { throw coded('EXTENSION_COMMAND_INPUT_INVALID'); }
    if (bytes > MAX_ARGUMENT_BYTES || !input || typeof input !== 'object' || Array.isArray(input))
        throw coded('EXTENSION_COMMAND_INPUT_INVALID');
    function visit(shape, value, field, depth) {
        if (depth > MAX_SCHEMA_DEPTH) throw coded('EXTENSION_COMMAND_INPUT_INVALID');
        if (shape.type === 'object') {
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw coded('EXTENSION_COMMAND_INPUT_INVALID');
            const props = shape.properties || {};
            if (Object.keys(value).some((key) => FORBIDDEN_KEYS.has(key) || !Object.prototype.hasOwnProperty.call(props, key)))
                throw coded('EXTENSION_COMMAND_INPUT_UNKNOWN_FIELD');
            for (const key of shape.required || []) if (!Object.prototype.hasOwnProperty.call(value, key)) throw coded('EXTENSION_COMMAND_INPUT_REQUIRED');
            for (const key of Object.keys(value)) visit(props[key], value[key], `${field}.${key}`, depth + 1);
            return;
        }
        if (shape.type === 'array') {
            if (!Array.isArray(value) || value.length < (shape.minItems ?? 0) || value.length > shape.maxItems)
                throw coded('EXTENSION_COMMAND_INPUT_INVALID');
            for (let index = 0; index < value.length; index += 1) visit(shape.items, value[index], `${field}[${index}]`, depth + 1);
            return;
        }
        const ok = shape.type === 'string' ? typeof value === 'string' && !value.includes('\0')
            && value.length >= (shape.minLength ?? 0) && value.length <= (shape.maxLength ?? 4096)
            : shape.type === 'boolean' ? typeof value === 'boolean'
              : (shape.type === 'integer' ? Number.isInteger(value) : typeof value === 'number' && Number.isFinite(value))
                && value >= (shape.minimum ?? -1e12) && value <= (shape.maximum ?? 1e12);
        if (!ok || shape.enum && !shape.enum.includes(value)) throw coded('EXTENSION_COMMAND_INPUT_INVALID');
    }
    visit(schema, input, 'arguments', 0);
    return input;
}

module.exports = { normalizeProvider, validateArguments, canonical, PROVIDER_ID, COMMAND_ID };
