'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { dispatch } = require('./agent-dispatch');
const assetBatch = require('./asset-batch');
const sceneBatch = require('./scene-sprite-batch');

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (code, message, details) => ({ success: false, outcome: 'failed', error: { code, message }, ...(details ? { details } : {}) });
function recordPath(projectRoot, pipelineId) {
    return path.join(projectRoot, '.cocos-agent', 'asset-scene-pipelines', `${pipelineId}.json`);
}
function save(record, create = false) {
    const filename = recordPath(record.projectRoot, record.pipelineId);
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    record.updatedAt = new Date().toISOString();
    if (create) return fs.writeFileSync(filename, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 });
    const temporary = `${filename}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 });
        fs.renameSync(temporary, filename);
    } finally { try { fs.unlinkSync(temporary); } catch (_) { /* consumed by rename */ } }
}
function read(projectRoot, pipelineId) {
    const filename = recordPath(projectRoot, pipelineId);
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Object.assign(new Error('Pipeline record must be a regular file.'), { code: 'INVALID_RECORD_FILE' });
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
}
function validPosition(value) {
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2
        && Number.isFinite(value.x) && Number.isFinite(value.y) && Math.abs(value.x) <= 4096 && Math.abs(value.y) <= 4096;
}
function validTarget(params) {
    return params && typeof params.projectRoot === 'string' && path.isAbsolute(params.projectRoot)
        && params.creatorVersion === '2.4.15' && Array.isArray(params.targets) && params.targets.length > 0
        && params.targets.every((target) => target && typeof target.projectRoot === 'string' && path.isAbsolute(target.projectRoot)
            && ['2.4.15', '3.8.7'].includes(target.creatorVersion))
        && params.targets.filter((target) => path.resolve(target.projectRoot) === path.resolve(params.projectRoot)
            && target.creatorVersion === '2.4.15').length === 1;
}
function sameInstance(a, b) {
    return Boolean(a && b && a.instanceId === b.instanceId && a.projectRoot === b.projectRoot
        && a.creatorVersion === b.creatorVersion && a.activeScene === b.activeScene);
}
function request(params) {
    return { targets: params.targets, projectRoot: path.resolve(params.projectRoot), creatorVersion: '2.4.15' };
}
function inspect(params, nodePath, run) {
    return run({ ...request(params), command: 'scene.node.inspect', input: { nodePath } });
}
function sceneContext(params, run) {
    const snapshot = run({ ...request(params), command: 'scene.snapshot', input: {} });
    if (!snapshot.success || !snapshot.instance || !snapshot.result || typeof snapshot.result.sceneName !== 'string'
        || !snapshot.result.sceneName) return { success: false, error: { code: 'SCENE_UNAVAILABLE' } };
    const canvasPath = `${snapshot.result.sceneName}/Canvas`;
    const canvas = inspect(params, canvasPath, run);
    if (!canvas.success || !sameInstance(snapshot.instance, canvas.instance) || canvas.result?.node?.status !== 'found'
        || !/^[A-Za-z0-9_-]{16,64}$/.test(canvas.result.node.uuid || ''))
        return { success: false, error: { code: 'CANVAS_NOT_FOUND' } };
    return { success: true, instance: snapshot.instance, sceneName: snapshot.result.sceneName,
        canvasPath, canvasUuid: canvas.result.node.uuid };
}
function plan(params, run = dispatch) {
    if (!validTarget(params) || !Array.isArray(params.sources) || params.sources.length < 2 || params.sources.length > 16)
        return fail('INVALID_PIPELINE', 'Provide one exact Creator 2.4.15 target and 2–16 absolute PNG sources.');
    if (params.positions !== undefined && (!Array.isArray(params.positions) || params.positions.length !== params.sources.length
        || params.positions.some((position) => !validPosition(position))))
        return fail('INVALID_POSITIONS', 'Provide one Canvas-local x/y position per source, within ±4096 design pixels.');
    const sourcePlan = assetBatch.plan(params);
    if (!sourcePlan.success) return sourcePlan;
    const context = sceneContext(params, run);
    if (!context.success) return fail(context.error.code, 'The active 2.4 scene must contain one inspectable Canvas.');
    const items = sourcePlan.items.map((item, index) => ({ assetName: item.assetName,
        nodeName: sceneBatch.nodeName(item.assetName), sourcePath: item.sourcePath, sha256: item.sha256,
        width: item.width, height: item.height, position: params.positions ? { ...params.positions[index] } : { x: 0, y: 0 } }));
    if (new Set(items.map((item) => item.nodeName)).size !== items.length)
        return fail('NODE_NAME_COLLISION', 'Source file names map to the same scene node name.');
    for (const item of items) {
        const node = inspect(params, `${context.sceneName}/Canvas/${item.nodeName}`, run);
        if (!node.success || !sameInstance(context.instance, node.instance) || node.result?.node?.status !== 'not-found')
            return fail('SCENE_NODE_CONFLICT', `Target node is present or cannot be checked: ${item.nodeName}`);
    }
    const pipelineId = params.pipelineId || crypto.randomUUID();
    if (!idPattern.test(pipelineId)) return fail('INVALID_PIPELINE_ID', 'Pipeline ID must be a UUID.');
    return { success: true, outcome: 'ready', pipelineId, projectRoot: path.resolve(params.projectRoot), creatorVersion: '2.4.15',
        instance: context.instance, sceneName: context.sceneName, canvasPath: context.canvasPath, canvasUuid: context.canvasUuid, items };
}
function childAssets(record, result) {
    if (!result || !Array.isArray(result.items)) return false;
    for (const source of result.items) {
        const item = record.items.find((candidate) => candidate.assetName === source.assetName);
        if (!item) continue;
        if (source.status === 'rejected' || source.status === 'pending') { item.importStatus = source.status; continue; }
        if (source.status !== 'imported' || source.sha256 !== item.sha256 || !source.result || !source.result.metadata) {
            item.importStatus = 'uncertain';
            continue;
        }
        const metadata = source.result.metadata;
        if (source.result.sha256 !== item.sha256 || !/^[0-9a-f-]{36}$/i.test(metadata.textureUuid || '')
            || !/^[0-9a-f-]{36}$/i.test(metadata.spriteFrameUuid || '') || metadata.rawTextureUuid !== metadata.textureUuid) {
            item.importStatus = 'uncertain';
            continue;
        }
        item.textureUuid = metadata.textureUuid;
        item.spriteFrameUuid = metadata.spriteFrameUuid;
        item.importStatus = 'imported';
    }
    return record.items.every((item) => item.importStatus === 'imported');
}
function publicRecord(record) {
    const items = record.items.map((item) => ({ assetName: item.assetName, nodeName: item.nodeName,
        sourcePath: item.sourcePath, sha256: item.sha256, width: item.width, height: item.height,
        textureUuid: item.textureUuid || null, spriteFrameUuid: item.spriteFrameUuid || null,
        position: item.position, importStatus: item.importStatus, sceneStatus: item.sceneStatus,
        previewStatus: item.previewStatus, removalStatus: item.removalStatus,
        operationId: item.operationId || null }));
    return { success: record.state === 'completed' || record.state === 'compensated', outcome: record.state,
        pipelineId: record.pipelineId, assetBatchId: record.assetBatchId, sceneBatchId: record.sceneBatchId,
        projectRoot: record.projectRoot, creatorVersion: record.creatorVersion, instanceId: record.instanceId,
        sceneName: record.sceneName, canvasUuid: record.canvasUuid, items,
        repairAttempts: record.repairAttempts || [], rollbackStatus: record.rollbackStatus,
        rollbackError: record.rollbackError || null, error: record.error || null };
}
function readImportedIdentity(record, item) {
    const assetPath = path.join(record.projectRoot, 'assets', 'resources', item.assetName);
    let data; let meta;
    try {
        if (!fs.lstatSync(assetPath).isFile() || !fs.lstatSync(`${assetPath}.meta`).isFile()) return { success: false, code: 'ASSET_NOT_PRESENT' };
        data = fs.readFileSync(assetPath);
        meta = JSON.parse(fs.readFileSync(`${assetPath}.meta`, 'utf8'));
    } catch (_) { return { success: false, code: 'ASSET_NOT_PRESENT' }; }
    const frames = Object.values(meta.subMetas || {}).filter((sub) => sub && sub.importer === 'sprite-frame');
    if (crypto.createHash('sha256').update(data).digest('hex') !== item.sha256 || meta.importer !== 'texture'
        || meta.uuid !== item.textureUuid || frames.length !== 1 || frames[0].uuid !== item.spriteFrameUuid
        || frames[0].rawTextureUuid !== item.textureUuid) return { success: false, code: 'ASSET_IDENTITY_CHANGED' };
    return { success: true };
}
function noSerializedReferences(projectRoot, uuids) {
    const root = path.join(projectRoot, 'assets');
    const needles = uuids.map((value) => Buffer.from(value, 'ascii'));
    let filesSeen = 0;
    let safe = true;
    function visit(directory, depth) {
        if (!safe || depth > 12) { safe = false; return; }
        let entries;
        try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { safe = false; return; }
        for (const entry of entries) {
            const filename = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) { safe = false; return; }
            if (entry.isDirectory()) { visit(filename, depth + 1); if (!safe) return; }
            else if (entry.isFile()) {
                if (++filesSeen > 20000) { safe = false; return; }
                let contents;
                try {
                    const stat = fs.statSync(filename);
                    if (stat.size > 20 * 1024 * 1024) { safe = false; return; }
                    contents = fs.readFileSync(filename);
                } catch (_) { safe = false; return; }
                if (needles.some((needle) => contents.indexOf(needle) !== -1)) { safe = false; return; }
            }
        }
    }
    visit(root, 0);
    return safe;
}
function reconcileAbsentRemovals(record) {
    if (record.rollbackError?.code !== 'ASSET_REMOVAL_UNVERIFIED'
        || !record.items.some((item) => item.removalStatus === 'removing')) return null;
    const scene = sceneBatch.get({ projectRoot: record.projectRoot, creatorVersion: '2.4.15', batchId: record.sceneBatchId });
    const safeItems = record.items.every((item) => item.removalStatus === 'removed'
        || item.removalStatus === 'removing' && !fs.existsSync(path.join(record.projectRoot, 'assets', 'resources', item.assetName))
        && !fs.existsSync(path.join(record.projectRoot, 'assets', 'resources', `${item.assetName}.meta`))
        && noSerializedReferences(record.projectRoot, [item.textureUuid, item.spriteFrameUuid]));
    if (!safeItems || !sceneRefsSafe(record, scene)) return null;
    for (const item of record.items) {
        if (item.removalStatus === 'removing') {
            item.removalStatus = 'removed';
            item.removalEvidence = { kind: 'disk-readback-after-editor-delete', observedAt: new Date().toISOString() };
        }
    }
    record.rollbackError = null;
    record.reconciliation = { kind: 'asset-absence-and-reference-scan', observedAt: new Date().toISOString() };
    record.rollbackStatus = 'passed';
    record.state = record.error ? 'failed' : 'compensated';
    save(record);
    return publicRecord(record);
}
function removeImported(record, run) {
    record.state = 'compensating'; record.rollbackStatus = 'in-progress'; save(record);
    let unresolved = false;
    for (const item of [...record.items].reverse()) {
        if (item.importStatus !== 'imported' || !item.textureUuid || !item.spriteFrameUuid) {
            if (item.importStatus === 'pending' || item.importStatus === 'rejected') continue;
            unresolved = true;
            record.rollbackError = { code: 'IMPORT_IDENTITY_UNCERTAIN', assetName: item.assetName };
            save(record);
            continue;
        }
        const assetPath = path.join(record.projectRoot, 'assets', 'resources', item.assetName);
        if (item.removalStatus === 'removed') continue;
        if (item.removalStatus === 'removing' && !fs.existsSync(assetPath) && !fs.existsSync(`${assetPath}.meta`)) {
            item.removalStatus = 'removed'; save(record); continue;
        }
        const identity = readImportedIdentity(record, item);
        if (!identity.success) {
            unresolved = true;
            record.rollbackError = { code: identity.code, assetName: item.assetName };
            save(record);
            continue;
        }
        item.removalStatus = 'removing'; save(record);
        const result = run({ targets: record.targets, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion,
            command: 'asset.removeImportedPng', input: { assetName: item.assetName, textureUuid: item.textureUuid,
                spriteFrameUuid: item.spriteFrameUuid, sha256: item.sha256 } });
        const removed = result.success && result.outcome === 'completed' && result.result?.removed === true
            && result.result.textureUuid === item.textureUuid && result.result.spriteFrameUuid === item.spriteFrameUuid
            && !fs.existsSync(assetPath) && !fs.existsSync(`${assetPath}.meta`);
        if (!removed) {
            if (!fs.existsSync(assetPath) && !fs.existsSync(`${assetPath}.meta`)
                && noSerializedReferences(record.projectRoot, [item.textureUuid, item.spriteFrameUuid])) {
                item.removalStatus = 'removed';
                item.removalEvidence = { kind: 'disk-readback-after-editor-delete', observedAt: new Date().toISOString() };
                save(record);
                continue;
            }
            unresolved = true;
            record.rollbackError = { code: 'ASSET_REMOVAL_UNVERIFIED', assetName: item.assetName, detail: result.error || null };
            save(record);
            continue;
        }
        item.removalStatus = 'removed'; save(record);
    }
    record.rollbackStatus = unresolved ? 'needs-review' : 'passed';
    record.state = unresolved ? 'needs-review' : record.error ? 'failed' : 'compensated';
    save(record);
    return publicRecord(record);
}
function sceneRefsSafe(record, sceneResult) {
    if (!record.sceneBatchId) return true;
    const child = sceneBatch.get({ projectRoot: record.projectRoot, creatorVersion: '2.4.15', batchId: record.sceneBatchId });
    if (child.outcome === 'failed' && (!child.items || child.items.every((item) => ['pending', 'rejected', 'compensated'].includes(item.status)))) return true;
    if (child.outcome === 'compensated' && child.items.every((item) => item.status === 'compensated' || ['pending', 'rejected'].includes(item.status))) return true;
    return Boolean(child.error?.code === 'BATCH_NOT_FOUND' && sceneResult && sceneResult.outcome === 'failed');
}
function contextStillMatches(record, run) {
    const snapshot = run({ targets: record.targets, projectRoot: record.projectRoot, creatorVersion: '2.4.15',
        command: 'scene.snapshot', input: {} });
    if (!snapshot.success || !sameInstance(snapshot.instance, { instanceId: record.instanceId,
        projectRoot: record.projectRoot, creatorVersion: '2.4.15', activeScene: record.sceneName })) return false;
    const context = sceneContext({ targets: record.targets, projectRoot: record.projectRoot }, run);
    return context.success && sameInstance(context.instance, snapshot.instance) && context.canvasUuid === record.canvasUuid;
}
function execute(params, run = dispatch, isCancelled = () => false) {
    if (!validTarget(params) || !Array.isArray(params.sources)) return fail('INVALID_ARGUMENT', 'Provide an exact Creator 2.4.15 target and source PNGs.');
    const pipelineId = params.pipelineId || crypto.randomUUID();
    if (!idPattern.test(pipelineId)) return fail('INVALID_PIPELINE_ID', 'Pipeline ID must be a UUID.');
    const projectRoot = path.resolve(params.projectRoot);
    let record;
    try { record = read(projectRoot, pipelineId); } catch (error) { if (error.code !== 'ENOENT') return fail('PIPELINE_READ_FAILED', error.message); }
    if (!record) {
        const checked = plan({ ...params, pipelineId }, run);
        if (!checked.success) return checked;
        record = { contractVersion: '0.1', pipelineId, assetBatchId: crypto.randomUUID(), sceneBatchId: crypto.randomUUID(),
            projectRoot, creatorVersion: '2.4.15', targets: params.targets, instanceId: checked.instance.instanceId,
            sceneName: checked.sceneName, canvasPath: checked.canvasPath, canvasUuid: checked.canvasUuid,
            state: 'executing', rollbackStatus: 'not-needed', error: null,
            items: checked.items.map((item) => ({ ...item, importStatus: 'pending', sceneStatus: 'pending', previewStatus: 'pending', removalStatus: 'pending' })),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        try { save(record, true); } catch (error) { return fail('PIPELINE_RECORD_FAILED', error.message); }
    } else if (record.projectRoot !== projectRoot || record.creatorVersion !== '2.4.15'
        || JSON.stringify(record.items.map((item) => item.sourcePath)) !== JSON.stringify(params.sources.map((source) => path.resolve(source)))
        || JSON.stringify(record.items.map((item) => item.position)) !== JSON.stringify(params.positions || params.sources.map(() => ({ x: 0, y: 0 })))) {
        return fail('PIPELINE_CONFLICT', 'Pipeline ID belongs to a different project, version, source list, or position set.');
    } else if (['needs-preview', 'completed', 'compensated', 'failed', 'needs-review'].includes(record.state)) return get({ projectRoot, creatorVersion: '2.4.15', pipelineId });

    if (record.state === 'compensating') return removeImported(record, run);
    const imports = assetBatch.execute({ targets: record.targets, projectRoot, creatorVersion: '2.4.15',
        batchId: record.assetBatchId, sources: record.items.map((item) => item.sourcePath) }, run);
    const allImported = childAssets(record, imports);
    save(record);
    if (!allImported) {
        record.error = { code: imports.error?.code || (imports.outcome === 'needs-review' ? 'IMPORT_OUTCOME_UNCERTAIN' : 'IMPORT_PIPELINE_FAILED'),
            detail: imports.error || null };
        const uncertain = imports.outcome === 'needs-review' || record.items.some((item) => item.importStatus !== 'imported'
            && !['pending', 'rejected'].includes(item.importStatus));
        if (uncertain) { record.state = 'needs-review'; record.rollbackStatus = 'blocked'; save(record); return publicRecord(record); }
        record.state = 'failed'; record.rollbackStatus = 'pending'; save(record);
        return removeImported(record, run);
    }
    if (!contextStillMatches(record, run)) {
        record.state = 'failed'; record.rollbackStatus = 'pending'; record.error = { code: 'EXECUTION_CONTEXT_CHANGED' }; save(record);
        return removeImported(record, run);
    }
    const scene = sceneBatch.execute({ targets: record.targets, projectRoot, creatorVersion: '2.4.15', batchId: record.sceneBatchId,
        assets: record.items.map((item) => item.assetName), positions: record.items.map((item) => item.position) }, run);
    if (scene.items) for (const child of scene.items) {
        const item = record.items.find((candidate) => candidate.assetName === child.assetName);
        if (item) { item.operationId = child.operationId; item.sceneStatus = child.status; item.previewStatus = child.phases?.preview === 'passed' ? 'passed' : 'pending'; }
    }
    if ((scene.success || scene.outcome === 'needs-preview') && ['needs-preview', 'completed'].includes(scene.outcome) && isCancelled()) {
        const reverted = sceneBatch.compensate({ projectRoot, creatorVersion: '2.4.15', batchId: record.sceneBatchId }, run);
        if (!sceneRefsSafe(record, reverted)) {
            record.state = 'needs-review'; record.rollbackStatus = 'blocked';
            record.error = { code: 'CANCELLATION_COMPENSATION_UNVERIFIED', detail: reverted.error || null };
            save(record); return publicRecord(record);
        }
        if (Array.isArray(reverted.items)) for (const child of reverted.items) {
            const item = record.items.find((candidate) => candidate.assetName === child.assetName);
            if (item) { item.operationId = child.operationId; item.sceneStatus = child.status;
                item.previewStatus = child.status === 'compensated' ? 'skipped' : item.previewStatus; }
        }
        record.state = 'failed'; record.rollbackStatus = 'pending'; record.error = { code: 'EXECUTION_CANCELLED' };
        save(record); return removeImported(record, run);
    }
    if ((scene.success || scene.outcome === 'needs-preview') && ['needs-preview', 'completed'].includes(scene.outcome)) {
        record.state = scene.outcome === 'completed' ? 'completed' : 'needs-preview'; save(record); return publicRecord(record);
    }
    if (scene.outcome === 'failed' && sceneRefsSafe(record, scene)) {
        record.state = 'failed'; record.rollbackStatus = 'pending'; record.error = { code: isCancelled() ? 'EXECUTION_CANCELLED' : scene.error?.detail?.code || scene.error?.code || 'SCENE_PIPELINE_FAILED', detail: scene.error || null };
        save(record); return removeImported(record, run);
    }
    record.state = 'needs-review'; record.rollbackStatus = 'blocked';
    record.error = { code: 'SCENE_OUTCOME_UNCERTAIN', detail: scene.error || null }; save(record); return publicRecord(record);
}
function refreshPreviewState(record) {
    const scene = sceneBatch.get({ projectRoot: record.projectRoot, creatorVersion: '2.4.15', batchId: record.sceneBatchId });
    if (Array.isArray(scene.items)) for (const child of scene.items) {
        const item = record.items.find((candidate) => candidate.assetName === child.assetName);
        if (item) { item.operationId = child.operationId; item.sceneStatus = child.status;
            item.previewStatus = child.phases?.preview === 'passed' ? 'passed' : 'pending'; }
    }
    if (scene.outcome === 'completed' && record.items.every((item) => item.previewStatus === 'passed')) record.state = 'completed';
    save(record);
    return publicRecord(record);
}
function get(params) {
    if (!params || typeof params.projectRoot !== 'string' || !path.isAbsolute(params.projectRoot)
        || params.creatorVersion !== '2.4.15' || !idPattern.test(params.pipelineId || ''))
        return fail('INVALID_ARGUMENT', 'Project, Creator 2.4.15, and pipeline ID are required.');
    try {
        const projectRoot = path.resolve(params.projectRoot);
        const record = read(projectRoot, params.pipelineId);
        if (record.projectRoot !== projectRoot || record.creatorVersion !== params.creatorVersion) return fail('PIPELINE_TARGET_MISMATCH', 'Pipeline target differs.');
        if (['needs-preview', 'completed'].includes(record.state)) return refreshPreviewState(record);
        return publicRecord(record);
    } catch (error) { return fail(error.code === 'ENOENT' ? 'PIPELINE_NOT_FOUND' : 'PIPELINE_READ_FAILED', error.message); }
}
function acceptPreview(params, run = dispatch) {
    if (!params || typeof params.projectRoot !== 'string' || !path.isAbsolute(params.projectRoot)
        || params.creatorVersion !== '2.4.15' || !idPattern.test(params.pipelineId || '') || !idPattern.test(params.operationId || ''))
        return fail('INVALID_ARGUMENT', 'Project, Creator 2.4.15, pipeline ID, and scene operation ID are required.');
    const projectRoot = path.resolve(params.projectRoot);
    let record;
    try { record = read(projectRoot, params.pipelineId); } catch (error) { return fail(error.code === 'ENOENT' ? 'PIPELINE_NOT_FOUND' : 'PIPELINE_READ_FAILED', error.message); }
    if (record.creatorVersion !== '2.4.15' || record.projectRoot !== projectRoot) return fail('PIPELINE_TARGET_MISMATCH', 'Pipeline target differs.');
    const item = record.items.find((candidate) => candidate.operationId === params.operationId);
    if (!item || record.state !== 'needs-preview' && record.state !== 'completed') return fail('PREVIEW_NOT_PENDING', 'Operation does not belong to a pipeline awaiting preview.');
    const accepted = run({ projectRoot, creatorVersion: '2.4.15', previewAcceptId: params.operationId, evidence: params.evidence });
    if (!accepted.success) return accepted;
    return refreshPreviewState(record);
}
function compensate(params, run = dispatch) {
    if (!params || typeof params.projectRoot !== 'string' || !path.isAbsolute(params.projectRoot)
        || params.creatorVersion !== '2.4.15' || !idPattern.test(params.pipelineId || ''))
        return fail('INVALID_ARGUMENT', 'Project, Creator 2.4.15, and pipeline ID are required.');
    const projectRoot = path.resolve(params.projectRoot);
    let record;
    try { record = read(projectRoot, params.pipelineId); } catch (error) { return fail(error.code === 'ENOENT' ? 'PIPELINE_NOT_FOUND' : 'PIPELINE_READ_FAILED', error.message); }
    if (record.projectRoot !== projectRoot || record.creatorVersion !== '2.4.15') return fail('PIPELINE_TARGET_MISMATCH', 'Pipeline target differs.');
    if (record.state === 'compensated' || record.state === 'failed' && record.rollbackStatus === 'passed') return publicRecord(record);
    if (record.state === 'needs-review') {
        const reconciled = reconcileAbsentRemovals(record);
        return reconciled || fail('PIPELINE_NEEDS_REVIEW', 'Resolve uncertain scene or asset state before compensation.');
    }
    if (record.sceneBatchId) {
        const scene = sceneBatch.get({ projectRoot, creatorVersion: '2.4.15', batchId: record.sceneBatchId });
        if (scene.items && scene.items.some((item) => ['applied', 'applying', 'compensating'].includes(item.status))) {
            const reverted = sceneBatch.compensate({ projectRoot, creatorVersion: '2.4.15', batchId: record.sceneBatchId }, run);
            if (!sceneRefsSafe(record, reverted)) { record.state = 'needs-review'; record.rollbackStatus = 'blocked';
                record.error = { code: 'SCENE_COMPENSATION_UNVERIFIED', detail: reverted.error || null }; save(record); return publicRecord(record); }
        } else if (scene.items && !sceneRefsSafe(record, scene)) {
            return fail('SCENE_STATE_UNCERTAIN', 'Scene batch has unresolved writes; inspect before asset removal.');
        }
    }
    record.error = null; record.rollbackStatus = 'pending'; save(record);
    return removeImported(record, run);
}
function handle(method, params, run = dispatch, onProgress, isCancelled = () => false) {
    if (method === 'assets.scene.plan') return plan(params, run);
    if (method === 'assets.scene.execute') {
        const emitProgress = typeof onProgress === 'function' ? onProgress : () => {};
        let progress = 0;
        const trackedRun = (request) => {
            const command = request.command || (request.operationGetId ? 'operation.get'
                : request.operationReconcileId ? 'operation.reconcile' : request.previewAcceptId ? 'preview.accept' : 'host-check');
            const report = (state, outcome) => {
                try { emitProgress({ progress: ++progress, command, state, ...(outcome ? { outcome } : {}) }); }
                catch (_) { /* Progress delivery must never interrupt a scene/resource write. */ }
            };
            report('started');
            const isCleanup = request.command === 'asset.removeImportedPng'
                || request.command === 'scene.pngSprite' && request.input?.action === 'compensate';
            const writes = request.command === 'asset.importPng' || request.command === 'asset.refreshPng'
                || request.command === 'scene.pngSprite' && ['apply', 'replay'].includes(request.input?.action);
            if (writes && !isCleanup && isCancelled()) {
                report('finished', 'cancelled');
                return { success: false, outcome: 'failed', error: { code: 'EXECUTION_CANCELLED',
                    message: 'The resource-to-scene operation was cancelled at a write boundary.',
                    phase: 'execution', retryable: false, sideEffect: 'none' } };
            }
            const result = run(request);
            report('finished', typeof result?.outcome === 'string' ? result.outcome : result?.success === true ? 'completed' : 'failed');
            return result;
        };
        return execute(params, trackedRun, isCancelled);
    }
    if (method === 'assets.scene.get') return get(params);
    if (method === 'assets.scene.preview.accept') return acceptPreview(params, run);
    if (method === 'assets.scene.compensate') return compensate(params, run);
    return fail('METHOD_NOT_FOUND', 'Unknown resource-to-scene pipeline method.');
}

if (require.main === module) {
    const argv = process.argv.slice(2);
    const value = (flag) => { const index = argv.indexOf(flag); return index < 0 ? undefined : argv[index + 1]; };
    let params;
    try { params = JSON.parse(value('--params') || '{}'); } catch (_) { params = null; }
    const result = handle(value('--method'), params);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.success ? 0 : 1;
}

module.exports = { handle, plan, execute, get, acceptPreview, compensate, readImportedIdentity };
