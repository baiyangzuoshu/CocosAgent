'use strict';

const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
const operationStore = require('./operation-store');

const commands = new Set(['scene.snapshot', 'scene.node.inspect', 'asset.importPng', 'scene.pngSprite', 'scene.node.create']);
const versions = new Set(['2.4.15', '3.8.7']);

function dispatchError(code, message, phase = 'selection', sideEffect = 'none', retryable = false) {
    return { code, message, phase, retryable, sideEffect };
}
function problem(code, message, details, phase = 'selection', sideEffect = 'none') {
    return { success: false, outcome: 'failed', error: dispatchError(code, message, phase, sideEffect), ...(details ? { details } : {}) };
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
function validOperationRecord(record) {
    if (record && record.capabilityId === 'scene.node.create') return record.manifest && typeof record.manifest.action === 'string'
        && typeof record.manifest.parentPath === 'string' && typeof record.manifest.parentUuid === 'string'
        && typeof record.manifest.nodeName === 'string' && record.phases && typeof record.phases.disk === 'string';
    return record && record.manifest && typeof record.manifest.sceneAction === 'string'
        && typeof record.manifest.assetName === 'string' && typeof record.manifest.nodeName === 'string'
        && typeof record.manifest.assetUuid === 'string' && record.phases
        && typeof record.phases.disk === 'string' && typeof record.phases.preview === 'string';
}
function runProcess(script, args) {
    const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '', error: result.error };
}
function validInput(command, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
    const keys = Object.keys(input);
    if (command === 'scene.snapshot') return keys.length === 0;
    if (command === 'scene.node.inspect') return keys.length === 1 && typeof input.nodePath === 'string'
        && input.nodePath.length > 0 && input.nodePath.length <= 240 && !input.nodePath.includes('\\') && !input.nodePath.includes('//');
    if (command === 'asset.importPng') return keys.length === 1 && typeof input.sourcePath === 'string' && input.sourcePath.length > 0;
    if (command === 'scene.node.create') return keys.every((key) => ['parentPath', 'parentUuid', 'nodeName', 'action', 'sourceOperationId', 'operationId'].includes(key))
        && typeof input.parentPath === 'string' && input.parentPath.length > 0 && input.parentPath.length <= 240
        && !input.parentPath.includes('//') && !input.parentPath.includes('\\')
        && typeof input.parentUuid === 'string' && input.parentUuid.length > 0 && input.parentUuid.length <= 64
        && typeof input.nodeName === 'string' && /^[A-Za-z0-9_ -]{1,64}$/.test(input.nodeName)
        && ['apply', 'compensate', 'replay'].includes(input.action)
        && (input.action === 'apply' ? input.sourceOperationId === undefined : typeof input.sourceOperationId === 'string' && /^[0-9a-f-]{36}$/i.test(input.sourceOperationId))
        && (input.operationId === undefined || /^[0-9a-f-]{36}$/i.test(input.operationId));
    return keys.every((key) => ['assetName', 'action', 'operationId'].includes(key))
        && typeof input.assetName === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i.test(input.assetName)
        && ['apply', 'compensate', 'replay'].includes(input.action)
        && (input.operationId === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.operationId));
}

