'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const operationStore = require('./operation-store');
const operationReconcile = require('./operation-reconcile');
const scenePatchContract = require('./scene-patch-contract');

const commands = new Set(['scene.snapshot', 'scene.node.inspect', 'asset.searchPng', 'asset.importPng', 'asset.removeImportedPng', 'asset.validatePng', 'asset.refreshPng', 'asset.refreshFolder', 'scene.pngSprite', 'scene.node.create', 'scene.node.patch', 'prefab.source.patch', 'prefab.source.inspect', 'content.stress.run']);
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
    if (record && record.capabilityId === 'scene.node.patch') return record.manifest && typeof record.manifest.action === 'string'
        && typeof record.manifest.targetNodePath === 'string' && typeof record.manifest.targetNodeUuid === 'string'
        && scenePatchContract.validateDiff(record.manifest.expectedDiff) && record.phases && typeof record.phases.disk === 'string';
    if (record && record.capabilityId === 'prefab.source.patch') return record.manifest && typeof record.manifest.action === 'string'
        && /^[0-9a-f-]{36}$/i.test(record.manifest.prefabUuid || '') && typeof record.manifest.prefabUrl === 'string'
        && typeof record.manifest.targetNodePath === 'string' && typeof record.manifest.targetNodeUuid === 'string'
        && scenePatchContract.validateDiff(record.manifest.expectedDiff) && /^[a-f0-9]{64}$/.test(record.beforeSha256 || '')
        && record.phases && typeof record.phases.disk === 'string';
    return record && record.manifest && typeof record.manifest.sceneAction === 'string'
        && typeof record.manifest.assetName === 'string' && typeof record.manifest.nodeName === 'string'
        && typeof record.manifest.assetUuid === 'string' && record.phases
        && typeof record.phases.disk === 'string' && typeof record.phases.preview === 'string';
}
function runProcess(script, args) {
    const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
        ...(script === 'content-stress-host.js' ? { timeout: 5 * 60 * 1000 } : {}) });
    return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '', error: result.error };
}
function validPosition(position) {
    return position && typeof position === 'object' && !Array.isArray(position)
        && Object.keys(position).length === 2 && Number.isFinite(position.x) && Number.isFinite(position.y)
        && Math.abs(position.x) <= 4096 && Math.abs(position.y) <= 4096;
}
function validObjectComponents(components) {
    if (!Array.isArray(components) || components.length > 1) return false;
    const seen = new Set();
    return components.every((component) => {
        if (!component || typeof component !== 'object' || Array.isArray(component)
            || !['cc.Sprite', 'cc.Label'].includes(component.classId) || seen.has(component.classId)) return false;
        seen.add(component.classId);
        if (component.classId === 'cc.Sprite') return Object.keys(component).every((key) => ['classId', 'spriteFrameUuid'].includes(key))
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(component.spriteFrameUuid || '');
        return Object.keys(component).every((key) => ['classId', 'text'].includes(key))
            && typeof component.text === 'string' && component.text.length <= 256;
    });
}
function validTransform(transform) {
    return transform && typeof transform === 'object' && !Array.isArray(transform)
        && Object.keys(transform).every((key) => ['position', 'scale'].includes(key))
        && ['position', 'scale'].every((key) => transform[key] === undefined || validPosition(transform[key]));
}
function validAssetFolderPath(folderPath) {
    return typeof folderPath === 'string' && folderPath.length <= 240
        && /^[A-Za-z0-9][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9][A-Za-z0-9_.-]*){0,7}$/.test(folderPath)
        && !folderPath.split('/').some((part) => part === '.' || part === '..');
}
function existingAssetFolder(projectRoot, folderPath) {
    if (!validAssetFolderPath(folderPath)) return false;
    let current = path.join(projectRoot, 'assets');
    try {
        const root = fs.lstatSync(current);
        if (!root.isDirectory() || root.isSymbolicLink()) return false;
        for (const part of folderPath.split('/')) {
            current = path.join(current, part);
            const stat = fs.lstatSync(current);
            if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
        }
        return true;
    } catch (_) { return false; }
}
function validInput(command, input, creatorVersion) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
    const keys = Object.keys(input);
    if (command === 'scene.snapshot') return keys.length === 0;
    if (command === 'scene.node.inspect') return keys.length === 1 && typeof input.nodePath === 'string'
        && input.nodePath.length > 0 && input.nodePath.length <= 240 && !input.nodePath.includes('\\') && !input.nodePath.includes('//');
    if (command === 'asset.searchPng') return creatorVersion === '2.4.15'
        && keys.every((key) => ['query', 'limit', 'offset'].includes(key))
        && typeof input.query === 'string' && input.query.length >= 1 && input.query.length <= 80
        && !/[\u0000-\u001f\u007f]/.test(input.query)
        && (input.limit === undefined || Number.isInteger(input.limit) && input.limit >= 1 && input.limit <= 50)
        && (input.offset === undefined || Number.isInteger(input.offset) && input.offset >= 0 && input.offset <= 100000);
    if (command === 'asset.importPng') return keys.length === 1 && typeof input.sourcePath === 'string' && input.sourcePath.length > 0;
    if (command === 'asset.removeImportedPng') return creatorVersion === '2.4.15' && keys.length === 4
        && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i.test(input.assetName || '')
        && /^[0-9a-f-]{36}$/i.test(input.textureUuid || '') && /^[0-9a-f-]{36}$/i.test(input.spriteFrameUuid || '')
        && /^[0-9a-f]{64}$/.test(input.sha256 || '');
    if (command === 'asset.validatePng' || command === 'asset.refreshPng') return creatorVersion === '2.4.15' && keys.length === 2
        && /^[0-9a-f-]{36}$/i.test(input.pipelineId || '') && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i.test(input.assetName || '');
    if (command === 'asset.refreshFolder') return keys.length === 1 && validAssetFolderPath(input.folderPath);
    if (command === 'scene.node.create') return keys.every((key) => ['parentPath', 'parentUuid', 'nodeName', 'action', 'sourceOperationId', 'operationId',
        ...(creatorVersion === '2.4.15' ? ['components', 'transform', 'prefabMode', 'prefabUuid'] : [])].includes(key))
        && (creatorVersion === '2.4.15' || (input.components === undefined && input.transform === undefined))
        && (input.components === undefined || validObjectComponents(input.components))
        && (input.transform === undefined || (creatorVersion === '2.4.15' && validTransform(input.transform)))
        && (creatorVersion !== '2.4.15' || (input.prefabMode === undefined || ['create', 'instantiate'].includes(input.prefabMode)))
        && (creatorVersion !== '2.4.15' || (input.prefabUuid === undefined || input.prefabMode === 'instantiate' && /^[0-9a-f-]{36}$/i.test(input.prefabUuid)))
        && (creatorVersion !== '2.4.15' || (input.prefabMode !== 'instantiate' || input.prefabUuid !== undefined
            || input.action !== 'apply' && typeof input.sourceOperationId === 'string'))
        && (creatorVersion !== '2.4.15' || (input.prefabMode !== 'create' || input.prefabUuid === undefined))
        && typeof input.parentPath === 'string' && input.parentPath.length > 0 && input.parentPath.length <= 240
        && !input.parentPath.includes('//') && !input.parentPath.includes('\\')
        && typeof input.parentUuid === 'string' && input.parentUuid.length > 0 && input.parentUuid.length <= 64
        && typeof input.nodeName === 'string' && /^[A-Za-z0-9_ -]{1,64}$/.test(input.nodeName)
        && ['apply', 'compensate', 'replay'].includes(input.action)
        && (input.action === 'apply' ? input.sourceOperationId === undefined : typeof input.sourceOperationId === 'string' && /^[0-9a-f-]{36}$/i.test(input.sourceOperationId))
        && (input.operationId === undefined || /^[0-9a-f-]{36}$/i.test(input.operationId));
    if (command === 'scene.node.patch') return creatorVersion === '2.4.15'
        && keys.every((key) => ['targetNodePath', 'targetNodeUuid', 'action', 'expectedDiff', 'sourceOperationId', 'operationId'].includes(key))
        && typeof input.targetNodePath === 'string' && input.targetNodePath.length > 0 && input.targetNodePath.length <= 240
        && !input.targetNodePath.includes('\\') && !input.targetNodePath.includes('//')
        && scenePatchContract.NODE_ID.test(input.targetNodeUuid || '') && ['apply', 'compensate', 'replay'].includes(input.action)
        && scenePatchContract.validateDiff(input.expectedDiff)
        && (input.action === 'apply' ? input.sourceOperationId === undefined : typeof input.sourceOperationId === 'string' && /^[0-9a-f-]{36}$/i.test(input.sourceOperationId))
        && (input.operationId === undefined || /^[0-9a-f-]{36}$/i.test(input.operationId));
    if (command === 'prefab.source.patch') return creatorVersion === '2.4.15'
        && require('./prefab-source-patch-contract').validInput(input);
    if (command === 'prefab.source.inspect') return creatorVersion === '2.4.15' && keys.length === 1
        && /^[0-9a-f-]{36}$/i.test(input.prefabUuid || '');
    if (command === 'content.stress.run') {
        const budgetKeys = ['targetFps', 'maxResourceLoadP95Ms', 'maxImportParserP95Ms', 'maxPngParserP95Ms', 'maxReleaseCallP95Ms'];
        const budgets = input.budgets;
        return creatorVersion === '2.4.15' && keys.length === 9
            && /^[a-z0-9][a-z0-9-]{2,31}$/.test(input.buildId || '')
            && Array.isArray(input.resourcePaths) && input.resourcePaths.length >= 2 && input.resourcePaths.length <= 16
            && input.resourcePaths.every((item) => typeof item === 'string' && /^[A-Za-z0-9_-]{1,64}(?:\/[A-Za-z0-9_-]{1,64}){0,7}$/.test(item))
            && new Set(input.resourcePaths).size === input.resourcePaths.length
            && Array.isArray(input.parseFixturePaths) && input.parseFixturePaths.length >= 2 && input.parseFixturePaths.length <= 16
            && input.parseFixturePaths.every((item) => typeof item === 'string' && /^[A-Za-z0-9_-]{1,64}(?:\/[A-Za-z0-9_-]{1,64}){0,7}$/.test(item))
            && new Set(input.parseFixturePaths).size === input.parseFixturePaths.length
            && input.parseFixturePaths.every((item) => !input.resourcePaths.includes(item))
            && typeof input.failureResourcePath === 'string' && input.parseFixturePaths.includes(input.failureResourcePath)
            && !input.resourcePaths.includes(input.failureResourcePath)
            && Number.isInteger(input.cycles) && input.cycles >= 8 && input.cycles <= 256 && input.cycles >= input.resourcePaths.length + 1
            && Number.isInteger(input.nodeCount) && input.nodeCount >= 32 && input.nodeCount <= 1024
            && typeof input.packable === 'boolean'
            && input.profileId === 'macos-arm64-chrome-headless-swiftshader-1280x800'
            && budgets && typeof budgets === 'object' && !Array.isArray(budgets)
            && Object.keys(budgets).length === budgetKeys.length && budgetKeys.every((key) => Number.isFinite(budgets[key]))
            && budgets.targetFps >= 1 && budgets.targetFps <= 360
            && budgetKeys.slice(1).every((key) => budgets[key] >= 0.01 && budgets[key] <= 60000);
    }
    return keys.every((key) => ['assetName', 'action', 'operationId', ...(creatorVersion === '2.4.15' ? ['position'] : [])].includes(key))
        && typeof input.assetName === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i.test(input.assetName)
        && ['apply', 'compensate', 'replay'].includes(input.action)
        && (input.position === undefined || (creatorVersion === '2.4.15' && ['apply', 'replay'].includes(input.action) && validPosition(input.position)))
        && (input.operationId === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.operationId));
}

