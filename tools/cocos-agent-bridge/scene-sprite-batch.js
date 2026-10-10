'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { dispatch } = require('./agent-dispatch');
const operationStore = require('./operation-store');
const operationReconcile = require('./operation-reconcile');

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidPattern = idPattern;
const nodeIdPattern = /^[A-Za-z0-9+/_-]{16,64}$/;
const assetPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/;
const fail = (code, message) => ({ success: false, outcome: 'failed', error: { code, message } });
function validPosition(position) {
    return position && typeof position === 'object' && !Array.isArray(position)
        && Object.keys(position).length === 2 && Number.isFinite(position.x) && Number.isFinite(position.y)
        && Math.abs(position.x) <= 4096 && Math.abs(position.y) <= 4096;
}
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
    if (params.positions !== undefined && (!Array.isArray(params.positions) || params.positions.length !== params.assets.length
        || params.positions.some((position) => !validPosition(position))))
        return fail('INVALID_POSITIONS', 'Provide one finite Canvas-local x/y position per asset, within ±4096 design pixels.');
    const items = [];
    const names = new Set();
    const nodeNames = new Set();
    for (const [index, assetName] of params.assets.entries()) {
        const key = typeof assetName === 'string' ? assetName.toLowerCase() : '';
        if (names.has(key)) return fail('DUPLICATE_ASSET', `Repeated asset: ${String(assetName)}`);
        names.add(key);
        const asset = readAsset(path.resolve(params.projectRoot), assetName);
        if (!asset.success) return fail(asset.code, `Cannot use ${String(assetName)} as an imported 2.4 SpriteFrame.`);
        if (nodeNames.has(asset.nodeName)) return fail('NODE_NAME_COLLISION', `Assets map to the same scene node: ${asset.nodeName}`);
        nodeNames.add(asset.nodeName);
        items.push({ ...asset, position: params.positions ? { ...params.positions[index] } : { x: 0, y: 0 } });
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
function operationRecordMissing(projectRoot, operationId) {
    const root = path.join(projectRoot, '.cocos-agent');
    const directory = path.join(root, 'operations');
    for (const filename of [root, directory]) {
        let stat;
        try { stat = fs.lstatSync(filename); } catch (error) { return error.code === 'ENOENT'; }
        if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
    }
    try { fs.lstatSync(path.join(directory, `${operationId}.json`)); return false; }
    catch (error) { return error.code === 'ENOENT'; }
}
function reconcileNoEffect(record, item, action, operationId, run) {
    const asset = readAsset(record.projectRoot, item.assetName);
    if (!asset.success || asset.assetUuid !== item.assetUuid || asset.sha256 !== item.sha256) return false;
    if (!contextStillMatches(record, run)) return false;
    const nodePath = `${record.canvasPath}/${item.nodeName}`;
    const target = inspect({ targets: record.targets, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion }, nodePath, run);
    if (!target.success || !sameInstance(target.instance, { instanceId: record.instanceId,
        projectRoot: record.projectRoot, creatorVersion: record.creatorVersion, activeScene: record.sceneName })
        || target.result?.sceneName !== record.sceneName || target.result?.node?.status !== 'not-found'
        || target.result.node.path !== nodePath) return false;
    const disk = operationReconcile.diskAbsence(record.projectRoot, record.creatorVersion, {
        sceneName: record.sceneName,
        manifest: { parentPath: record.canvasPath, parentUuid: record.canvasUuid, nodeName: item.nodeName },
    });
    if (!disk) return false;
    const observedAt = new Date().toISOString();
    item.reconciliations ||= [];
    item.reconciliations.push({ disposition: 'no-effect', action, operationId, nodePath,
        diskPath: path.relative(record.projectRoot, disk.filename).split(path.sep).join('/'),
        diskSha256: disk.sha256, observedAt });
    item.status = action === 'apply' ? 'rejected' : 'compensated';
    if (action === 'apply') {
        record.state = 'needs-review';
        record.error = { code: 'WRITE_RECONCILED_NO_EFFECT', assetName: item.assetName, operationId };
    }
    save(record);
    return true;
}
function serializedSpriteReferenceMatches(record, item, expectedNodeUuid) {
    const root = path.join(record.projectRoot, 'assets');
    const candidates = [];
    let seen = 0;
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
                if (++seen > 20000) { unsafe = true; return; }
                if (entry.name === `${record.sceneName}.fire`) candidates.push(filename);
            }
            if (unsafe) return;
        }
    }
    visit(root, 0);
    if (unsafe || candidates.length !== 1) return false;
    let objects;
    try {
        if (fs.statSync(candidates[0]).size > 20 * 1024 * 1024) return false;
        objects = JSON.parse(fs.readFileSync(candidates[0], 'utf8'));
    } catch (_) { return false; }
    if (!Array.isArray(objects)) return false;
    const canvases = objects.flatMap((node, index) => node && node.__type__ === 'cc.Node' && node._name === 'Canvas'
        && node._id === record.canvasUuid ? [index] : []);
    if (canvases.length !== 1) return false;
    const canvasIndex = canvases[0];
    const nodes = objects.flatMap((node, index) => node && node.__type__ === 'cc.Node' && node._name === item.nodeName
        && node._parent?.__id__ === canvasIndex ? [{ node, index }] : []);
    if (nodes.length !== 1) return false;
    const { node, index } = nodes[0];
    if (node._id !== expectedNodeUuid || node._active !== true || node._children?.length !== 0
        || !Array.isArray(node._components) || node._components.length !== 1
        || !Array.isArray(objects[canvasIndex]._children)
        || !objects[canvasIndex]._children.some((reference) => reference && reference.__id__ === index)) return false;
    const spriteComponents = node._components.flatMap((reference) => {
        const component = reference && Number.isInteger(reference.__id__) ? objects[reference.__id__] : null;
        return component && component.__type__ === 'cc.Sprite' && component.node?.__id__ === index
            ? [component] : [];
    });
    const transform = node._trs?.array;
    const position = item.position || { x: 0, y: 0 };
    return spriteComponents.length === 1 && spriteComponents[0]._enabled === true
        && spriteComponents[0]._spriteFrame?.__uuid__ === item.assetUuid
        && Array.isArray(transform) && transform.length === 10
        && Math.abs(transform[0] - position.x) <= 1e-6 && Math.abs(transform[1] - position.y) <= 1e-6
        && Math.abs(transform[2]) <= 1e-6 && Math.abs(transform[3]) <= 1e-6
        && Math.abs(transform[4]) <= 1e-6 && Math.abs(transform[5]) <= 1e-6
        && Math.abs(transform[6] - 1) <= 1e-6 && Math.abs(transform[7] - 1) <= 1e-6
        && Math.abs(transform[8] - 1) <= 1e-6 && Math.abs(transform[9] - 1) <= 1e-6;
}
function failedCompensationPreflightMatches(record, item, operationId, operation, run) {
    const phases = operation && operation.phases;
    const manifest = operation && operation.manifest;
    const preflightFailure = operation && [...(operation.receipts || [])].reverse()
        .find((receipt) => receipt.phase === 'preflight' && receipt.status === 'failed');
    if (!operation || operation.operationId !== operationId || operation.projectRoot !== record.projectRoot
        || operation.creatorVersion !== record.creatorVersion || operation.sceneName !== record.sceneName
        || operation.intent !== 'created' || manifest?.sceneAction !== 'compensate'
        || manifest.assetName !== item.assetName || manifest.nodeName !== item.nodeName || manifest.assetUuid !== item.assetUuid
        || !phases || phases.capability !== 'passed' || phases.preflight !== 'failed' || phases.editor !== 'pending'
        || phases.disk !== 'pending' || phases.preview !== 'pending' || phases.recovery !== 'pending'
        || preflightFailure?.error?.sideEffect !== 'none') return false;
    const original = operationState(record.projectRoot, item.operationId);
    if (!original || original.projectRoot !== record.projectRoot || original.creatorVersion !== record.creatorVersion
        || original.manifest?.sceneAction !== 'apply' || original.manifest.assetName !== item.assetName
        || original.manifest.nodeName !== item.nodeName || original.manifest.assetUuid !== item.assetUuid
        || original.phases?.disk !== 'passed') return false;
    const asset = readAsset(record.projectRoot, item.assetName);
    const context = inspectContext({ targets: record.targets, projectRoot: record.projectRoot,
        creatorVersion: record.creatorVersion }, run);
    if (!asset.success || asset.assetUuid !== item.assetUuid || asset.sha256 !== item.sha256
        || !context.success || context.sceneName !== record.sceneName || context.canvasPath !== record.canvasPath
        || context.canvasUuid !== record.canvasUuid || context.instance.projectRoot !== record.projectRoot
        || context.instance.creatorVersion !== record.creatorVersion || context.instance.activeScene !== record.sceneName) return false;
    const nodePath = `${record.canvasPath}/${item.nodeName}`;
    const inspected = inspect({ targets: record.targets, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion }, nodePath, run);
    const node = inspected?.result?.node;
    const sprite = node?.componentDetails?.find((component) => component.classId === 'cc.Sprite');
    const position = item.position || { x: 0, y: 0 };
    if (!inspected.success || !sameInstance(inspected.instance, context.instance)
        || inspected.result?.sceneName !== record.sceneName || node?.status !== 'found' || node.path !== nodePath
        || node.name !== item.nodeName || node.childCount !== 0 || node.components?.length !== 1
        || !sprite || sprite.enabled !== true || sprite.spriteFrameUuid !== item.assetUuid
        || Math.abs((node.transform?.position?.x ?? Infinity) - position.x) > 1e-6
        || Math.abs((node.transform?.position?.y ?? Infinity) - position.y) > 1e-6
        || Math.abs((node.transform?.scale?.x ?? Infinity) - 1) > 1e-6
        || Math.abs((node.transform?.scale?.y ?? Infinity) - 1) > 1e-6
        || !node.uuid || !nodeIdPattern.test(node.uuid)) return false;
    if (!serializedSpriteReferenceMatches(record, item, node.uuid)) return false;
    return { instance: context.instance, nodeUuid: node.uuid, spriteFrameUuid: sprite.spriteFrameUuid,
        assetSha256: asset.sha256 };
}
function preWriteOperationMatches(record, item, operationId, operation) {
    const manifest = operation && operation.manifest;
    const phases = operation && operation.phases;
    const position = item.position || { x: 0, y: 0 };
    return operation && operation.projectRoot === record.projectRoot && operation.creatorVersion === record.creatorVersion
        && operation.operationId === operationId
        && (operation.capabilityId === undefined || operation.capabilityId === 'scene.pngSprite')
        && operation.sceneName === null && operation.intent === 'created' && !operation.createdNodeUuid && !operation.reconciliation
        && Array.isArray(operation.receipts) && operation.receipts.length === 0
        && phases && ['capability', 'preflight', 'editor', 'disk', 'preview', 'recovery'].every((phase) => phases[phase] === 'pending')
        && manifest && manifest.sceneAction === 'apply' && manifest.assetName === item.assetName
        && manifest.nodeName === item.nodeName && manifest.assetUuid === item.assetUuid
        && JSON.stringify(manifest.position || { x: 0, y: 0 }) === JSON.stringify(position);
}
function reconcileMissingOperation(record, item, action, operationId, run) {
    if (!operationRecordMissing(record.projectRoot, operationId)) return false;
    return reconcileNoEffect(record, item, action, operationId, run);
}
function publicRecord(record) {
    const items = record.items.map((item) => {
        const operation = operationState(record.projectRoot, item.operationId);
        const compensation = item.compensationOperationId
            ? operationState(record.projectRoot, item.compensationOperationId) : null;
        return { assetName: item.assetName, nodeName: item.nodeName, assetUuid: item.assetUuid, position: item.position || { x: 0, y: 0 },
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
        if (operationRecordMissing(record.projectRoot, operationId)) {
            if (reconcileMissingOperation(record, item, expectedAction, operationId, run)) continue;
            record.state = 'needs-review'; record.error = { code: 'ITEM_OUTCOME_UNCERTAIN', assetName: item.assetName, operationId };
            save(record); return false;
        }
        const pendingOperation = operationState(record.projectRoot, operationId);
        const restartRecovery = expectedAction === 'compensate'
            ? failedCompensationPreflightMatches(record, item, operationId, pendingOperation, run) : false;
        if (restartRecovery) {
            item.reconciliations ||= [];
            const priorInstanceId = record.instanceId;
            const instanceChanged = priorInstanceId !== restartRecovery.instance.instanceId;
            item.reconciliations.push({ disposition: instanceChanged ? 'verified-restart-context' : 'no-effect',
                action: 'compensate', operationId, observedAt: new Date().toISOString(),
                ...(instanceChanged ? { priorInstanceId, currentInstanceId: restartRecovery.instance.instanceId,
                    sceneName: record.sceneName, canvasUuid: record.canvasUuid,
                    nodeUuid: restartRecovery.nodeUuid, spriteFrameUuid: restartRecovery.spriteFrameUuid,
                    assetSha256: restartRecovery.assetSha256,
                    evidence: 'failed preflight sideEffect=none; stable project/version/scene/Canvas plus live and serialized node/resource identity matched after Creator restart' }
                    : { evidence: 'failed preflight sideEffect=none; original apply, live SpriteFrame, and serialized scene identity matched' }) });
            if (instanceChanged) record.instanceId = restartRecovery.instance.instanceId;
            item.status = 'applied';
            item.compensationOperationId = null;
            save(record);
            continue;
        }
        if (expectedAction === 'apply' && preWriteOperationMatches(record, item, operationId, pendingOperation)) {
            if (reconcileNoEffect(record, item, expectedAction, operationId, run)) continue;
            record.state = 'needs-review'; record.error = { code: 'ITEM_OUTCOME_UNCERTAIN', assetName: item.assetName, operationId };
            save(record); return false;
        }
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
        || JSON.stringify(record.items.map((item) => item.assetName)) !== JSON.stringify(params.assets)
        || JSON.stringify(record.items.map((item) => item.position || { x: 0, y: 0 }))
            !== JSON.stringify(params.positions || params.assets.map(() => ({ x: 0, y: 0 })))) {
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
            command: 'scene.pngSprite', input: { assetName: item.assetName, action: 'apply', operationId: item.operationId, position: item.position } });
        if (result.success && ['completed', 'needs-preview'].includes(result.outcome) && result.phases?.disk === 'passed'
            && result.instance?.instanceId === record.instanceId && result.instance?.activeScene === record.sceneName
            && result.result?.assetUuid === item.assetUuid && result.result?.nodeName === item.nodeName
            && validPosition(result.result?.position)
            && result.result.position.x === item.position.x && result.result.position.y === item.position.y) {
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
    if (!['executing', 'needs-preview', 'completed', 'compensating', 'needs-review'].includes(record.state))
        return fail('BATCH_NOT_COMPENSABLE', 'Resolve uncertain item operations before compensation.');
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
    return execute({ ...params, targets: source.targets, assets: source.items.map((item) => item.assetName),
        positions: source.items.map((item) => item.position || { x: 0, y: 0 }), replayedFrom: source.batchId }, run);
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
