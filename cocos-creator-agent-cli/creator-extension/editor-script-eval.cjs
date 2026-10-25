'use strict';

const vm = require('vm');

const MAX_SOURCE_BYTES = 16 * 1024;
const MAX_ARGUMENT_BYTES = 16 * 1024;
const MAX_RESULT_BYTES = 64 * 1024;
const MAX_SYNC_TIMEOUT_MS = 5000;
const MAX_ASYNC_TIMEOUT_MS = 30000;
const MAX_EDITOR_TESTS_PER_RUN = 64;
const MAX_EDITOR_TEST_BUDGET_MS = 25000;

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

function createEditorTestHarness(input) {
    const runner = input && input.__cocosAgentTest;
    const selectedIds = Array.isArray(runner && runner.selectedCaseIds) ? runner.selectedCaseIds : null;
    const bounded = (value, maximum) => {
        let text = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ');
        while (Buffer.byteLength(text, 'utf8') > maximum) text = text.slice(0, -1);
        return text;
    };
    return Object.freeze({
        assert(condition, message) {
            if (!condition) throw new Error(message || 'Creator Editor test assertion failed.');
        },
        async run(cases, options) {
            options = options || {};
            if (!Array.isArray(cases) || !cases.length || cases.length > 1000) throw coded('EDITOR_TEST_CASES_INVALID');
            const byId = new Map();
            for (const entry of cases) {
                if (!entry || typeof entry.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(entry.id)
                    || byId.has(entry.id) || typeof entry.run !== 'function') throw coded('EDITOR_TEST_CASE_INVALID');
                byId.set(entry.id, entry);
            }
            const allIds = Array.from(byId.keys());
            const requestedIds = options.ids === undefined ? (selectedIds || allIds) : options.ids;
            if (!Array.isArray(requestedIds) || !requestedIds.length || requestedIds.some((id) => !byId.has(id))
                || new Set(requestedIds).size !== requestedIds.length
                || (selectedIds && (requestedIds.length !== selectedIds.length || selectedIds.some((id) => !requestedIds.includes(id)))))
                throw coded('EDITOR_TEST_SELECTION_INVALID');
            if (requestedIds.length > MAX_EDITOR_TESTS_PER_RUN) throw coded('EDITOR_TEST_CASE_BATCH_LIMIT');
            const timeoutMs = options.timeoutMs === undefined ? 10000 : options.timeoutMs;
            if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_EDITOR_TEST_BUDGET_MS)
                throw coded('EDITOR_TEST_TIMEOUT_INVALID');

            const deadline = Date.now() + MAX_EDITOR_TEST_BUDGET_MS;
            const tests = [];
            let interrupted = false;
            for (const id of requestedIds) {
                const entry = byId.get(id);
                const name = bounded(entry.name || entry.id, 128);
                if (interrupted) {
                    tests.push({ id: entry.id, name, status: 'skipped', durationMs: 0,
                        message: 'Earlier test timed out; remaining cases need review before retry.' });
                    continue;
                }
                const started = Date.now();
                let timer;
                try {
                    const remaining = Math.max(1, deadline - Date.now());
                    await Promise.race([Promise.resolve().then(() => entry.run()), new Promise((resolve, reject) => {
                        timer = setTimeout(() => reject(Object.assign(new Error('CREATOR_TEST_TIMEOUT'), { timedOut: true })),
                            Math.min(timeoutMs, remaining));
                    })]);
                    tests.push({ id: entry.id, name, status: 'passed', durationMs: Date.now() - started });
                } catch (error) {
                    interrupted = Boolean(error && error.timedOut);
                    tests.push({ id: entry.id, name, status: 'failed', durationMs: Date.now() - started,
                        message: bounded(error && (error.stack || error.message) || error, 256) });
                } finally { clearTimeout(timer); }
            }
            return { schemaVersion: 1, tests, requiresManualReview: interrupted };
        },
    });
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

    const sandbox = { Editor: editor, input: validated.input, CreatorTest: createEditorTestHarness(validated.input) };
    const wrapped = `(async function (Editor, input, CreatorTest) {\n"use strict";\n${validated.source}\n})(Editor, input, CreatorTest)`;
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
