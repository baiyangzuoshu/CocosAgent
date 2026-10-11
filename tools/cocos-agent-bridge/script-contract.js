'use strict';
// Creator 2.4.15 existing-JS editing. Source is parsed, never executed in the main process.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const HASH = { type: 'string', pattern: '^[0-9a-f]{64}$' };
const UUID = { type: 'string', format: 'uuid' };
const SCRIPT = { type: 'string', minLength: 4, maxLength: 240, pattern: '^[A-Za-z0-9_ -]+(?:/[A-Za-z0-9_. -]+)*\\.js$' };
const EDITS = { type: 'array', minItems: 1, maxItems: 8, items: { type: 'object', additionalProperties: false,
    required: ['before', 'after'], properties: { before: { type: 'string', minLength: 1, maxLength: 16384 }, after: { type: 'string', maxLength: 16384 } } } };
const identity = { scriptPath: SCRIPT, scriptUuid: UUID, expectedSha256: HASH, edits: EDITS };
const inputs = {
    'script.read': { type: 'object', additionalProperties: false, required: ['scriptPath'], properties: { scriptPath: SCRIPT } },
    'script.patch.plan': { type: 'object', additionalProperties: false, required: Object.keys(identity), properties: identity },
    'script.patch': { type: 'object', additionalProperties: false, required: ['action', 'operationId'], properties: {
        ...identity, action: { type: 'string', enum: ['apply', 'compensate', 'reconcile', 'replay'] }, operationId: UUID, sourceOperationId: UUID } },
    'script.operation.get': { type: 'object', additionalProperties: false, required: ['operationId'], properties: { operationId: UUID } },
};
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = (code, message = code) => { const error = new Error(message); error.code = code; throw error; };
function validInput(command, input) {
    const schema = inputs[command];
    if (!schema || !input || typeof input !== 'object' || Array.isArray(input)) return false;
    if (schema.required.some((k) => input[k] === undefined) || Object.keys(input).some((k) => !schema.properties[k])) return false;
    function check(value, def) {
        if (def.type === 'string') return typeof value === 'string' && !value.includes('\0')
            && (def.minLength === undefined || value.length >= def.minLength) && (def.maxLength === undefined || value.length <= def.maxLength)
            && (!def.pattern || new RegExp(def.pattern).test(value)) && (!def.enum || def.enum.includes(value))
            && (!def.format || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
        if (def.type === 'array') return Array.isArray(value) && value.length >= def.minItems && value.length <= def.maxItems && value.every((v) => check(v, def.items));
        return value && typeof value === 'object' && !Array.isArray(value) && def.required.every((k) => value[k] !== undefined)
            && Object.keys(value).every((k) => def.properties[k] && check(value[k], def.properties[k]));
    }
    if (!Object.keys(input).every((k) => check(input[k], schema.properties[k]))) return false;
    if (input.scriptPath && input.scriptPath.split('/').some((p) => p === '.' || p === '..')) return false;
    if (command !== 'script.patch') return true;
    const fields = Object.keys(identity);
    if (input.action === 'apply') return fields.every((k) => input[k] !== undefined) && input.sourceOperationId === undefined;
    if (input.action === 'replay') return !!input.sourceOperationId && fields.every((k) => input[k] === undefined) && input.sourceOperationId !== input.operationId;
    return fields.every((k) => input[k] === undefined) && input.sourceOperationId === undefined;
}
function safePath(root, relative, directory = false, create = false) {
    const parts = relative.split('/');
    if (parts.some((p) => !p || p === '.' || p === '..')) fail('UNSAFE_PATH');
    let current = root;
    if (fs.lstatSync(root).isSymbolicLink()) fail('UNSAFE_PATH');
    for (let index = 0; index < parts.length; index++) {
        current = path.join(current, parts[index]);
        const isDir = index < parts.length - 1 || directory;
        if (create && isDir && !fs.existsSync(current)) fs.mkdirSync(current, { mode: 0o700 });
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink() || (isDir ? !stat.isDirectory() : !stat.isFile())) fail('UNSAFE_PATH');
    }
    return current;
}
function readScript(root, scriptPath) {
    if (!validInput('script.read', { scriptPath })) fail('INVALID_INPUT');
    const filename = safePath(root, `assets/${scriptPath}`);
    const metaFile = safePath(root, `assets/${scriptPath}.meta`);
    if (fs.statSync(filename).size > 65536 || fs.statSync(metaFile).size > 16384) fail('SCRIPT_TOO_LARGE');
    const bytes = fs.readFileSync(filename);
    const source = bytes.toString('utf8');
    if (!Buffer.from(source).equals(bytes)) fail('SCRIPT_NOT_UTF8');
    const metaBytes = fs.readFileSync(metaFile); const meta = JSON.parse(metaBytes);
    if (meta.importer !== 'javascript' || !/^[0-9a-f-]{36}$/i.test(meta.uuid || '')) fail('SCRIPT_METADATA_INVALID');
    return { scriptPath, scriptUrl: `db://assets/${scriptPath}`, scriptUuid: meta.uuid, sourceSha256: sha(bytes),
        metaSha256: sha(metaBytes), source, filename };
}
function plan(root, input) {
    if (!validInput('script.patch.plan', input)) fail('INVALID_INPUT');
    const before = readScript(root, input.scriptPath);
    if (before.sourceSha256 !== input.expectedSha256 || before.scriptUuid !== input.scriptUuid) fail('SCRIPT_STALE');
    let after = before.source;
    for (const edit of input.edits) {
        const index = after.indexOf(edit.before);
        if (index < 0 || after.indexOf(edit.before, index + 1) >= 0) fail('EDIT_NOT_UNIQUE');
        after = after.slice(0, index) + edit.after + after.slice(index + edit.before.length);
    }
    if (Buffer.byteLength(after) > 65536) fail('SCRIPT_TOO_LARGE');
    if (after === before.source) fail('NO_CHANGE');
    try { new vm.Script(after, { filename: before.scriptUrl }); }
    catch (error) { fail('SCRIPT_SYNTAX_ERROR', String(error.message).slice(0, 800)); }
    return { ...before, after, afterSha256: sha(after), expectedDiff: input.edits,
        syntax: 'parsed-only', compilation: 'not-run', runtime: 'not-run' };
}
function atomic(filename, value) {
    const temporary = `${filename}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.writeFileSync(temporary, value, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, filename);
}
function createScriptService(root, editor, options = {}) {
    let busy = false; const failures = [];
    const timeoutMs = options.timeoutMs || 15000;
    function directory() { return safePath(root, '.cocos-agent/script-operations', true, true); }
    function recordFile(id) { directory(); return path.join(root, '.cocos-agent/script-operations', `${id}.json`); }
    function persist(record) { record.updatedAt = new Date().toISOString(); atomic(recordFile(record.operationId), JSON.stringify(record, null, 2)); }
    function load(id) {
        const file = recordFile(id); safePath(root, `.cocos-agent/script-operations/${id}.json`);
        if (fs.statSync(file).size > 250000) fail('SCRIPT_RECORD_INVALID');
        const record = JSON.parse(fs.readFileSync(file));
        if (record.operationId !== id || record.projectRoot !== root || record.creatorVersion !== '2.4.15'
            || sha(record.beforeSource || '') !== record.beforeSha256 || sha(record.afterSource || '') !== record.afterSha256
            || !validInput('script.read', { scriptPath: record.scriptPath })) fail('SCRIPT_RECORD_INVALID');
        return record;
    }
    function receipt(record) {
        const { beforeSource, afterSource, expectedDiff, ...summary } = record;
        let current = null;
        try { const live = readScript(root, record.scriptPath); current = { sourceSha256: live.sourceSha256, scriptUuid: live.scriptUuid,
            metaSha256: live.metaSha256, matchesBefore: live.sourceSha256 === record.beforeSha256, matchesAfter: live.sourceSha256 === record.afterSha256 }; } catch (_) {}
        const review = ['writing', 'compiling', 'compensating', 'needs-review'].includes(record.state);
        return { success: !review && record.state !== 'compile-failed', outcome: review ? 'needs-review'
            : record.state === 'compile-failed' ? 'failed' : record.state === 'completed' ? 'needs-runtime' : 'completed',
            operationId: record.operationId, record: summary, current,
            ...(record.error ? { error: record.error } : {}) };
    }
    function mappingMatches(script) {
        return editor.assetdb && typeof editor.assetdb.urlToUuid === 'function' && editor.assetdb.urlToUuid(script.scriptUrl) === script.scriptUuid;
    }
    function compileEvidence(record, expectedSource, started) {
        const prefix = `temp/quick-scripts/src/assets/${record.scriptPath}`;
        const sourceMap = safePath(root, `${prefix}.map`);
        const compiledFile = safePath(root, prefix);
        const destination = safePath(root, `temp/quick-scripts/dst/assets/${record.scriptPath}`);
        if ([sourceMap, compiledFile, destination].some((f) => fs.statSync(f).size > 2 * 1024 * 1024)) return null;
        const map = JSON.parse(fs.readFileSync(sourceMap));
        const index = map.sources.indexOf(`assets/${record.scriptPath}`);
        if (index < 0 || !map.sourcesContent || map.sourcesContent[index] !== expectedSource || fs.statSync(sourceMap).mtimeMs < started) return null;
        const statsFile = safePath(root, 'temp/quick-scripts/dst/__file_stats__.json');
        const stats = JSON.parse(fs.readFileSync(statsFile));
        if (stats.stats[compiledFile] !== fs.statSync(compiledFile).mtime.toISOString()) return null;
        new vm.Script(fs.readFileSync(compiledFile, 'utf8')); new vm.Script(fs.readFileSync(destination, 'utf8'));
        return { status: 'compiled', sourceSha256: sha(expectedSource), sourceMap: `${prefix}.map`,
            compiledSha256: sha(fs.readFileSync(compiledFile)), destinationSha256: sha(fs.readFileSync(destination)),
            compilerStatsVersion: stats.version, checkedAt: new Date().toISOString() };
    }
    async function refreshCompile(record, source, started) {
        let importError = null; let refreshed = false;
        try { editor.assetdb.refresh(`db://assets/${record.scriptPath}`, (error) => { importError = error; refreshed = true; }); }
        catch (error) { importError = error; refreshed = true; }
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if (importError) fail('SCRIPT_IMPORT_FAILED', String(importError.message || importError).slice(0, 800));
            const failure = failures.find((f) => f.at >= started && (f.text.includes(record.scriptUuid) || f.text.includes(record.scriptPath)));
            if (failure) fail('SCRIPT_COMPILE_FAILED', failure.text);
            try {
                const script = readScript(root, record.scriptPath);
                if (script.scriptUuid !== record.scriptUuid || script.metaSha256 !== record.metaSha256 || script.source !== source) fail('SCRIPT_CHANGED_DURING_COMPILE');
                const evidence = refreshed && mappingMatches(script) && compileEvidence(record, source, started);
                if (evidence) return evidence;
            } catch (error) { if (error.code === 'SCRIPT_CHANGED_DURING_COMPILE') throw error; }
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        fail('SCRIPT_COMPILE_TIMEOUT', 'Creator output was not verified against this exact source. Query the original operation and reconcile; never repeat apply.');
    }
    async function execute(command, input) {
        if (!validInput(command, input)) fail('INVALID_INPUT');
        if (command === 'script.read') { const { filename, ...script } = readScript(root, input.scriptPath); return script; }
        if (command === 'script.patch.plan') { const { filename, source, after, ...proposal } = plan(root, input); return proposal; }
        if (command === 'script.operation.get') return receipt(load(input.operationId));
        if (busy) fail('SCRIPT_OPERATION_BUSY');
        busy = true;
        let record;
        try {
            if (input.action === 'apply' || input.action === 'replay') {
                if (fs.existsSync(recordFile(input.operationId))) fail('OPERATION_ID_EXISTS');
                let proposal;
                if (input.action === 'replay') {
                    const original = load(input.sourceOperationId);
                    if (original.state !== 'compensated') fail('REPLAY_REQUIRES_COMPENSATED_RECORD');
                    proposal = plan(root, { scriptPath: original.scriptPath, scriptUuid: original.scriptUuid,
                        expectedSha256: original.beforeSha256, edits: original.expectedDiff });
                } else {
                    const { action, operationId, ...identityInput } = input;
                    proposal = plan(root, identityInput);
                }
                if (!mappingMatches(proposal)) fail('SCRIPT_ASSETDB_MISMATCH');
                record = { operationId: input.operationId, projectRoot: root, creatorVersion: '2.4.15', capabilityId: 'script.patch',
                    contractVersion: '0.1', scriptPath: proposal.scriptPath, scriptUuid: proposal.scriptUuid, metaSha256: proposal.metaSha256,
                    beforeSha256: proposal.sourceSha256, afterSha256: proposal.afterSha256, beforeSource: proposal.source,
                    afterSource: proposal.after, expectedDiff: proposal.expectedDiff, state: 'writing', runtime: 'not-verified',
                    createdAt: new Date().toISOString(), ...(input.sourceOperationId ? { sourceOperationId: input.sourceOperationId } : {}) };
                // Durable intent and backup before the first source write.
                persist(record);
                if (readScript(root, record.scriptPath).sourceSha256 !== record.beforeSha256) fail('SCRIPT_STALE');
                record.compileStartedAt = Date.now();
                const originalMode = fs.statSync(proposal.filename).mode & 0o777;
                atomic(proposal.filename, record.afterSource); fs.chmodSync(proposal.filename, originalMode);
                record.state = 'compiling'; persist(record);
                record.compilation = await refreshCompile(record, record.afterSource, record.compileStartedAt);
                record.state = 'completed'; persist(record); return receipt(record);
            }
            record = load(input.operationId);
            const current = readScript(root, record.scriptPath);
            if (current.scriptUuid !== record.scriptUuid || current.metaSha256 !== record.metaSha256) fail('SCRIPT_IDENTITY_CHANGED');
            if (input.action === 'reconcile') {
                if (!['writing', 'compiling', 'compensating', 'needs-review', 'compile-failed'].includes(record.state)) return receipt(record);
                const restoring = record.intent === 'compensate';
                if (current.sourceSha256 !== (restoring ? record.beforeSha256 : record.afterSha256)) {
                    if (!restoring && current.sourceSha256 === record.beforeSha256) {
                        record.state = 'compensated'; record.compilation = { status: 'write-reconciled-no-effect' }; delete record.error; persist(record); return receipt(record);
                    }
                    fail('SCRIPT_RECONCILE_CONFLICT');
                }
                record.compilation = await refreshCompile(record, restoring ? record.beforeSource : record.afterSource, record.compileStartedAt);
                record.state = restoring ? 'compensated' : 'completed'; delete record.error; persist(record); return receipt(record);
            }
            if (record.state === 'compensated') return receipt(record);
            // Restore only our own exact source; never overwrite a developer's later edit.
            if (current.sourceSha256 !== record.afterSha256) fail('SCRIPT_COMPENSATION_CONFLICT');
            record.intent = 'compensate'; record.state = 'compensating'; record.compileStartedAt = Date.now(); persist(record);
            const mode = fs.statSync(current.filename).mode & 0o777;
            atomic(current.filename, record.beforeSource); fs.chmodSync(current.filename, mode);
            record.compilation = await refreshCompile(record, record.beforeSource, record.compileStartedAt);
            record.state = 'compensated'; delete record.error; persist(record); return receipt(record);
        } catch (error) {
            if (record && ['writing', 'compiling', 'compensating'].includes(record.state)) {
                record.state = ['SCRIPT_IMPORT_FAILED', 'SCRIPT_COMPILE_FAILED'].includes(error.code) ? 'compile-failed' : 'needs-review';
                record.error = { code: error.code || 'SCRIPT_OPERATION_FAILED', message: String(error.message).slice(0, 800),
                    phase: 'compile', sideEffect: record.state === 'needs-review' ? 'possible' : 'confirmed', retryable: false };
                persist(record); return receipt(record);
            }
            throw error;
        } finally { busy = false; }
    }
    return { execute, importFailed(args) { let text; try { text = JSON.stringify(args); } catch (_) { text = 'Unserializable compiler error'; }
        failures.push({ at: Date.now(), text: text.slice(0, 2000) }); if (failures.length > 64) failures.shift(); } };
}
module.exports = { inputs, validInput, readScript, plan, createScriptService };