function dispatchCommand(request, invoke) {
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
    if (command === 'scene.node.inspect') executionArgs.push('--node-path', input.nodePath);
    if (command === 'scene.pngSprite') {
        operationId = input.operationId || crypto.randomUUID();
        executionArgs.push('--scene-asset', input.assetName, '--scene-action', input.action, '--operation-id', operationId);
    }
    if (command === 'scene.node.create') {
        operationId = input.operationId || crypto.randomUUID();
        executionArgs.push('--parent-path', input.parentPath, '--parent-uuid', input.parentUuid,
            '--node-name', input.nodeName, '--action', input.action, '--operation-id', operationId);
        if (input.sourceOperationId) executionArgs.push('--source-operation-id', input.sourceOperationId);
    }
    const hostScript = command === 'scene.node.create' ? 'node-create-host.js' : 'bridge-host.js';
    const execution = invoke(hostScript, executionArgs);
    const base = { instance: selected, command, ...(operationId ? { operationId } : {}) };
    if (!operationId) {
        if (execution.status !== 0) return problem('EXECUTION_FAILED', 'Command execution failed.', { ...base, stderr: execution.stderr.trim() }, 'execution', capability.access === 'read' ? 'none' : 'possible');
        const result = parseCommandResult(execution.stdout, command);
        return result ? { success: true, outcome: 'completed', ...base, result }
            : problem('RESULT_MISSING', 'Command finished without a structured result.', base, 'execution', capability.access === 'read' ? 'none' : 'possible');
    }
    const readback = parseJson(invoke(hostScript, ['--project', project, '--creator-version', creatorVersion, '--operation-get', operationId]));
    if (!readback || readback.success !== true || !readback.data) {
        return { success: false, outcome: 'needs-review', ...base,
            error: dispatchError('OPERATION_STATUS_UNKNOWN', 'Execution ended, but its operation record could not be read.', 'record', 'unknown') };
    }
    const record = readback.data;
    if (!validOperationRecord(record)) return problem('OPERATION_RECORD_INVALID', 'Operation record is incomplete.', base, 'record', 'unknown');
    if (record.operationId !== operationId || record.projectRoot !== project || record.creatorVersion !== creatorVersion) {
        return problem('OPERATION_TARGET_MISMATCH', 'Operation record does not match the selected target.', base, 'record', 'unknown');
    }
    const nodeOperation = command === 'scene.node.create';
    const state = { ...base, phases: record.phases, intent: record.intent,
        result: nodeOperation ? { sceneName: record.sceneName, action: record.manifest.action, nodeName: record.manifest.nodeName,
            nodeUuid: record.createdNodeUuid || record.manifest.targetNodeUuid, parentPath: record.manifest.parentPath, parentUuid: record.manifest.parentUuid }
            : { sceneName: record.sceneName, action: record.manifest.sceneAction, assetName: record.manifest.assetName,
                nodeName: record.manifest.nodeName, assetUuid: record.manifest.assetUuid } };
    if (record.phases.disk === 'passed') {
        return { success: true, outcome: nodeOperation || record.phases.preview === 'passed' || input.action === 'compensate' ? 'completed' : 'needs-preview', ...state };
    }
    if (record.intent === 'editor-write-sent' || record.phases.editor === 'passed') {
        return { success: false, outcome: 'needs-review', ...state,
            error: dispatchError('WRITE_OUTCOME_UNCERTAIN', 'Inspect the saved scene and operation record before any retry.', 'record', 'possible') };
    }
    if (nodeOperation) {
        const failure = [...record.receipts].reverse().find((item) => item.status === 'failed' && item.error);
        if (failure) return { success: false, outcome: 'failed', ...state,
            error: dispatchError(typeof failure.error.code === 'string' ? failure.error.code : 'EXECUTION_FAILED',
                failure.error.message || 'Node creation was rejected.', 'execution', 'none') };
    }
    return { success: false, outcome: 'failed', ...state,
        error: dispatchError('EXECUTION_FAILED', execution.stderr.trim() || 'Command did not reach a verified disk write.', 'execution', 'none') };
}

