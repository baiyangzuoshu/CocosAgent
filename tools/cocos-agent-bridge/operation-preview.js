'use strict';

const path = require('path');
const store = require('./operation-store');
const patchContract = require('./scene-patch-contract');

function failure(code, message) { return { success: false, error: { code, message } }; }

function sceneObject(record) { return record && record.capabilityId === 'scene.node.create'; }
function hasPreviewTarget(record) {
    if (record && record.capabilityId === 'scene.node.patch') return ['apply', 'replay'].includes(record.manifest.action);
    return sceneObject(record) ? ((record.manifest.components || []).length > 0 || !!record.manifest.prefabMode)
        && ['apply', 'replay'].includes(record.manifest.action)
        : record && record.manifest && ['apply', 'replay'].includes(record.manifest.sceneAction);
}

function acceptPreview({ projectRoot, creatorVersion, operationId, evidence }) {
    if (typeof projectRoot !== 'string' || !['2.4.15', '3.8.7'].includes(creatorVersion)
        || typeof operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) {
        return failure('INVALID_ARGUMENT', 'Project, Creator version, and operation ID are required.');
    }
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
        || typeof evidence.url !== 'string' || typeof evidence.note !== 'string'
        || !evidence.note.trim() || evidence.note.length > 500
        || typeof evidence.observedAt !== 'string' || !Number.isFinite(Date.parse(evidence.observedAt))) {
        return failure('INVALID_PREVIEW_EVIDENCE', 'A loopback preview URL, observation time, and note are required.');
    }
    let url;
    try { url = new URL(evidence.url); } catch (_) { return failure('INVALID_PREVIEW_EVIDENCE', 'Invalid preview URL.'); }
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        || evidence.url.length > 256) return failure('INVALID_PREVIEW_EVIDENCE', 'Preview URL must be local HTTP.');
    const project = path.resolve(projectRoot);
    let record;
    try { record = store.read(project, operationId); }
    catch (error) { return failure(error.code === 'ENOENT' ? 'OPERATION_NOT_FOUND' : 'OPERATION_READ_FAILED', 'Cannot read operation record.'); }
    if (record.projectRoot !== project || record.creatorVersion !== creatorVersion || record.operationId !== operationId) {
        return failure('OPERATION_TARGET_MISMATCH', 'Operation record does not match the requested target.');
    }
    const observationTime = Date.parse(evidence.observedAt);
    if (observationTime < Date.parse(record.createdAt) || observationTime > Date.now() + 60000) {
        return failure('INVALID_PREVIEW_EVIDENCE', 'Observation time must follow operation creation and cannot be in the future.');
    }
    if (!record.manifest || !record.phases || !record.sceneName) return failure('OPERATION_RECORD_INVALID', 'Operation record is incomplete.');
    if (!hasPreviewTarget(record)) return failure('PREVIEW_NOT_APPLICABLE', 'This operation has no visible scene object to preview.');
    if (record.phases.disk !== 'passed') return failure('DISK_NOT_VERIFIED', 'Preview cannot pass before disk readback.');
    const visualEvidence = { kind: 'visual-preview', source: 'Agent visual inspection in local Web preview',
        sceneName: record.sceneName, nodeName: previewNodeName(record), assetUuid: record.manifest.assetUuid || firstSpriteUuid(record),
        nodeUuid: record.createdNodeUuid || record.manifest.targetNodeUuid || undefined, previewUrl: evidence.url,
        observedAt: new Date(evidence.observedAt).toISOString(), note: evidence.note.trim() };
    if (record.phases.preview === 'passed') {
        const previous = record.receipts.find((item) => item.phase === 'preview' && item.status === 'passed');
        if (!previous || !Array.isArray(previous.evidence)) return failure('OPERATION_RECORD_INVALID', 'Preview receipt is incomplete.');
        const duplicate = previous.evidence.some((item) => item.kind === 'visual-preview'
            && item.previewUrl === visualEvidence.previewUrl && item.observedAt === visualEvidence.observedAt
            && item.note === visualEvidence.note);
        if (duplicate) return { success: true, data: record, alreadyAccepted: true };
        if (previous.evidence.length >= 8) return failure('PREVIEW_EVIDENCE_LIMIT', 'Preview receipt already has the maximum evidence count.');
        previous.evidence.push(visualEvidence);
        record.updatedAt = new Date().toISOString();
        try { store.write(project, record); } catch (_) { return failure('OPERATION_WRITE_FAILED', 'Cannot persist preview receipt.'); }
        return { success: true, data: record, alreadyAccepted: false, appended: true };
    }
    if (record.phases.preview !== 'pending') return failure('PREVIEW_STATE_CONFLICT', 'Preview is not pending.');
    const receipt = { contractVersion: '0.1', operationId, capabilityId: record.capabilityId || 'scene.pngSprite', creatorVersion,
        phase: 'preview', status: 'passed', evidence: [visualEvidence] };
    record.receipts.push(receipt);
    record.phases.preview = 'passed';
    record.updatedAt = new Date().toISOString();
    try { store.write(project, record); } catch (_) { return failure('OPERATION_WRITE_FAILED', 'Cannot persist preview receipt.'); }
    return { success: true, data: record, alreadyAccepted: false };
}