function dispatchCommand(request, invoke) {
    const { targets, projectRoot, creatorVersion, command, input } = request;
    if (!Array.isArray(targets) || !targets.length || !targets.every((target) =>
        target && versions.has(target.creatorVersion) && typeof target.projectRoot === 'string')
        || !versions.has(creatorVersion) || !commands.has(command) || typeof projectRoot !== 'string') {
        return problem('INVALID_ARGUMENT', 'Provide targets, an exact project and Creator version, a supported command, and valid input.');
    }
    if (command === 'asset.searchPng' && creatorVersion !== '2.4.15')
        return problem('COMMAND_UNAVAILABLE', 'PNG asset search is currently supported only by Creator 2.4.15.');
    if (command === 'asset.refreshFolder' && creatorVersion !== '2.4.15')
        return problem('COMMAND_UNAVAILABLE', 'Asset folder refresh is currently supported only by Creator 2.4.15.');
    if (command === 'prefab.source.patch' && creatorVersion !== '2.4.15')
        return problem('COMMAND_UNAVAILABLE', 'Prefab source editing is currently supported only by Creator 2.4.15.');
    if (command === 'prefab.source.inspect' && creatorVersion !== '2.4.15')
        return problem('COMMAND_UNAVAILABLE', 'Prefab source inspection is currently supported only by Creator 2.4.15.');
    if (command === 'content.stress.run' && creatorVersion !== '2.4.15')
        return problem('COMMAND_UNAVAILABLE', 'Runtime content stress diagnostics are currently supported only by Creator 2.4.15.');
    if (!validInput(command, input, creatorVersion)) return problem('INVALID_ARGUMENT', 'Provide valid input for the selected command and Creator version.');
    const project = path.resolve(projectRoot);
    if (['asset.removeImportedPng', 'asset.validatePng', 'asset.refreshPng'].includes(command) && creatorVersion !== '2.4.15')
        return problem('COMMAND_UNAVAILABLE', 'Pipeline-owned PNG validation, refresh, and removal are currently supported only by Creator 2.4.15.');
    if (command === 'asset.refreshFolder' && !existingAssetFolder(project, input.folderPath))
        return problem('ASSET_FOLDER_UNAVAILABLE', 'The selected folder must already exist under the project assets directory and contain no symlink path components.');
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
    if (selected.activeScene && !['asset.searchPng', 'asset.refreshFolder'].includes(command)) executionArgs.push('--expected-scene', selected.activeScene);
    let operationId = null;
    if (command === 'asset.importPng') executionArgs.push('--png', path.resolve(input.sourcePath));
    if (command === 'asset.removeImportedPng') executionArgs.push('--asset-remove', input.assetName,
        '--texture-uuid', input.textureUuid, '--sprite-frame-uuid', input.spriteFrameUuid, '--source-sha256', input.sha256);
    if (command === 'asset.validatePng') executionArgs.push('--asset-validate', input.assetName, '--asset-pipeline-id', input.pipelineId);
    if (command === 'asset.refreshPng') executionArgs.push('--asset-refresh', input.assetName, '--asset-pipeline-id', input.pipelineId);
    if (command === 'asset.refreshFolder') executionArgs.push('--asset-refresh-folder', input.folderPath);
    if (command === 'scene.node.inspect') executionArgs.push('--node-path', input.nodePath);
    if (command === 'asset.searchPng') executionArgs.push('--asset-search-png', input.query,
        '--asset-search-limit', String(input.limit === undefined ? 20 : input.limit),
        '--asset-search-offset', String(input.offset === undefined ? 0 : input.offset));
    if (command === 'scene.pngSprite') {
        operationId = input.operationId || crypto.randomUUID();
        executionArgs.push('--scene-asset', input.assetName, '--scene-action', input.action, '--operation-id', operationId);
        if (input.position) executionArgs.push('--scene-position', JSON.stringify(input.position));
    }
    if (command === 'scene.node.create') {
        operationId = input.operationId || crypto.randomUUID();
        executionArgs.push('--parent-path', input.parentPath, '--parent-uuid', input.parentUuid,
            '--node-name', input.nodeName, '--action', input.action, '--operation-id', operationId);
        if (input.sourceOperationId) executionArgs.push('--source-operation-id', input.sourceOperationId);
        if (input.components !== undefined) executionArgs.push('--components', JSON.stringify(input.components));
        if (input.transform !== undefined) executionArgs.push('--transform', JSON.stringify(input.transform));
        if (input.prefabMode !== undefined) executionArgs.push('--prefab-mode', input.prefabMode);
        if (input.prefabUuid !== undefined) executionArgs.push('--prefab-uuid', input.prefabUuid);
    }
    if (command === 'scene.node.patch') {
        operationId = input.operationId || crypto.randomUUID();
        executionArgs.push('--target-node-path', input.targetNodePath, '--target-node-uuid', input.targetNodeUuid,
            '--action', input.action, '--expected-diff', JSON.stringify(input.expectedDiff), '--operation-id', operationId);
        if (input.sourceOperationId) executionArgs.push('--source-operation-id', input.sourceOperationId);
    }
    if (command === 'prefab.source.patch') {
        operationId = input.operationId || crypto.randomUUID();
        executionArgs.push('--prefab-uuid', input.prefabUuid, '--target-node-path', input.targetNodePath,
            '--target-node-uuid', input.targetNodeUuid, '--action', input.action,
            '--expected-diff', JSON.stringify(input.expectedDiff), '--operation-id', operationId);
        if (input.expectedPrefabSha256) executionArgs.push('--expected-prefab-sha256', input.expectedPrefabSha256);
        if (input.sourceOperationId) executionArgs.push('--source-operation-id', input.sourceOperationId);
    }
    if (command === 'prefab.source.inspect') executionArgs.push('--prefab-uuid', input.prefabUuid);
    if (command === 'content.stress.run') executionArgs.push('--input', JSON.stringify(input));
    const patchOperation = command === 'scene.node.patch';
    const prefabSourcePatch = command === 'prefab.source.patch';
    const hostScript = command === 'scene.node.create' ? 'node-create-host.js'
        : patchOperation ? 'scene-node-patch-host.js' : prefabSourcePatch ? 'prefab-source-patch-host.js'
            : command === 'prefab.source.inspect' ? 'prefab-source-inspect-host.js'
                : command === 'content.stress.run' ? 'content-stress-host.js' : 'bridge-host.js';
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
    const patchOperationResult = command === 'scene.node.patch';
    const prefabSourcePatchResult = command === 'prefab.source.patch';
    const nodeNeedsPreview = nodeOperation && ((record.manifest.components || []).length > 0 || !!record.manifest.prefabMode);
    const state = { ...base, phases: record.phases, intent: record.intent,
        result: nodeOperation ? { sceneName: record.sceneName, action: record.manifest.action, nodeName: record.manifest.nodeName,
            nodeUuid: record.createdNodeUuid || record.manifest.targetNodeUuid, parentPath: record.manifest.parentPath, parentUuid: record.manifest.parentUuid,
            components: record.manifest.components || [], transform: record.manifest.transform || {},
            ...(record.manifest.prefabMode ? { prefabMode: record.manifest.prefabMode,
                prefabUuid: record.prefabUuid || record.manifest.prefabUuid || null,
                ...(record.manifest.prefabUrl ? { prefabUrl: record.manifest.prefabUrl } : {}) } : {}) }
            : prefabSourcePatchResult ? { action: record.manifest.action, prefabUuid: record.manifest.prefabUuid,
                prefabUrl: record.manifest.prefabUrl, targetNodePath: record.manifest.targetNodePath,
                targetNodeUuid: record.manifest.targetNodeUuid, expectedDiff: record.manifest.expectedDiff,
                beforeSha256: record.beforeSha256, afterSha256: record.afterSha256, reopened: record.phases.disk === 'passed' }
            : patchOperationResult ? { sceneName: record.sceneName, action: record.manifest.action, targetNodePath: record.manifest.targetNodePath,
                targetNodeUuid: record.manifest.targetNodeUuid, expectedDiff: record.manifest.expectedDiff }
            : { sceneName: record.sceneName, action: record.manifest.sceneAction, assetName: record.manifest.assetName,
                nodeName: record.manifest.nodeName, assetUuid: record.manifest.assetUuid,
                ...(record.manifest.position ? { position: record.manifest.position } : {}) },
        ...(record.previewAttempt ? { previewAttempt: record.previewAttempt } : {}) };
    if (record.phases.disk === 'passed') {
        return { success: true, outcome: (nodeOperation && record.phases.preview === 'passed') || (nodeOperation && !nodeNeedsPreview)
            || prefabSourcePatchResult || (!nodeOperation && record.phases.preview === 'passed') || input.action === 'compensate' ? 'completed' : 'needs-preview', ...state };
    }
    if (record.intent === 'editor-write-sent' || record.phases.editor === 'passed') {
        return { success: false, outcome: 'needs-review', ...state,
            error: dispatchError('WRITE_OUTCOME_UNCERTAIN', 'Inspect the saved scene and operation record before any retry.', 'record', 'possible') };
    }
    if (nodeOperation || patchOperationResult || prefabSourcePatchResult) {
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
    const patchOperation = knownRecord && knownRecord.capabilityId === 'scene.node.patch';
    const prefabSourcePatch = knownRecord && knownRecord.capabilityId === 'prefab.source.patch';
    if (previewAcceptId && prefabSourcePatch)
        return problem('PREVIEW_NOT_APPLICABLE', 'Prefab source patches are verified by saving, reopening the Prefab in Creator, and serialized asset readback.', null, 'preview');
    const nodeNeedsPreview = nodeOperation && ((knownRecord.manifest.components || []).length > 0 || !!knownRecord.manifest.prefabMode);
    if (nodeOperation && previewAcceptId && !nodeNeedsPreview)
        return problem('PREVIEW_NOT_APPLICABLE', 'Empty node creation is verified by scene readback.', null, 'preview');
    if (previewAcceptId) {
        const accepted = parseJson(invoke('operation-preview.js', ['--project', project, '--creator-version', creatorVersion,
            '--operation-id', operationId, '--evidence', JSON.stringify(evidence || null)]));
        if (!accepted || accepted.success !== true) {
            return problem(accepted && accepted.error && accepted.error.code || 'PREVIEW_ACCEPT_FAILED',
                accepted && accepted.error && accepted.error.message || 'Could not record preview evidence.', null, 'preview');
        }
    }
    const operationHost = nodeOperation ? 'node-create-host.js' : patchOperation ? 'scene-node-patch-host.js'
        : prefabSourcePatch ? 'prefab-source-patch-host.js' : 'bridge-host.js';
    const readback = parseJson(invoke(operationHost, ['--project', project, '--creator-version', creatorVersion, '--operation-get', operationId]));
    if (!readback || readback.success !== true || !readback.data) return problem('OPERATION_STATUS_UNKNOWN', 'Cannot read operation record.', null, 'record', 'unknown');
    const record = readback.data;
    if (!validOperationRecord(record)) return problem('OPERATION_RECORD_INVALID', 'Operation record is incomplete.', null, 'record', 'unknown');
    if (record.operationId !== operationId || record.projectRoot !== project || record.creatorVersion !== creatorVersion) {
        return problem('OPERATION_TARGET_MISMATCH', 'Operation record does not match the requested target.', null, 'record', 'unknown');
    }
    const base = { command: prefabSourcePatch ? 'prefab.source.patch' : patchOperation ? 'scene.node.patch' : nodeOperation ? 'scene.node.create' : 'scene.pngSprite', operationId, phases: record.phases, intent: record.intent,
        result: nodeOperation ? { sceneName: record.sceneName, action: record.manifest.action, nodeName: record.manifest.nodeName,
            nodeUuid: record.createdNodeUuid || record.manifest.targetNodeUuid, parentPath: record.manifest.parentPath, parentUuid: record.manifest.parentUuid,
            components: record.manifest.components || [], transform: record.manifest.transform || {},
            ...(record.manifest.prefabMode ? { prefabMode: record.manifest.prefabMode,
                prefabUuid: record.prefabUuid || record.manifest.prefabUuid || null,
                ...(record.manifest.prefabUrl ? { prefabUrl: record.manifest.prefabUrl } : {}) } : {}) }
            : prefabSourcePatch ? { action: record.manifest.action, prefabUuid: record.manifest.prefabUuid,
                prefabUrl: record.manifest.prefabUrl, targetNodePath: record.manifest.targetNodePath,
                targetNodeUuid: record.manifest.targetNodeUuid, expectedDiff: record.manifest.expectedDiff,
                beforeSha256: record.beforeSha256, afterSha256: record.afterSha256, reopened: record.phases.disk === 'passed' }
            : patchOperation ? { sceneName: record.sceneName, action: record.manifest.action, targetNodePath: record.manifest.targetNodePath,
                targetNodeUuid: record.manifest.targetNodeUuid, expectedDiff: record.manifest.expectedDiff }
            : { sceneName: record.sceneName, action: record.manifest.sceneAction, assetName: record.manifest.assetName,
                nodeName: record.manifest.nodeName, assetUuid: record.manifest.assetUuid,
                ...(record.manifest.position ? { position: record.manifest.position } : {}) },
        ...(record.previewAttempt ? { previewAttempt: record.previewAttempt } : {}) };
    const statusBase = { ...base, ...(record.reconciliation ? { reconciliation: record.reconciliation } : {}) };
    if (record.reconciliation && record.reconciliation.disposition === 'no-effect') {
        return { success: false, outcome: 'failed', ...statusBase,
            error: dispatchError('WRITE_RECONCILED_NO_EFFECT', 'The editor write failed and live plus disk readback confirmed no scene change.', 'recovery', 'none') };
    }
    if (record.phases.disk === 'passed') {
        return { success: true, outcome: (nodeOperation && record.phases.preview === 'passed') || (nodeOperation && !nodeNeedsPreview)
            || prefabSourcePatch || record.manifest.action === 'compensate' || record.manifest.sceneAction === 'compensate'
            || record.phases.preview === 'passed' ? 'completed' : 'needs-preview', ...base };
    }
    if (record.intent === 'editor-write-sent' || record.phases.editor === 'passed') {
        return { success: false, outcome: 'needs-review', ...base,
            error: dispatchError('WRITE_OUTCOME_UNCERTAIN', 'Inspect the saved scene before any retry.', 'record', 'possible') };
    }
    if (nodeOperation || patchOperation) {
        const failure = [...record.receipts].reverse().find((item) => item.status === 'failed' && item.error);
        if (failure) return { success: false, outcome: 'failed', ...base,
            error: dispatchError(typeof failure.error.code === 'string' ? failure.error.code : 'OPERATION_INCOMPLETE',
                failure.error.message || 'Node creation was rejected.', 'record', 'none') };
    }
    return problem('OPERATION_INCOMPLETE', 'Operation did not reach a verified disk write.', null, 'record', 'possible');
}

function reconcileNodePatchOperation({ targets, project, creatorVersion, operationId, record }, invoke) {
    if (creatorVersion !== '2.4.15' || record.creatorVersion !== creatorVersion || record.projectRoot !== project
        || record.capabilityId !== 'scene.node.patch' || record.phases.disk === 'passed'
        || record.intent !== 'editor-write-sent' || !record.sceneName) {
        return problem('OPERATION_NOT_RECONCILABLE', 'Only an interrupted 2.4 node patch with a persisted scene and pending disk receipt can be reconciled.', null, 'recovery');
    }
    const targetArgs = targets.flatMap((target) => ['--target', `${target.creatorVersion}=${path.resolve(target.projectRoot)}`]);
    const listed = parseJson(invoke('catalog-host.js', [...targetArgs, '--query', 'instances.list']));
    if (!listed || listed.success !== true || !Array.isArray(listed.data)) return problem('CATALOG_FAILED', 'Cannot list Creator instances.', null, 'selection');
    const matches = listed.data.filter((item) => item.projectRoot === project);
    if (matches.length !== 1) return problem(matches.length ? 'AMBIGUOUS_EDITOR' : 'EDITOR_NOT_FOUND', 'Project must select one Creator instance.');
    const instance = matches[0];
    if (instance.creatorVersion !== creatorVersion) return problem('CREATOR_VERSION_MISMATCH', 'Selected Creator version differs from the operation.');
    if (instance.state !== 'ready') return problem(instance.error || 'EDITOR_NOT_CONNECTED', 'Selected Creator instance is not ready.');
    const catalog = parseJson(invoke('catalog-host.js', [...targetArgs, '--query', 'capabilities.list', '--project', project, '--creator-version', creatorVersion]));
    const selected = catalog && catalog.data && catalog.data.instance;
    const patchCapability = catalog && catalog.data && Array.isArray(catalog.data.commands)
        && catalog.data.commands.find((command) => command.id === 'scene.node.patch');
    if (!catalog || catalog.success !== true || !selected || !patchCapability || patchCapability.status !== 'available'
        || selected.instanceId !== instance.instanceId || selected.catalogRevision !== instance.catalogRevision
        || selected.activeScene !== instance.activeScene || selected.activeScene !== record.sceneName) {
        return problem('RECONCILE_TARGET_CHANGED', 'The exact Creator instance and recorded scene must still be active.', null, 'recovery');
    }
    const execution = invoke('scene-node-patch-reconcile-host.js', ['--project', project, '--creator-version', creatorVersion,
        '--expected-instance-id', selected.instanceId, '--expected-scene', record.sceneName, '--operation-id', operationId]);
    if (execution.status !== 0) return problem('RECONCILE_NOT_CONFIRMED', 'Live and disk state do not agree on either the before or after diff; review the operation manually.',
        { operationId, stderr: execution.stderr.trim() }, 'recovery', 'possible');
    const line = execution.stdout.split('\n').find((item) => item.startsWith('reconcile.result '));
    let result;
    try { result = JSON.parse(line.slice('reconcile.result '.length)); } catch (_) { result = null; }
    if (!result || result.operationId !== operationId || !['no-effect', 'write-verified'].includes(result.disposition)) {
        return problem('RECONCILE_RESULT_MISSING', 'Host did not return a verified reconciliation disposition.', { operationId }, 'recovery', 'unknown');
    }
    return operationStatus({ projectRoot: project, creatorVersion, operationGetId: operationId }, invoke);
}

function reconcileOperation(request, invoke = runProcess) {
    const { targets, projectRoot, creatorVersion, operationReconcileId } = request;
    if (!Array.isArray(targets) || !targets.length || !targets.every((target) =>
        target && versions.has(target.creatorVersion) && typeof target.projectRoot === 'string')
        || !versions.has(creatorVersion) || typeof projectRoot !== 'string'
        || typeof operationReconcileId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationReconcileId)) {
        return problem('INVALID_ARGUMENT', 'Provide targets, exact project/version, and operation ID.');
    }
    const project = path.resolve(projectRoot);
    let record;
    try { record = operationStore.read(project, operationReconcileId); }
    catch (_) { return problem('OPERATION_NOT_FOUND', 'Operation record does not exist.'); }
    if (record.reconciliation && record.reconciliation.disposition === 'no-effect') {
        return operationStatus({ projectRoot: project, creatorVersion, operationGetId: operationReconcileId }, invoke);
    }
    if (record.capabilityId === 'scene.node.patch') return reconcileNodePatchOperation({ targets, project, creatorVersion,
        operationId: operationReconcileId, record }, invoke);
    if (!operationReconcile.allowedRecord(record, project, creatorVersion, operationReconcileId)) {
        return problem('OPERATION_NOT_RECONCILABLE', 'Only an uncertain failed apply/replay with no recorded node can be reconciled.', null, 'recovery');
    }
    const targetArgs = targets.flatMap((target) => ['--target', `${target.creatorVersion}=${path.resolve(target.projectRoot)}`]);
    const listed = parseJson(invoke('catalog-host.js', [...targetArgs, '--query', 'instances.list']));
    if (!listed || listed.success !== true || !Array.isArray(listed.data)) return problem('CATALOG_FAILED', 'Cannot list Creator instances.', null, 'selection');
    const matches = listed.data.filter((item) => item.projectRoot === project);
    if (matches.length !== 1) return problem(matches.length ? 'AMBIGUOUS_EDITOR' : 'EDITOR_NOT_FOUND', 'Project must select one Creator instance.');
    const instance = matches[0];
    if (instance.creatorVersion !== creatorVersion) return problem('CREATOR_VERSION_MISMATCH', 'Selected Creator version differs from the operation.');
    if (instance.state !== 'ready') return problem(instance.error || 'EDITOR_NOT_CONNECTED', 'Selected Creator instance is not ready.');
    const catalog = parseJson(invoke('catalog-host.js', [...targetArgs, '--query', 'capabilities.list', '--project', project, '--creator-version', creatorVersion]));
    const selected = catalog && catalog.data && catalog.data.instance;
    const snapshot = catalog && catalog.data && Array.isArray(catalog.data.commands)
        && catalog.data.commands.find((command) => command.id === 'scene.snapshot');
    if (!catalog || catalog.success !== true || !selected || !snapshot || snapshot.status !== 'available'
        || selected.instanceId !== instance.instanceId || selected.catalogRevision !== instance.catalogRevision
        || selected.activeScene !== instance.activeScene || selected.activeScene !== operationReconcile.recordSceneName(record)) {
        return problem('RECONCILE_TARGET_CHANGED', 'The selected Creator instance must be stable and have the recorded scene active.', null, 'recovery');
    }
    const execution = invoke('node-create-host.js', ['--project', project, '--creator-version', creatorVersion,
        '--expected-instance-id', selected.instanceId, '--expected-scene', operationReconcile.recordSceneName(record),
        '--operation-reconcile', operationReconcileId]);
    if (execution.status !== 0) return problem('RECONCILE_NOT_CONFIRMED', 'Live and disk state did not satisfy the no-effect reconciliation checks.',
        { operationId: operationReconcileId, stderr: execution.stderr.trim() }, 'recovery', 'possible');
    const reconciliationLine = execution.stdout.split('\n').find((line) => line.startsWith('reconcile.result '));
    let reconciliationResult;
    try { reconciliationResult = JSON.parse(reconciliationLine.slice('reconcile.result '.length)); } catch (_) { reconciliationResult = null; }
    if (!reconciliationResult || reconciliationResult.operationId !== operationReconcileId || reconciliationResult.disposition !== 'no-effect') {
        return problem('RECONCILE_RESULT_MISSING', 'Host finished without a no-effect reconciliation receipt.', { operationId: operationReconcileId }, 'recovery', 'unknown');
    }
    return operationStatus({ projectRoot: project, creatorVersion, operationGetId: operationReconcileId }, invoke);
}

function dispatch(request, invoke = runProcess) {
    const raw = request.operationReconcileId ? reconcileOperation(request, invoke) : request.operationGetId || request.previewAcceptId
        ? operationStatus(request, invoke) : dispatchCommand(request, invoke);
    return { success: raw.success, outcome: raw.outcome, command: raw.command || request.command || (request.operationGetId || request.previewAcceptId ? 'scene.pngSprite' : null),
        instance: raw.instance || null, operationId: raw.operationId || request.operationGetId || request.previewAcceptId || null,
        result: raw.result || null, phases: raw.phases || null, intent: raw.intent || null,
        error: raw.error || null, ...(raw.reconciliation ? { reconciliation: raw.reconciliation } : {}),
        ...(raw.details ? { details: raw.details } : {}) };
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
        previewAcceptId: values('--preview-accept')[0], operationReconcileId: values('--operation-reconcile')[0], evidence };
}

if (require.main === module) {
    const result = dispatch(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.success ? 0 : 1;
}

module.exports = { dispatch, parseArgs, operationStatus, reconcileOperation };
