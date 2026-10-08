'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { dispatch } = require('./agent-dispatch');
const operationStore = require('./operation-store');

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidPattern = idPattern;
const nodeIdPattern = /^[A-Za-z0-9_-]{16,64}$/;
const assetPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/;
const fail = (code, message) => ({ success: false, outcome: 'failed', error: { code, message } });
function file(projectRoot, batchId) { return path.join(projectRoot, '.cocos-agent', 'scene-batches', `${batchId}.json`); }
function save(record, create = false) {
    const filename = file(record.projectRoot, record.batchId);
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    record.updatedAt = new Date().toISOString();
    if (create) return fs.writeFileSync(filename, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 });
    const temporary = `${filename}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try { fs.writeFileSync(temporary, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 }); fs.renameSync(temporary, filename); }
    finally { try { fs.unlinkSync(temporary); } catch (_) { /* consumed by rename */ } }
}
function read(projectRoot, batchId) { return JSON.parse(fs.readFileSync(file(projectRoot, batchId), 'utf8')); }
function targetValid(params) {
    return params && typeof params.projectRoot === 'string' && path.isAbsolute(params.projectRoot)
        && path.resolve(params.projectRoot) && params.creatorVersion === '2.4.15'
        && Array.isArray(params.targets) && params.targets.length > 0
        && params.targets.every((target) => target && typeof target.projectRoot === 'string'
            && path.isAbsolute(target.projectRoot) && ['2.4.15', '3.8.7'].includes(target.creatorVersion))
        && params.targets.filter((target) => path.resolve(target.projectRoot) === path.resolve(params.projectRoot)
            && target.creatorVersion === params.creatorVersion).length === 1;
}
function nodeName(assetName) {
    return `CocosAgentAsset_${path.basename(assetName, '.png').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 16)}`;
}
function readAsset(projectRoot, assetName) {
    if (typeof assetName !== 'string' || !assetPattern.test(assetName)) return { success: false, code: 'INVALID_ASSET_NAME' };
    const filename = path.join(projectRoot, 'assets', 'resources', assetName);
    let data; let meta;
    try {
        if (!fs.lstatSync(filename).isFile() || !fs.lstatSync(`${filename}.meta`).isFile()) throw Error('not a regular imported asset');
        data = fs.readFileSync(filename);
        meta = JSON.parse(fs.readFileSync(`${filename}.meta`, 'utf8'));
    } catch (_) { return { success: false, code: 'ASSET_NOT_IMPORTED' }; }
    const frames = Object.values(meta.subMetas || {}).filter((item) => item && item.importer === 'sprite-frame');
    if (meta.importer !== 'texture' || !uuidPattern.test(meta.uuid || '') || frames.length !== 1
        || !uuidPattern.test(frames[0].uuid || '') || frames[0].rawTextureUuid !== meta.uuid)
        return { success: false, code: 'SPRITE_FRAME_METADATA_INVALID' };
    return { success: true, assetName, nodeName: nodeName(assetName), textureUuid: meta.uuid,
        assetUuid: frames[0].uuid, sha256: crypto.createHash('sha256').update(data).digest('hex') };
}
function request(params) {
    return { targets: params.targets, projectRoot: path.resolve(params.projectRoot), creatorVersion: params.creatorVersion };
}
function sameInstance(a, b) {
    return Boolean(a && b && a.instanceId === b.instanceId && a.projectRoot === b.projectRoot
        && a.creatorVersion === b.creatorVersion && a.activeScene === b.activeScene);
}
function inspect(params, nodePath, run) {
    return run({ ...request(params), command: 'scene.node.inspect', input: { nodePath } });
}
function inspectContext(params, run) {
    const snapshot = run({ ...request(params), command: 'scene.snapshot', input: {} });
    if (!snapshot.success || !snapshot.instance || !snapshot.result || typeof snapshot.result.sceneName !== 'string'
        || !snapshot.result.sceneName) return { success: false, error: { code: 'SCENE_UNAVAILABLE' } };
    const canvasPath = `${snapshot.result.sceneName}/Canvas`;
    const canvas = inspect(params, canvasPath, run);
    if (!canvas.success || !canvas.instance || !sameInstance(snapshot.instance, canvas.instance)
        || !canvas.result || !canvas.result.node || canvas.result.node.status !== 'found'
        || !nodeIdPattern.test(canvas.result.node.uuid || '')) return { success: false, error: { code: 'CANVAS_NOT_FOUND' } };
    return { success: true, instance: snapshot.instance, sceneName: snapshot.result.sceneName,
        canvasPath, canvasUuid: canvas.result.node.uuid };
}
function plan(params, run = dispatch) {
    if (!targetValid(params) || !Array.isArray(params.assets) || params.assets.length < 2 || params.assets.length > 16)
        return fail('INVALID_SCENE_BATCH', 'Provide one exact Creator 2.4.15 project and 2–16 imported PNG names.');
    const items = [];
    const names = new Set();
    const nodeNames = new Set();
    for (const assetName of params.assets) {
        const key = typeof assetName === 'string' ? assetName.toLowerCase() : '';
        if (names.has(key)) return fail('DUPLICATE_ASSET', `Repeated asset: ${String(assetName)}`);
        names.add(key);
        const asset = readAsset(path.resolve(params.projectRoot), assetName);
        if (!asset.success) return fail(asset.code, `Cannot use ${String(assetName)} as an imported 2.4 SpriteFrame.`);
        if (nodeNames.has(asset.nodeName)) return fail('NODE_NAME_COLLISION', `Assets map to the same scene node: ${asset.nodeName}`);
        nodeNames.add(asset.nodeName);
        items.push(asset);
    }
    const context = inspectContext(params, run);
    if (!context.success) return fail(context.error.code, 'The active 2.4 scene must contain one inspectable Canvas.');
    for (const item of items) {
        const target = inspect(params, `${context.sceneName}/Canvas/${item.nodeName}`, run);
        if (!target.success || !sameInstance(context.instance, target.instance) || !target.result || !target.result.node
            || target.result.node.status !== 'not-found') return fail('SCENE_NODE_CONFLICT', `Target node is present or cannot be checked: ${item.nodeName}`);
    }
    return { success: true, outcome: 'ready', projectRoot: path.resolve(params.projectRoot), creatorVersion: params.creatorVersion,
        instance: context.instance, sceneName: context.sceneName, canvasPath: context.canvasPath,
        canvasUuid: context.canvasUuid, items };
}
function operationState(projectRoot, operationId) {
    try { return operationStore.read(projectRoot, operationId); } catch (_) { return null; }
}
function publicRecord(record) {
    const items = record.items.map((item) => {
        const operation = operationState(record.projectRoot, item.operationId);
        const compensation = item.compensationOperationId
            ? operationState(record.projectRoot, item.compensationOperationId) : null;
        return { assetName: item.assetName, nodeName: item.nodeName, assetUuid: item.assetUuid,
            status: item.status, operationId: item.operationId, compensationOperationId: item.compensationOperationId,
            phases: operation && operation.phases || null,
            compensationPhases: compensation && compensation.phases || null };
    });
    const previewsPassed = record.items.every((item) => item.status === 'applied'
        && operationState(record.projectRoot, item.operationId)?.phases?.preview === 'passed');
    const outcome = record.state === 'needs-preview' && previewsPassed ? 'completed' : record.state;
    return { success: ['completed', 'compensated'].includes(outcome), outcome, batchId: record.batchId,
        projectRoot: record.projectRoot, creatorVersion: record.creatorVersion, sceneName: record.sceneName,
        instanceId: record.instanceId, canvasUuid: record.canvasUuid, items, error: record.error || null,
        replayedFrom: record.replayedFrom || null };
}
function reconcile(record, run) {
    for (const item of record.items) {
        if (!['applying', 'compensating'].includes(item.status)) continue;
        const operationId = item.status === 'applying' ? item.operationId : item.compensationOperationId;
        const expectedAction = item.status === 'applying' ? 'apply' : 'compensate';
        const result = run({ projectRoot: record.projectRoot, creatorVersion: record.creatorVersion, operationGetId: operationId });
        if (!result.success || result.phases?.disk !== 'passed' || result.result?.sceneName !== record.sceneName
            || result.result?.assetUuid !== item.assetUuid || result.result?.action !== expectedAction) {
            record.state = 'needs-review'; record.error = { code: 'ITEM_OUTCOME_UNCERTAIN', assetName: item.assetName, operationId };
            save(record); return false;
        }
        item.status = expectedAction === 'apply' ? 'applied' : 'compensated';
        save(record);
    }
    return true;
}
function contextStillMatches(record, run) {
    const snapshot = run({ targets: record.targets, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion,
        command: 'scene.snapshot', input: {} });
    if (!snapshot.success || !sameInstance(snapshot.instance, { instanceId: record.instanceId,
        projectRoot: record.projectRoot, creatorVersion: record.creatorVersion, activeScene: record.sceneName })) return false;
    const canvas = inspect({ targets: record.targets, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion },
        record.canvasPath, run);
    return canvas.success && sameInstance(canvas.instance, snapshot.instance) && canvas.result?.node?.status === 'found'
        && canvas.result.node.uuid === record.canvasUuid;
}
function compensateRecord(record, run) {
    record.state = 'compensating'; save(record);
    for (const item of [...record.items].reverse()) {
        if (item.status === 'compensated' || item.status === 'pending' || item.status === 'rejected') continue;
        if (item.status !== 'applied') { record.state = 'needs-review'; record.error = { code: 'ITEM_OUTCOME_UNCERTAIN', assetName: item.assetName }; save(record); return publicRecord(record); }
        item.compensationOperationId ||= crypto.randomUUID(); item.status = 'compensating'; save(record);
        const result = run({ targets: record.targets, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion,
            command: 'scene.pngSprite', input: { assetName: item.assetName, action: 'compensate', operationId: item.compensationOperationId } });
        if (!result.success || result.outcome !== 'completed' || result.phases?.disk !== 'passed'
            || result.instance?.instanceId !== record.instanceId || result.instance?.activeScene !== record.sceneName
            || result.result?.assetUuid !== item.assetUuid || result.result?.action !== 'compensate') {
            record.state = 'needs-review'; record.error = { code: 'COMPENSATION_UNCERTAIN', assetName: item.assetName,
                operationId: item.compensationOperationId, detail: result.error || null }; save(record); return publicRecord(record);
        }
        item.status = 'compensated'; save(record);
    }
    record.state = record.error ? 'failed' : 'compensated'; save(record);
    return publicRecord(record);
}
function execute(params, run = dispatch) {
    if (!targetValid(params) || !Array.isArray(params.assets)) return fail('INVALID_ARGUMENT', 'Provide an exact Creator 2.4.15 target and imported asset names.');
    const batchId = params.batchId || crypto.randomUUID();
    if (!idPattern.test(batchId)) return fail('INVALID_BATCH_ID', 'Batch ID must be a UUID.');
    let record;
    try { record = read(path.resolve(params.projectRoot), batchId); }
    catch (error) { if (error.code !== 'ENOENT') return fail('BATCH_READ_FAILED', error.message); }
    if (!record) {
        const checked = plan(params, run);
        if (!checked.success) return checked;
        record = { contractVersion: '0.1', batchId, projectRoot: checked.projectRoot, creatorVersion: checked.creatorVersion,
            targets: params.targets, sceneName: checked.sceneName, instanceId: checked.instance.instanceId,
            canvasPath: checked.canvasPath, canvasUuid: checked.canvasUuid, state: 'executing', error: null,
            replayedFrom: params.replayedFrom || null,
            items: checked.items.map((item) => ({ ...item, status: 'pending', operationId: crypto.randomUUID(), compensationOperationId: null })),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        try { save(record, true); } catch (error) { return fail('BATCH_RECORD_FAILED', error.message); }
    } else if (record.projectRoot !== path.resolve(params.projectRoot) || record.creatorVersion !== params.creatorVersion
        || JSON.stringify(record.items.map((item) => item.assetName)) !== JSON.stringify(params.assets)) {
        return fail('BATCH_CONFLICT', 'Batch ID belongs to another project, version, or asset list.');
    } else if (['needs-preview', 'completed', 'compensated', 'failed', 'needs-review'].includes(record.state)) return publicRecord(record);
    if (!reconcile(record, run)) return publicRecord(record);
    if (record.state === 'compensating') return compensateRecord(record, run);
    if (record.state === 'needs-review') return publicRecord(record);
    for (const item of record.items) {
        if (item.status === 'applied') continue;
        if (item.status !== 'pending') { record.state = 'needs-review'; record.error = { code: 'ITEM_STATE_INVALID', assetName: item.assetName }; save(record); return publicRecord(record); }
        const currentAsset = readAsset(record.projectRoot, item.assetName);
        if (!currentAsset.success || currentAsset.assetUuid !== item.assetUuid || currentAsset.sha256 !== item.sha256) {
            record.state = 'failed'; record.error = { code: 'ASSET_CHANGED', assetName: item.assetName }; save(record); return publicRecord(record);
        }
        if (!contextStillMatches(record, run)) {
            record.state = 'needs-review'; record.error = { code: 'EXECUTION_CONTEXT_CHANGED', assetName: item.assetName }; save(record); return publicRecord(record);
        }
        const existing = inspect({ targets: record.targets, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion },
            `${record.sceneName}/Canvas/${item.nodeName}`, run);
        if (!existing.success || !sameInstance(existing.instance, { instanceId: record.instanceId,
            projectRoot: record.projectRoot, creatorVersion: record.creatorVersion, activeScene: record.sceneName })
            || existing.result?.node?.status !== 'not-found') {
            item.status = 'rejected'; record.state = 'failed'; record.error = { code: 'SCENE_NODE_CONFLICT', assetName: item.assetName }; save(record);
            return compensateRecord(record, run);
        }
        item.status = 'applying'; save(record);
        const result = run({ targets: record.targets, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion,
            command: 'scene.pngSprite', input: { assetName: item.assetName, action: 'apply', operationId: item.operationId } });
        if (result.success && ['completed', 'needs-preview'].includes(result.outcome) && result.phases?.disk === 'passed'
            && result.instance?.instanceId === record.instanceId && result.instance?.activeScene === record.sceneName
            && result.result?.assetUuid === item.assetUuid && result.result?.nodeName === item.nodeName) {
            item.status = 'applied'; save(record); continue;
        }
        if (result.outcome === 'failed' && result.error?.sideEffect === 'none') {
            item.status = 'rejected'; record.error = { code: 'SCENE_ITEM_REJECTED', assetName: item.assetName, detail: result.error };
            save(record); return compensateRecord(record, run);
        }
        record.state = 'needs-review'; record.error = { code: 'SCENE_ITEM_OUTCOME_UNCERTAIN', assetName: item.assetName,
            operationId: item.operationId, detail: result.error || null }; save(record); return publicRecord(record);
    }
    record.state = 'needs-preview'; save(record); return publicRecord(record);
}
function get(params) {
    if (!params || typeof params.projectRoot !== 'string' || !path.isAbsolute(params.projectRoot)
        || params.creatorVersion !== '2.4.15' || !idPattern.test(params.batchId || '')) return fail('INVALID_ARGUMENT', 'Project, Creator 2.4.15, and batch ID are required.');
    try {
        const record = read(path.resolve(params.projectRoot), params.batchId);
        if (record.creatorVersion !== params.creatorVersion || record.projectRoot !== path.resolve(params.projectRoot)) return fail('BATCH_TARGET_MISMATCH', 'Batch target differs.');
        return publicRecord(record);
    } catch (error) { return fail(error.code === 'ENOENT' ? 'BATCH_NOT_FOUND' : 'BATCH_READ_FAILED', error.message); }
}
function compensate(params, run = dispatch) {
    if (!params || typeof params.projectRoot !== 'string' || !path.isAbsolute(params.projectRoot)
        || params.creatorVersion !== '2.4.15' || !idPattern.test(params.batchId || '')) return fail('INVALID_ARGUMENT', 'Project, Creator 2.4.15, and batch ID are required.');
    let record;
    try { record = read(path.resolve(params.projectRoot), params.batchId); }
    catch (error) { return fail(error.code === 'ENOENT' ? 'BATCH_NOT_FOUND' : 'BATCH_READ_FAILED', error.message); }
    if (record.projectRoot !== path.resolve(params.projectRoot) || record.creatorVersion !== params.creatorVersion) return fail('BATCH_TARGET_MISMATCH', 'Batch target differs.');
    if (['compensated', 'failed'].includes(record.state)) return publicRecord(record);
    if (!['needs-preview', 'completed', 'compensating'].includes(record.state)) return fail('BATCH_NOT_COMPENSABLE', 'Resolve uncertain item operations before compensation.');
    if (!reconcile(record, run)) return publicRecord(record);
    return compensateRecord(record, run);
}
function replay(params, run = dispatch) {
    if (!params || typeof params.projectRoot !== 'string' || !idPattern.test(params.sourceBatchId || '')) return fail('INVALID_ARGUMENT', 'Project and source batch ID are required.');
    let source;
    try { source = read(path.resolve(params.projectRoot), params.sourceBatchId); }
    catch (error) { return fail(error.code === 'ENOENT' ? 'SOURCE_BATCH_NOT_FOUND' : 'BATCH_READ_FAILED', error.message); }
    if (params.creatorVersion !== '2.4.15' || source.projectRoot !== path.resolve(params.projectRoot)
        || source.creatorVersion !== params.creatorVersion || !['compensated', 'failed'].includes(source.state)
        || source.items.some((item) => ['applied', 'applying', 'compensating'].includes(item.status)))
        return fail('SOURCE_BATCH_NOT_COMPENSATED', 'Replay requires a fully compensated 2.4 scene batch.');
    return execute({ ...params, targets: source.targets, assets: source.items.map((item) => item.assetName), replayedFrom: source.batchId }, run);
}
function handle(method, params, run = dispatch) {
    if (method === 'scene.sprites.plan') return plan(params, run);
    if (method === 'scene.sprites.execute') return execute(params, run);
    if (method === 'scene.sprites.get') return get(params);
    if (method === 'scene.sprites.compensate') return compensate(params, run);
    if (method === 'scene.sprites.replay') return replay(params, run);
    return fail('METHOD_NOT_FOUND', 'Unknown scene sprite batch method.');
}

module.exports = { handle, plan, execute, get, compensate, replay, readAsset, nodeName };