function operationStatus(request, invoke) {
    const { projectRoot, creatorVersion, operationGetId, previewAcceptId, evidence } = request;
    const operationId = operationGetId || previewAcceptId;
    if (typeof projectRoot !== 'string' || !versions.has(creatorVersion)
        || typeof operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)
        || (operationGetId && previewAcceptId)) return problem('INVALID_ARGUMENT', 'Provide one operation ID, project, and Creator version.');
    const project = path.resolve(projectRoot);
    let knownRecord;
    try { knownRecord = operationStore.read(project, operationId); } catch (_) { /* Host reports the missing record. */ }
    const nodeOperation = knownRecord && knownRecord.capabilityId === 'scene.node.create';
    if (nodeOperation && previewAcceptId) return problem('PREVIEW_NOT_APPLICABLE', 'Empty node creation is verified by scene readback.', null, 'preview');
    if (previewAcceptId) {
        const accepted = parseJson(invoke('operation-preview.js', ['--project', project, '--creator-version', creatorVersion,
            '--operation-id', operationId, '--evidence', JSON.stringify(evidence || null)]));
        if (!accepted || accepted.success !== true) {
            return problem(accepted && accepted.error && accepted.error.code || 'PREVIEW_ACCEPT_FAILED',
                accepted && accepted.error && accepted.error.message || 'Could not record preview evidence.', null, 'preview');
        }
    }
    const readback = parseJson(invoke(nodeOperation ? 'node-create-host.js' : 'bridge-host.js', ['--project', project, '--creator-version', creatorVersion, '--operation-get', operationId]));
    if (!readback || readback.success !== true || !readback.data) return problem('OPERATION_STATUS_UNKNOWN', 'Cannot read operation record.', null, 'record', 'unknown');
    const record = readback.data;
    if (!validOperationRecord(record)) return problem('OPERATION_RECORD_INVALID', 'Operation record is incomplete.', null, 'record', 'unknown');
    if (record.operationId !== operationId || record.projectRoot !== project || record.creatorVersion !== creatorVersion) {
        return problem('OPERATION_TARGET_MISMATCH', 'Operation record does not match the requested target.', null, 'record', 'unknown');
    }
    const base = { command: nodeOperation ? 'scene.node.create' : 'scene.pngSprite', operationId, phases: record.phases, intent: record.intent,
        result: nodeOperation ? { sceneName: record.sceneName, action: record.manifest.action, nodeName: record.manifest.nodeName,
            nodeUuid: record.createdNodeUuid || record.manifest.targetNodeUuid, parentPath: record.manifest.parentPath, parentUuid: record.manifest.parentUuid }
            : { sceneName: record.sceneName, action: record.manifest.sceneAction, assetName: record.manifest.assetName,
                nodeName: record.manifest.nodeName, assetUuid: record.manifest.assetUuid } };
    if (record.phases.disk === 'passed') {
        return { success: true, outcome: nodeOperation || record.manifest.sceneAction === 'compensate' || record.phases.preview === 'passed' ? 'completed' : 'needs-preview', ...base };
    }
    if (record.intent === 'editor-write-sent' || record.phases.editor === 'passed') {
        return { success: false, outcome: 'needs-review', ...base,
            error: dispatchError('WRITE_OUTCOME_UNCERTAIN', 'Inspect the saved scene before any retry.', 'record', 'possible') };
    }
    if (nodeOperation) {
        const failure = [...record.receipts].reverse().find((item) => item.status === 'failed' && item.error);
        if (failure) return { success: false, outcome: 'failed', ...base,
            error: dispatchError(typeof failure.error.code === 'string' ? failure.error.code : 'OPERATION_INCOMPLETE',
                failure.error.message || 'Node creation was rejected.', 'record', 'none') };
    }
    return problem('OPERATION_INCOMPLETE', 'Operation did not reach a verified disk write.', null, 'record', 'possible');
}

function dispatch(request, invoke = runProcess) {
    const raw = request.operationGetId || request.previewAcceptId
        ? operationStatus(request, invoke) : dispatchCommand(request, invoke);
    return { success: raw.success, outcome: raw.outcome, command: raw.command || request.command || (request.operationGetId || request.previewAcceptId ? 'scene.pngSprite' : null),
        instance: raw.instance || null, operationId: raw.operationId || request.operationGetId || request.previewAcceptId || null,
        result: raw.result || null, phases: raw.phases || null, intent: raw.intent || null,
        error: raw.error || null, ...(raw.details ? { details: raw.details } : {}) };
}

function parseArgs(argv) {
    const values = (flag) => argv.flatMap((value, index) => value === flag ? [argv[index + 1]] : []);
    const targets = values('--target').map((value) => {
        const index = value && value.indexOf('=');
        return index > 0 ? { creatorVersion: value.slice(0, index), projectRoot: value.slice(index + 1) } : null;
    });
    let input;
    try { input = JSON.parse(values('--input')[0] || '{}'); } catch (_) { input = null; }
    let evidence;
    try { evidence = JSON.parse(values('--evidence')[0] || 'null'); } catch (_) { evidence = null; }
    return { targets, projectRoot: values('--project')[0], creatorVersion: values('--creator-version')[0],
        command: values('--command')[0], input, operationGetId: values('--operation-get')[0],
        previewAcceptId: values('--preview-accept')[0], evidence };
}

if (require.main === module) {
    const result = dispatch(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.success ? 0 : 1;
}

module.exports = { dispatch, parseArgs };
