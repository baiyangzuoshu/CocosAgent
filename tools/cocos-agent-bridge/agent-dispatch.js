'use strict';

const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');

const commands = new Set(['scene.snapshot', 'asset.importPng', 'scene.pngSprite']);
const versions = new Set(['2.4.15', '3.8.7']);

function problem(code, message, details) {
    return { success: false, outcome: 'failed', error: { code, message }, ...(details ? { details } : {}) };
}
function parseJson(result) {
    try { return JSON.parse(result.stdout.trim()); } catch (_) { return null; }
}
function parseCommandResult(output, command) {
    const line = output.split('\n').find((item) => item.startsWith('command.result '));
    if (!line) return null;
    try {
        const parsed = JSON.parse(line.slice('command.result '.length));
        return parsed.command === command && parsed.result && typeof parsed.result === 'object' ? parsed.result : null;
    } catch (_) { return null; }
}
function runProcess(script, args) {
    const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '', error: result.error };
}
function validInput(command, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
    const keys = Object.keys(input);
    if (command === 'scene.snapshot') return keys.length === 0;
    if (command === 'asset.importPng') return keys.length === 1 && typeof input.sourcePath === 'string' && input.sourcePath.length > 0;
    return keys.every((key) => ['assetName', 'action', 'operationId'].includes(key))
        && typeof input.assetName === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i.test(input.assetName)
        && ['apply', 'compensate', 'replay'].includes(input.action)
        && (input.operationId === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.operationId));
}

function dispatch(request, invoke = runProcess) {
    const { targets, projectRoot, creatorVersion, command, input } = request;
    if (!Array.isArray(targets) || !targets.length || !targets.every((target) =>
        target && versions.has(target.creatorVersion) && typeof target.projectRoot === 'string')
        || !versions.has(creatorVersion) || !commands.has(command) || typeof projectRoot !== 'string' || !validInput(command, input)) {
        return problem('INVALID_ARGUMENT', 'Provide targets, an exact project and Creator version, a supported command, and valid input.');
    }
    const project = path.resolve(projectRoot);
    const targetArgs = targets.flatMap((target) => ['--target', `${target.creatorVersion}=${path.resolve(target.projectRoot)}`]);
    const listed = parseJson(invoke('catalog-host.js', [...targetArgs, '--query', 'instances.list']));
    if (!listed || listed.success !== true || !Array.isArray(listed.data)) {
        return problem(listed && listed.error && listed.error.code || 'CATALOG_FAILED', 'Cannot list Creator instances.', listed && listed.error);
    }
    const matches = listed.data.filter((item) => item.projectRoot === project);
    if (matches.length !== 1) return problem(matches.length ? 'AMBIGUOUS_EDITOR' : 'EDITOR_NOT_FOUND', 'Project must select one Creator instance.');
    const instance = matches[0];
    if (instance.creatorVersion !== creatorVersion) return problem('CREATOR_VERSION_MISMATCH', 'Selected Creator version differs from the request.');
    if (instance.state !== 'ready') return problem(instance.error || 'EDITOR_NOT_CONNECTED', 'Selected Creator instance is not ready.');

    const catalog = parseJson(invoke('catalog-host.js', [...targetArgs, '--query', 'capabilities.list', '--project', project, '--creator-version', creatorVersion]));
    if (!catalog || catalog.success !== true || !catalog.data || !catalog.data.instance || !Array.isArray(catalog.data.commands)) {
        return problem(catalog && catalog.error && catalog.error.code || 'CATALOG_FAILED', 'Cannot read command capabilities.', catalog && catalog.error);
    }
    const selected = catalog.data.instance;
    if (selected.instanceId !== instance.instanceId || selected.projectRoot !== project || selected.creatorVersion !== creatorVersion
        || selected.state !== 'ready' || selected.catalogRevision !== instance.catalogRevision || selected.activeScene !== instance.activeScene) {
        return problem('CATALOG_CHANGED', 'Creator instance or scene changed during selection. Query again.');
    }
    const capability = catalog.data.commands.find((item) => item.id === command);
    if (!capability || capability.contractVersion !== '0.1' || capability.status !== 'available') {
        return problem('COMMAND_UNAVAILABLE', 'Command is not currently available.', { reason: capability && capability.reason || null });
    }
    const executionArgs = ['--project', project, '--creator-version', creatorVersion, '--expected-instance-id', selected.instanceId];
    if (selected.activeScene) executionArgs.push('--expected-scene', selected.activeScene);
    let operationId = null;
    if (command === 'asset.importPng') executionArgs.push('--png', path.resolve(input.sourcePath));
    if (command === 'scene.pngSprite') {
        operationId = input.operationId || crypto.randomUUID();
        executionArgs.push('--scene-asset', input.assetName, '--scene-action', input.action, '--operation-id', operationId);
    }
    const execution = invoke('bridge-host.js', executionArgs);
    const base = { instance: selected, command, ...(operationId ? { operationId } : {}) };
    if (!operationId) {
        if (execution.status !== 0) return problem('EXECUTION_FAILED', 'Command execution failed.', { ...base, stderr: execution.stderr.trim() });
        const result = parseCommandResult(execution.stdout, command);
        return result ? { success: true, outcome: 'completed', ...base, result }
            : problem('RESULT_MISSING', 'Command finished without a structured result.', base);
    }
    const readback = parseJson(invoke('bridge-host.js', ['--project', project, '--creator-version', creatorVersion, '--operation-get', operationId]));
    if (!readback || readback.success !== true || !readback.data) {
        return { success: false, outcome: 'needs-review', ...base,
            error: { code: 'OPERATION_STATUS_UNKNOWN', message: 'Execution ended, but its operation record could not be read.' } };
    }
    const record = readback.data;
    if (record.operationId !== operationId || record.projectRoot !== project || record.creatorVersion !== creatorVersion) {
        return problem('OPERATION_TARGET_MISMATCH', 'Operation record does not match the selected target.', base);
    }
    const state = { ...base, phases: record.phases, intent: record.intent };
    if (record.phases.disk === 'passed') {
        return { success: true, outcome: record.phases.preview === 'passed' || input.action === 'compensate' ? 'completed' : 'needs-preview', ...state };
    }
    if (record.intent === 'editor-write-sent' || record.phases.editor === 'passed') {
        return { success: false, outcome: 'needs-review', ...state,
            error: { code: 'WRITE_OUTCOME_UNCERTAIN', message: 'Inspect the saved scene and operation record before any retry.' } };
    }
    return { success: false, outcome: 'failed', ...state,
        error: { code: 'EXECUTION_FAILED', message: execution.stderr.trim() || 'Command did not reach a verified disk write.' } };
}

function parseArgs(argv) {
    const values = (flag) => argv.flatMap((value, index) => value === flag ? [argv[index + 1]] : []);
    const targets = values('--target').map((value) => {
        const index = value && value.indexOf('=');
        return index > 0 ? { creatorVersion: value.slice(0, index), projectRoot: value.slice(index + 1) } : null;
    });
    let input;
    try { input = JSON.parse(values('--input')[0] || '{}'); } catch (_) { input = null; }
    return { targets, projectRoot: values('--project')[0], creatorVersion: values('--creator-version')[0],
        command: values('--command')[0], input };
}

if (require.main === module) {
    const result = dispatch(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.success ? 0 : 1;
}

module.exports = { dispatch, parseArgs };
