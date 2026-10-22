'use strict';

const vm = require('vm');

const MAX_SOURCE_BYTES = 16 * 1024;
const MAX_ARGUMENT_BYTES = 16 * 1024;
const MAX_RESULT_BYTES = 64 * 1024;
const MAX_SYNC_TIMEOUT_MS = 5000;
const MAX_ASYNC_TIMEOUT_MS = 30000;

function coded(code, message) {
    const error = new Error(message || code);
    error.code = code;
    return error;
}

function jsonBytes(value, code, maximum) {
    let serialized;
    try { serialized = JSON.stringify(value); }
    catch (_) { throw coded(code); }
    if (typeof serialized !== 'string') throw coded(code);
    const bytes = Buffer.byteLength(serialized, 'utf8');
    if (bytes > maximum) throw coded(code);
    return { serialized, bytes };
}

function validateEditorScript(source, input = {}) {
    if (typeof source !== 'string' || !source.trim()
        || Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) throw coded('EDITOR_SCRIPT_SOURCE_INVALID');
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw coded('EDITOR_SCRIPT_INPUT_INVALID');
    const args = jsonBytes(input, 'EDITOR_SCRIPT_INPUT_INVALID', MAX_ARGUMENT_BYTES);
    let normalizedInput;
    try { normalizedInput = JSON.parse(args.serialized); }
    catch (_) { throw coded('EDITOR_SCRIPT_INPUT_INVALID'); }
    if (!normalizedInput || typeof normalizedInput !== 'object' || Array.isArray(normalizedInput))
        throw coded('EDITOR_SCRIPT_INPUT_INVALID');
    return { source, input: normalizedInput, sourceBytes: Buffer.byteLength(source, 'utf8'), inputBytes: args.bytes };
}

async function runEditorScript({ source, input = {}, editor, timeoutMs = MAX_ASYNC_TIMEOUT_MS,
    syncTimeoutMs = MAX_SYNC_TIMEOUT_MS } = {}) {
    const validated = validateEditorScript(source, input);
    if (!editor || typeof editor !== 'object') throw coded('EDITOR_SCRIPT_CONTEXT_UNAVAILABLE');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_ASYNC_TIMEOUT_MS
        || !Number.isInteger(syncTimeoutMs) || syncTimeoutMs < 1 || syncTimeoutMs > MAX_SYNC_TIMEOUT_MS)
        throw coded('EDITOR_SCRIPT_TIMEOUT_INVALID');

    const sandbox = { Editor: editor, input: validated.input };
    const wrapped = `(async function (Editor, input) {\n"use strict";\n${validated.source}\n})(Editor, input)`;
    let pending;
    try {
        pending = new vm.Script(wrapped, { filename: 'cocos-creator-agent-eval.js' })
            .runInNewContext(sandbox, { timeout: syncTimeoutMs, displayErrors: true });
    } catch (error) {
        throw coded(error && error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT'
            ? 'EDITOR_SCRIPT_SYNC_TIMEOUT' : 'EDITOR_SCRIPT_EXECUTION_FAILED',
        String(error && error.message || error).slice(0, 1000));
    }

    let timer;
    try {
        const timeout = new Promise((resolve, reject) => {
            timer = setTimeout(() => reject(coded('EDITOR_SCRIPT_ASYNC_TIMEOUT')),
                Math.min(timeoutMs, MAX_ASYNC_TIMEOUT_MS));
        });
        const value = await Promise.race([Promise.resolve(pending), timeout]);
        const result = value === undefined ? null : value;
        const encoded = jsonBytes(result, 'EDITOR_SCRIPT_RESULT_INVALID', MAX_RESULT_BYTES);
        let normalized;
        try { normalized = JSON.parse(encoded.serialized); }
        catch (_) { throw coded('EDITOR_SCRIPT_RESULT_INVALID'); }
        return { result: normalized, resultBytes: encoded.bytes };
    } catch (error) {
        if (error && error.code) throw error;
        throw coded('EDITOR_SCRIPT_EXECUTION_FAILED', String(error && error.message || error).slice(0, 1000));
    } finally {
        if (timer) clearTimeout(timer);
    }
}

module.exports = { MAX_SOURCE_BYTES, MAX_ARGUMENT_BYTES, MAX_RESULT_BYTES,
    MAX_SYNC_TIMEOUT_MS, MAX_ASYNC_TIMEOUT_MS, validateEditorScript, runEditorScript };
