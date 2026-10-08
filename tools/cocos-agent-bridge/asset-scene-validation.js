'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { dispatch } = require('./agent-dispatch');
const sceneBatch = require('./scene-sprite-batch');

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pngNamePattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i;
const fail = (code, message) => ({ success: false, outcome: 'failed', error: { code, message } });

function recordFile(projectRoot, pipelineId) {
    return path.join(projectRoot, '.cocos-agent', 'asset-scene-pipelines', `${pipelineId}.json`);
}
function readRecord(projectRoot, pipelineId) {
    const filename = recordFile(projectRoot, pipelineId);
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Object.assign(new Error('Pipeline record is not a regular file.'), { code: 'INVALID_RECORD_FILE' });
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
}
function saveRecord(record) {
    const filename = recordFile(record.projectRoot, record.pipelineId);
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    record.updatedAt = new Date().toISOString();
    const temporary = `${filename}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 });
        fs.renameSync(temporary, filename);
    } finally { try { fs.unlinkSync(temporary); } catch (_) { /* consumed by rename */ } }
}
function validTarget(params) {
    return params && typeof params.projectRoot === 'string' && path.isAbsolute(params.projectRoot)
        && params.creatorVersion === '2.4.15' && Array.isArray(params.targets) && params.targets.length > 0
        && params.targets.every((target) => target && typeof target.projectRoot === 'string' && path.isAbsolute(target.projectRoot)
            && ['2.4.15', '3.8.7'].includes(target.creatorVersion))
        && params.targets.filter((target) => path.resolve(target.projectRoot) === path.resolve(params.projectRoot)
            && target.creatorVersion === '2.4.15').length === 1;
}
function validParams(params, needsAsset = false) {
    return validTarget(params) && idPattern.test(params.pipelineId || '')
        && (params.assetName === undefined && !needsAsset || typeof params.assetName === 'string' && pngNamePattern.test(params.assetName));
}
function inspectPng(record, item) {
    const filename = path.join(record.projectRoot, 'assets', 'resources', item.assetName);
    const checks = { filePresent: false, sourceHashMatches: false, pngSignatureValid: false, dimensionsMatch: false,
        metaReadable: false, textureUuidMatches: false, spriteFrameUuidMatches: false, rawTextureUuidMatches: false };
    const issues = [];
    let data; let meta;
    try {
        const stat = fs.lstatSync(filename);
        if (!stat.isFile() || stat.isSymbolicLink()) issues.push('ASSET_FILE_NOT_REGULAR');
        else { data = fs.readFileSync(filename); checks.filePresent = true; }
    } catch (_) { issues.push('ASSET_FILE_MISSING'); }
    if (data) {
        checks.sourceHashMatches = crypto.createHash('sha256').update(data).digest('hex') === item.sha256;
        if (!checks.sourceHashMatches) issues.push('ASSET_HASH_MISMATCH');
        checks.pngSignatureValid = data.length >= 24 && data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
            && data.toString('ascii', 12, 16) === 'IHDR';
        if (!checks.pngSignatureValid) issues.push('INVALID_PNG');
        if (checks.pngSignatureValid) {
            checks.dimensionsMatch = data.readUInt32BE(16) === item.width && data.readUInt32BE(20) === item.height;
            if (!checks.dimensionsMatch) issues.push('PNG_DIMENSIONS_MISMATCH');
        }
    }
    try {
        const metaFilename = `${filename}.meta`;
        const stat = fs.lstatSync(metaFilename);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('meta is not a regular file');
        meta = JSON.parse(fs.readFileSync(metaFilename, 'utf8'));
        checks.metaReadable = true;
    } catch (_) { issues.push('META_UNREADABLE'); }
    if (meta) {
        checks.textureUuidMatches = meta.importer === 'texture' && meta.uuid === item.textureUuid;
        if (!checks.textureUuidMatches) issues.push('TEXTURE_UUID_MISMATCH');
        const frames = Object.values(meta.subMetas || {}).filter((sub) => sub && sub.importer === 'sprite-frame');
        checks.spriteFrameUuidMatches = frames.length === 1 && frames[0].uuid === item.spriteFrameUuid;
        if (!checks.spriteFrameUuidMatches) issues.push('SPRITEFRAME_UUID_MISMATCH');
        checks.rawTextureUuidMatches = frames.length === 1 && frames[0].rawTextureUuid === item.textureUuid;
        if (!checks.rawTextureUuidMatches) issues.push('RAWTEXTURE_UUID_MISMATCH');
    }
    return { checks, issues };
}
function readSceneReference(projectRoot, sceneName, nodeName, spriteFrameUuid) {
    const root = path.join(projectRoot, 'assets');
    const candidates = [];
    let filesSeen = 0;
    let unsafe = false;
    function visit(directory, depth) {
        if (unsafe || depth > 12) { unsafe = true; return; }
        let entries;
        try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { unsafe = true; return; }
        for (const entry of entries) {
            const filename = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) { unsafe = true; return; }
            if (entry.isDirectory()) visit(filename, depth + 1);
            else if (entry.isFile()) {
                if (++filesSeen > 20000) { unsafe = true; return; }
                if (entry.name === `${sceneName}.fire`) candidates.push(filename);
            }
            if (unsafe) return;
        }
    }
    visit(root, 0);
    if (unsafe) return { success: false, code: 'SCENE_SCAN_UNSAFE' };
    if (candidates.length !== 1) return { success: false, code: candidates.length ? 'SCENE_ASSET_AMBIGUOUS' : 'SCENE_ASSET_NOT_FOUND' };
    let objects;
    try {
        if (fs.statSync(candidates[0]).size > 20 * 1024 * 1024) return { success: false, code: 'SCENE_ASSET_TOO_LARGE' };
        objects = JSON.parse(fs.readFileSync(candidates[0], 'utf8'));
    } catch (_) { return { success: false, code: 'SCENE_ASSET_UNREADABLE' }; }
    if (!Array.isArray(objects)) return { success: false, code: 'SCENE_ASSET_INVALID' };
    const canvases = objects.flatMap((node, index) => node && node.__type__ === 'cc.Node' && node._name === 'Canvas' ? [index] : []);
    if (canvases.length !== 1) return { success: false, code: canvases.length ? 'SCENE_CANVAS_AMBIGUOUS' : 'SCENE_CANVAS_NOT_FOUND' };
    const nodes = objects.flatMap((node, index) => {
        if (!node || node.__type__ !== 'cc.Node' || node._name !== nodeName || !Array.isArray(node._components)) return [];
        const spriteFrames = node._components.flatMap((reference) => {
            const component = reference && Number.isInteger(reference.__id__) ? objects[reference.__id__] : null;
            return component && component.__type__ === 'cc.Sprite' && component.node?.__id__ === index
                ? [component._spriteFrame?.__uuid__ || null] : [];
        });
        return [{ index, parentId: node._parent && node._parent.__id__, children: objects[canvases[0]]._children, spriteFrames }];
    });
    if (nodes.length !== 1) return { success: false, code: nodes.length ? 'SCENE_NODE_AMBIGUOUS' : 'SCENE_NODE_NOT_FOUND' };
    const attachedToCanvas = nodes[0].parentId === canvases[0]
        && Array.isArray(nodes[0].children) && nodes[0].children.some((reference) => reference && reference.__id__ === nodes[0].index);
    return attachedToCanvas && nodes[0].spriteFrames.length === 1 && nodes[0].spriteFrames[0] === spriteFrameUuid
        ? { success: true, filename: candidates[0] } : { success: false, code: 'SCENE_SPRITEFRAME_MISMATCH' };
}
function sameInstance(a, b) {
    return Boolean(a && b && a.instanceId === b.instanceId && a.projectRoot === b.projectRoot
        && a.creatorVersion === b.creatorVersion && a.activeScene === b.activeScene);
}
function request(params) {
    return { targets: params.targets, projectRoot: path.resolve(params.projectRoot), creatorVersion: '2.4.15' };
}
function inspectNode(params, nodePath, run) {
    return run({ ...request(params), command: 'scene.node.inspect', input: { nodePath } });
}
function validate(params, run = dispatch) {
    if (!validParams(params)) return fail('INVALID_ARGUMENT', 'Project, Creator 2.4.15, pipeline ID, and optional asset name are required.');
    const projectRoot = path.resolve(params.projectRoot);
    let record;
    try { record = readRecord(projectRoot, params.pipelineId); }
    catch (error) { return fail(error.code === 'ENOENT' ? 'PIPELINE_NOT_FOUND' : 'PIPELINE_READ_FAILED', error.message); }
    if (record.projectRoot !== projectRoot || record.creatorVersion !== '2.4.15') return fail('PIPELINE_TARGET_MISMATCH', 'Pipeline target differs.');
    if (!['needs-preview', 'completed', 'needs-review'].includes(record.state)) return fail('PIPELINE_NOT_VALIDATABLE', `Pipeline state ${record.state} cannot be validated.`);
    const items = record.items.filter((item) => params.assetName === undefined || item.assetName === params.assetName);
    if (!items.length || items.some((item) => item.importStatus !== 'imported' || !item.textureUuid || !item.spriteFrameUuid
        || item.removalStatus === 'removed')) return fail('PIPELINE_ASSET_UNAVAILABLE', 'The requested resource is not an imported, retained item in this pipeline.');
    const snapshot = run({ ...request(params), command: 'scene.snapshot', input: {} });
    const sceneMatches = snapshot.success && sameInstance(snapshot.instance, { instanceId: record.instanceId,
        projectRoot, creatorVersion: '2.4.15', activeScene: record.sceneName });
    const batch = sceneBatch.get({ projectRoot, creatorVersion: '2.4.15', batchId: record.sceneBatchId });
    const reports = items.map((item) => {
        const disk = inspectPng(record, item);
        const editor = run({ ...request(params), command: 'asset.validatePng', input: { pipelineId: record.pipelineId, assetName: item.assetName } });
        const editorResult = editor.success ? editor.result : null;
        const nodePath = `${record.sceneName}/Canvas/${item.nodeName}`;
        const node = sceneMatches ? inspectNode(params, nodePath, run) : null;
        const components = node?.result?.node?.componentDetails;
        const runtimeReference = Boolean(node?.success && sameInstance(snapshot.instance, node.instance)
            && node.result?.sceneName === record.sceneName && node.result?.node?.status === 'found'
            && Array.isArray(components) && components.some((component) => component.classId === 'cc.Sprite'
                && component.spriteFrameUuid === item.spriteFrameUuid));
        const serialized = readSceneReference(projectRoot, record.sceneName, item.nodeName, item.spriteFrameUuid);
        const child = (batch.items || []).find((candidate) => candidate.assetName === item.assetName);
        const issues = [...disk.issues];
        if (!editor.success) issues.push(editor.error?.code || 'ASSETDB_VALIDATION_FAILED');
        else if (editorResult?.status === 'needs-review') issues.push(...(editorResult.issues || ['ASSETDB_VALIDATION_UNCERTAIN']));
        else if (editorResult?.status === 'repairable') issues.push(...(editorResult.issues || ['ASSETDB_MAPPING_STALE']));
        else if (editorResult?.status !== 'valid') issues.push('ASSETDB_VALIDATION_INVALID');
        if (!sceneMatches) issues.push('SCENE_CONTEXT_CHANGED');
        else if (!runtimeReference) issues.push(node?.result?.node?.status === 'not-found' ? 'SCENE_NODE_MISSING' : 'SCENE_RUNTIME_REFERENCE_MISMATCH');
        if (!serialized.success) issues.push(serialized.code);
        if (!child || child.status !== 'applied' || child.assetUuid !== item.spriteFrameUuid) issues.push('SCENE_BATCH_REFERENCE_MISMATCH');
        const uniqueIssues = [...new Set(issues)];
        const safeChecks = Object.values(disk.checks).every(Boolean) && sceneMatches && runtimeReference && serialized.success
            && child?.status === 'applied' && child.assetUuid === item.spriteFrameUuid;
        const repairable = uniqueIssues.length === 1 && uniqueIssues[0] === 'ASSETDB_MAPPING_STALE' && safeChecks;
        return { assetName: item.assetName, nodeName: item.nodeName, textureUuid: item.textureUuid,
            spriteFrameUuid: item.spriteFrameUuid, checks: { ...disk.checks, assetDb: editorResult?.checks || null,
                runtimeSceneReference: runtimeReference, serializedSceneReference: serialized.success,
                sceneBatchReference: Boolean(child?.status === 'applied' && child.assetUuid === item.spriteFrameUuid) },
            issues: uniqueIssues, status: uniqueIssues.length === 0 ? 'valid' : repairable ? 'repairable' : 'needs-review', repairable };
    });
    const outcome = reports.some((item) => item.status === 'needs-review') ? 'needs-review'
        : reports.some((item) => item.status === 'repairable') ? 'repairable' : 'valid';
    return { success: true, outcome, pipelineId: record.pipelineId, projectRoot, creatorVersion: '2.4.15',
        instanceId: record.instanceId, sceneName: record.sceneName, checkedAt: new Date().toISOString(), items: reports };
}
function repair(params, run = dispatch) {
    if (!validParams(params, true) || (params.repairId !== undefined && !idPattern.test(params.repairId)))
        return fail('INVALID_ARGUMENT', 'Project, Creator 2.4.15, pipeline ID, PNG name, and optional repair ID are required.');
    const projectRoot = path.resolve(params.projectRoot);
    let record;
    try { record = readRecord(projectRoot, params.pipelineId); }
    catch (error) { return fail(error.code === 'ENOENT' ? 'PIPELINE_NOT_FOUND' : 'PIPELINE_READ_FAILED', error.message); }
    if (record.projectRoot !== projectRoot || record.creatorVersion !== '2.4.15') return fail('PIPELINE_TARGET_MISMATCH', 'Pipeline target differs.');
    if (!['needs-preview', 'completed'].includes(record.state)) return fail('PIPELINE_NOT_REPAIRABLE', 'Only an active, retained resource pipeline can be repaired.');
    record.repairAttempts ||= [];
    const repairId = params.repairId || crypto.randomUUID();
    let attempt = record.repairAttempts.find((value) => value.repairId === repairId);
    if (attempt && (attempt.assetName !== params.assetName || attempt.action !== 'assetdb-refresh'))
        return fail('REPAIR_ID_CONFLICT', 'Repair ID belongs to another asset or action.');
    if (attempt && attempt.status === 'completed') return { success: true, outcome: 'repaired', pipelineId: record.pipelineId,
        repairId, assetName: params.assetName, attempt };
    const before = validate({ ...params, assetName: params.assetName }, run);
    if (!before.success) return before;
    const item = before.items.find((value) => value.assetName === params.assetName);
    if (!item) return fail('PIPELINE_ASSET_UNAVAILABLE', 'Asset does not belong to this pipeline.');
    if (item.status === 'valid') {
        if (!attempt) {
            attempt = { repairId, assetName: params.assetName, action: 'assetdb-refresh', status: 'already-valid',
                before, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            record.repairAttempts.push(attempt);
        } else { attempt.status = 'reconciled'; attempt.after = before; attempt.updatedAt = new Date().toISOString(); }
        saveRecord(record);
        return { success: true, outcome: 'already-valid', pipelineId: record.pipelineId, repairId, assetName: params.assetName, validation: before };
    }
    if (item.status !== 'repairable' || !item.repairable || item.issues.length !== 1 || item.issues[0] !== 'ASSETDB_MAPPING_STALE')
        return { success: false, outcome: 'needs-review', error: { code: 'ASSET_REPAIR_UNSAFE',
            message: 'Only a stale AssetDB mapping with matching source, metadata, UUIDs, and scene references can be refreshed.' }, validation: before };
    if (!attempt) {
        attempt = { repairId, assetName: params.assetName, action: 'assetdb-refresh', status: 'in-progress',
            before, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        record.repairAttempts.push(attempt);
    } else { attempt.status = 'in-progress'; attempt.before = before; attempt.updatedAt = new Date().toISOString(); }
    saveRecord(record);
    const refreshed = run({ ...request(params), command: 'asset.refreshPng', input: { pipelineId: record.pipelineId, assetName: params.assetName } });
    if (!refreshed.success || refreshed.outcome !== 'completed' || refreshed.result?.status !== 'valid') {
        attempt.status = 'needs-review'; attempt.error = refreshed.error || { code: 'ASSET_REFRESH_UNVERIFIED' };
        attempt.updatedAt = new Date().toISOString(); saveRecord(record);
        return { success: false, outcome: 'needs-review', pipelineId: record.pipelineId, repairId, assetName: params.assetName,
            error: attempt.error, validation: before };
    }
    const after = validate({ ...params, assetName: params.assetName }, run);
    if (!after.success || after.outcome !== 'valid' || after.items.length !== 1 || after.items[0].assetName !== params.assetName) {
        attempt.status = 'needs-review'; attempt.error = { code: 'ASSET_REFRESH_READBACK_FAILED' };
        attempt.after = after; attempt.updatedAt = new Date().toISOString(); saveRecord(record);
        return { success: false, outcome: 'needs-review', pipelineId: record.pipelineId, repairId, assetName: params.assetName,
            error: attempt.error, validation: after };
    }
    attempt.status = 'completed'; attempt.after = after; attempt.editorResult = refreshed.result;
    attempt.updatedAt = new Date().toISOString(); saveRecord(record);
    return { success: true, outcome: 'repaired', pipelineId: record.pipelineId, repairId, assetName: params.assetName,
        validation: after, editorResult: refreshed.result };
}

module.exports = { validate, repair, inspectPng, readSceneReference };
