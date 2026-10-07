'use strict';

const path = require('path');
const store = require('./operation-store');

function failure(code, message) { return { success: false, error: { code, message } }; }
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
    if (record.manifest.sceneAction === 'compensate') return failure('PREVIEW_NOT_APPLICABLE', 'Compensation is verified by scene readback.');
    if (record.phases.disk !== 'passed') return failure('DISK_NOT_VERIFIED', 'Preview cannot pass before disk readback.');
    if (record.phases.preview === 'passed') {
        const previous = record.receipts.find((item) => item.phase === 'preview' && item.status === 'passed');
        const original = previous && previous.evidence && previous.evidence[0];
        if (!original || original.previewUrl !== evidence.url || original.observedAt !== new Date(evidence.observedAt).toISOString()
            || original.note !== evidence.note.trim()) return failure('PREVIEW_ALREADY_ACCEPTED', 'A different preview observation is already recorded.');
        return { success: true, data: record, alreadyAccepted: true };
    }
    if (record.phases.preview !== 'pending') return failure('PREVIEW_STATE_CONFLICT', 'Preview is not pending.');
    const receipt = { contractVersion: '0.1', operationId, capabilityId: 'scene.pngSprite', creatorVersion,
        phase: 'preview', status: 'passed', evidence: [{ kind: 'visual-preview', source: 'Agent visual inspection in local Web preview',
            sceneName: record.sceneName, nodeName: record.manifest.nodeName, assetUuid: record.manifest.assetUuid,
            previewUrl: evidence.url, observedAt: new Date(evidence.observedAt).toISOString(), note: evidence.note.trim() }] };
    record.receipts.push(receipt);
    record.phases.preview = 'passed';
    record.updatedAt = new Date().toISOString();
    try { store.write(project, record); } catch (_) { return failure('OPERATION_WRITE_FAILED', 'Cannot persist preview receipt.'); }
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

module.exports = { acceptPreview };
