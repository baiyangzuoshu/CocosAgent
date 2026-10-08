'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./operation-store');

function failure(code, message) { return { success: false, error: { code, message } }; }

function sceneFile(projectRoot, creatorVersion, sceneName) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(sceneName || '')) return null;
    const extension = creatorVersion === '2.4.15' ? '.fire' : '.scene';
    const assets = path.join(projectRoot, 'assets');
    const matches = [];
    function visit(directory, depth) {
        if (depth > 8) return;
        let entries;
        try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { return; }
        for (const entry of entries) {
            if (['library', 'temp', 'local', 'build'].includes(entry.name)) continue;
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(filename, depth + 1);
            else if (entry.isFile() && entry.name === `${sceneName}${extension}`) matches.push(filename);
        }
    }
    visit(assets, 0);
    return matches.length === 1 ? matches[0] : null;
}

function diskAbsence(projectRoot, creatorVersion, record) {
    const filename = sceneFile(projectRoot, creatorVersion, record.sceneName);
    if (!filename) return null;
    let objects;
    let bytes;
    try { bytes = fs.readFileSync(filename); objects = JSON.parse(bytes.toString('utf8')); } catch (_) { return null; }
    if (!Array.isArray(objects)) return null;
    const parts = record.manifest.parentPath.split('/');
    if (parts[0] !== record.sceneName) return null;
    const roots = objects.map((item, index) => ({ item, index })).filter(({ item }) => item && item.__type__ === 'cc.Scene');
    if (roots.length !== 1) return null;
    let parentIndex = roots[0].index;
    for (const part of parts.slice(1)) {
        const parent = objects[parentIndex];
        const childIndexes = Array.isArray(parent._children) ? parent._children.map((ref) => ref && ref.__id__).filter(Number.isInteger) : [];
        const matches = childIndexes.filter((index) => objects[index] && objects[index].__type__ === 'cc.Node' && objects[index]._name === part);
        if (matches.length !== 1) return null;
        parentIndex = matches[0];
    }
    if (objects[parentIndex]._id !== record.manifest.parentUuid) return null;
    const children = objects.filter((item) => item && item.__type__ === 'cc.Node' && item._name === record.manifest.nodeName
        && item._parent && item._parent.__id__ === parentIndex);
    if (children.length) return null;
    return { filename, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

function allowedRecord(record, projectRoot, creatorVersion, operationId) {
    if (record.projectRoot !== projectRoot || record.creatorVersion !== creatorVersion || record.operationId !== operationId
        || record.capabilityId !== 'scene.node.create' || !record.sceneName || !record.manifest
        || !['apply', 'replay'].includes(record.manifest.action) || record.intent !== 'editor-write-sent'
        || !record.phases || record.phases.editor !== 'failed' || record.phases.disk !== 'pending'
        || record.phases.preview !== 'pending' || record.phases.recovery !== 'pending' || record.createdNodeUuid
        || record.reconciliation) return false;
    const editorFailure = [...(record.receipts || [])].reverse().find((item) => item.phase === 'editor' && item.status === 'failed');
    return !!(editorFailure && editorFailure.error && editorFailure.error.sideEffect === 'possible');
}

function reconcileNoEffect({ projectRoot, creatorVersion, operationId, liveObservation }) {
    if (typeof projectRoot !== 'string' || !['2.4.15', '3.8.7'].includes(creatorVersion)
        || typeof operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) {
        return failure('INVALID_ARGUMENT', 'Project, Creator version, and operation ID are required.');
    }
    const project = path.resolve(projectRoot);
    let record;
    try { record = store.read(project, operationId); }
    catch (error) { return failure(error.code === 'ENOENT' ? 'OPERATION_NOT_FOUND' : 'OPERATION_READ_FAILED', 'Cannot read operation record.'); }
    if (record.reconciliation && record.reconciliation.disposition === 'no-effect') return { success: true, data: record, alreadyReconciled: true };
    if (!allowedRecord(record, project, creatorVersion, operationId)) return failure('OPERATION_NOT_RECONCILABLE', 'Only an uncertain failed apply/replay with no recorded node can be reconciled.');
    const parentPath = record.manifest.parentPath;
    const nodePath = `${parentPath}/${record.manifest.nodeName}`;
    const observedAt = liveObservation && liveObservation.observedAt;
    if (!liveObservation || liveObservation.sceneName !== record.sceneName
        || !liveObservation.parent || liveObservation.parent.status !== 'found'
        || liveObservation.parent.path !== parentPath || liveObservation.parent.uuid !== record.manifest.parentUuid
        || !liveObservation.target || liveObservation.target.status !== 'not-found' || liveObservation.target.path !== nodePath
        || typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt)) || Date.parse(observedAt) > Date.now() + 60000) {
        return failure('LIVE_STATE_NOT_CONFIRMED', 'The same active scene must contain the recorded parent and lack the exact target path.');
    }
    if (Date.parse(observedAt) < Date.parse(record.createdAt) || nodePath.length > 240) {
        return failure('LIVE_STATE_NOT_CONFIRMED', 'Observation time or target path is outside the operation contract.');
    }
    const disk = diskAbsence(project, creatorVersion, record);
    if (!disk) return failure('DISK_STATE_NOT_CONFIRMED', 'The saved scene must contain the recorded parent and no matching direct child.');
    const relativeScene = path.relative(project, disk.filename).split(path.sep).join('/');
    if (relativeScene.length > 512) return failure('DISK_STATE_NOT_CONFIRMED', 'Saved scene path exceeds the persisted evidence limit.');
    const recoveryEvidence = { kind: 'recovery-readback', source: 'Same Creator session scene snapshots and serialized scene readback',
        sceneName: record.sceneName, nodeName: record.manifest.nodeName, sha256: disk.sha256,
        observedAt: new Date(observedAt).toISOString(), note: 'Recorded parent identity matched; target path was absent from both active scene and serialized scene.' };
    record.reconciliation = { disposition: 'no-effect', observedAt: recoveryEvidence.observedAt,
        sceneName: record.sceneName, parentPath, parentUuid: record.manifest.parentUuid,
        targetPath: nodePath, diskPath: relativeScene, diskSha256: disk.sha256 };
    record.phases.recovery = 'passed';
    record.receipts.push({ contractVersion: '0.1', operationId, capabilityId: 'scene.node.create', creatorVersion,
        phase: 'recovery', status: 'passed', evidence: [recoveryEvidence] });
    record.updatedAt = new Date().toISOString();
    try { store.write(project, record); } catch (_) { return failure('OPERATION_WRITE_FAILED', 'Cannot persist reconciliation receipt.'); }
    return { success: true, data: record, alreadyReconciled: false };
}

module.exports = { reconcileNoEffect, diskAbsence, allowedRecord };