function firstSpriteUuid(record) {
    const patch = record && record.capabilityId === 'scene.node.patch' && record.manifest.expectedDiff
        .find((item) => item.path === 'component.cc.Sprite.spriteFrameUuid');
    if (patch) return patch.after;
    const sprite = record && record.manifest && (record.previewComponents || record.manifest.components || [])
        .find((component) => component.classId === 'cc.Sprite');
    return sprite && sprite.spriteFrameUuid;
}

function previewNodeName(record) {
    return record.capabilityId === 'scene.node.patch'
        ? patchContract.targetPathAt(record.manifest.targetNodePath, record.manifest.expectedDiff, 'after').split('/').pop()
        : record.manifest.nodeName;
}

function runtimeStateMatches(record, observed) {
    if (record.capabilityId === 'scene.node.patch') return !!observed
        && observed.sceneName === record.sceneName && observed.nodeUuid === record.manifest.targetNodeUuid
        && observed.nodePath === patchContract.targetPathAt(record.manifest.targetNodePath, record.manifest.expectedDiff, 'after')
        && patchContract.matchesDiff({ ...observed, componentDetails: observed.components }, record.manifest.expectedDiff, 'after');
    if (!sceneObject(record) || !observed || observed.sceneName !== record.sceneName
        || observed.nodePath !== `${record.manifest.parentPath}/${record.manifest.nodeName}`
        || observed.nodeUuid !== record.createdNodeUuid || !Array.isArray(observed.components)) return false;
    const expected = record.previewComponents || record.manifest.components || [];
    if (record.manifest.prefabMode === 'instantiate' && !Array.isArray(record.previewComponents)) return false;
    if (observed.components.length !== expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
        if (observed.components[i].classId !== expected[i].classId) return false;
        if (expected[i].classId === 'cc.Sprite' && observed.components[i].spriteFrameUuid !== expected[i].spriteFrameUuid) return false;
        if (expected[i].classId === 'cc.Label' && observed.components[i].text !== expected[i].text) return false;
        if (expected[i].classId === 'cocosScript' && observed.components[i].scriptClassId !== expected[i].scriptClassId) return false;
        if (typeof expected[i].enabled === 'boolean' && observed.components[i].enabled !== expected[i].enabled) return false;
    }
    const transform = record.manifest.transform || {};
    for (const key of ['position', 'scale']) {
        if (transform[key] && (!observed.transform || !observed.transform[key]
            || Math.abs(observed.transform[key].x - transform[key].x) > 1e-5
            || Math.abs(observed.transform[key].y - transform[key].y) > 1e-5)) return false;
    }
    return true;
}

function acceptRuntimePreview({ projectRoot, creatorVersion, operationId, previewUrl, observedAt, runtimeState }) {
    if (typeof projectRoot !== 'string' || creatorVersion !== '2.4.15'
        || typeof operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) {
        return failure('INVALID_ARGUMENT', 'Runtime preview accepts only a 2.4.15 operation target.');
    }
    let url;
    try { url = new URL(previewUrl); } catch (_) { return failure('INVALID_PREVIEW_EVIDENCE', 'Invalid preview URL.'); }
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !Number.isInteger(Number(url.port))
        || Number(url.port) < 1 || Number(url.port) > 65535 || url.username || url.password
        || url.pathname !== '/' || url.search || url.hash || previewUrl.length > 256
        || typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt))) {
        return failure('INVALID_PREVIEW_EVIDENCE', 'Automatic preview evidence must come from the local 2.4 Web preview.');
    }
    const project = path.resolve(projectRoot);
    let record;
    try { record = store.read(project, operationId); }
    catch (error) { return failure(error.code === 'ENOENT' ? 'OPERATION_NOT_FOUND' : 'OPERATION_READ_FAILED', 'Cannot read operation record.'); }
    if (record.projectRoot !== project || record.creatorVersion !== creatorVersion || record.operationId !== operationId)
        return failure('OPERATION_TARGET_MISMATCH', 'Operation record does not match the requested target.');
    if (!hasPreviewTarget(record) || record.phases.disk !== 'passed' || !(record.createdNodeUuid || record.manifest.targetNodeUuid))
        return failure('PREVIEW_NOT_APPLICABLE', 'A saved component-bearing node is required for runtime preview.');
    const observationTime = Date.parse(observedAt);
    if (observationTime < Date.parse(record.createdAt) || observationTime > Date.now() + 60000)
        return failure('INVALID_PREVIEW_EVIDENCE', 'Observation time must follow the write and cannot be in the future.');
    if (!runtimeStateMatches(record, runtimeState))
        return failure('RUNTIME_PREVIEW_MISMATCH', 'The running scene does not match the saved node, component, resource, and transform.');
    if (record.phases.preview === 'passed') {
        const previous = record.receipts.find((item) => item.phase === 'preview' && item.status === 'passed');
        const evidence = previous && previous.evidence && previous.evidence[0];
        if (evidence && evidence.kind === 'runtime-preview' && evidence.previewUrl === previewUrl
            && JSON.stringify(evidence.runtimeState) === JSON.stringify(runtimeState)) return { success: true, data: record, alreadyAccepted: true };
        return failure('PREVIEW_ALREADY_ACCEPTED', 'A different preview observation is already recorded.');
    }
    if (record.phases.preview !== 'pending') return failure('PREVIEW_STATE_CONFLICT', 'Preview is not pending.');
    const evidence = { kind: 'runtime-preview', source: 'isolated Chrome DevTools runtime readback',
        sceneName: record.sceneName, nodeName: previewNodeName(record), nodeUuid: record.createdNodeUuid || record.manifest.targetNodeUuid,
        ...(firstSpriteUuid(record) ? { assetUuid: firstSpriteUuid(record) } : {}), previewUrl,
        observedAt: new Date(observedAt).toISOString(), runtimeState,
        note: 'Runtime scene node, whitelisted component values, resource UUIDs, and requested transform matched the saved operation.' };
    record.receipts.push({ contractVersion: '0.1', operationId, capabilityId: record.capabilityId,
        creatorVersion, phase: 'preview', status: 'passed', evidence: [evidence] });
    record.phases.preview = 'passed';
    record.updatedAt = new Date().toISOString();
    try { store.write(project, record); } catch (_) { return failure('OPERATION_WRITE_FAILED', 'Cannot persist runtime preview receipt.'); }
    return { success: true, data: record, alreadyAccepted: false };
}

function value(argv, flag) { const index = argv.indexOf(flag); return index < 0 ? undefined : argv[index + 1]; }
if (require.main === module) {
    const argv = process.argv.slice(2);
    let evidence;
    try { evidence = JSON.parse(value(argv, '--evidence') || 'null'); } catch (_) { evidence = null; }
    const result = acceptPreview({ projectRoot: value(argv, '--project'), creatorVersion: value(argv, '--creator-version'),
        operationId: value(argv, '--operation-id'), evidence });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.success ? 0 : 1;
}

module.exports = { acceptPreview, acceptRuntimePreview, runtimeStateMatches };
