'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const releaseIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const assetIdPattern = /^[a-z][a-z0-9_-]{0,63}$/;
const sourcePattern = /^assets\/resources\/([a-z0-9][a-z0-9._-]{0,94}\.png)$/i;
const digestPattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const bundleRootPattern = /^assets\/[A-Za-z0-9_-]{1,64}$/;
const bundleNamePattern = /^[a-z][a-z0-9_-]{0,31}$/;
const reservedIds = new Set(['selected', 'effective']);
const fail = (code, message) => ({ success: false, outcome: 'failed', error: { code, message } });
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const directory = (root) => path.join(root, '.cocos-agent', 'content-releases');
const releaseFile = (root, id) => path.join(directory(root), `${id}.json`);
const pointerFile = (root) => path.join(directory(root), 'selected.json');
const effectiveFile = (root) => path.join(directory(root), 'effective.json');

function atomicWrite(filename, value, exclusive = false) {
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    if (exclusive) return fs.writeFileSync(filename, `${JSON.stringify(value)}\n`, { flag: 'wx', mode: 0o600 });
    const temporary = `${filename}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { flag: 'wx', mode: 0o600 });
        fs.renameSync(temporary, filename);
    } finally { try { fs.unlinkSync(temporary); } catch (_) { /* renamed */ } }
}
function project(params) {
    if (!params || typeof params.projectRoot !== 'string' || !path.isAbsolute(params.projectRoot)
        || !['2.4.15', '3.8.7'].includes(params.creatorVersion)) return fail('INVALID_TARGET', 'Provide an absolute project root and Creator 2.4.15 or 3.8.7.');
    const root = path.resolve(params.projectRoot);
    if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) return fail('PROJECT_NOT_FOUND', 'Project directory does not exist.');
    return { success: true, root };
}
function validate(params) {
    const target = project(params);
    if (!target.success) return target;
    const { manifest } = params;
    const isBundle = manifest?.delivery === 'asset-bundle';
    if (!manifest || manifest.contractVersion !== '0.1' || manifest.creatorVersion !== params.creatorVersion
        || !releaseIdPattern.test(manifest.releaseId || '') || reservedIds.has(manifest.releaseId)
        || !['built-in-resources', 'asset-bundle'].includes(manifest.delivery)
        || (isBundle && (manifest.creatorVersion !== '2.4.15' || !bundleRootPattern.test(manifest.bundleRoot || '')
            || !bundleNamePattern.test(manifest.bundleName || '')))
        || (!isBundle && (manifest.bundleRoot !== undefined || manifest.bundleName !== undefined))
        || !Array.isArray(manifest.assets) || manifest.assets.length < 1 || manifest.assets.length > 16
        || !assetIdPattern.test(manifest.entryAssetId || '')) return fail('INVALID_MANIFEST', 'Invalid local content release manifest.');
    let bundleDirectory = null;
    if (isBundle) {
        const bundleRelative = manifest.bundleRoot.slice('assets/'.length);
        const bundleMetaFile = path.join(target.root, `${manifest.bundleRoot}.meta`);
        try {
            const rootReal = fs.realpathSync(target.root);
            const assetsRoot = fs.realpathSync(path.join(target.root, 'assets'));
            bundleDirectory = path.join(assetsRoot, bundleRelative);
            const dirStat = fs.lstatSync(bundleDirectory);
            const metaStat = fs.lstatSync(bundleMetaFile);
            if (!assetsRoot.startsWith(rootReal + path.sep) || !dirStat.isDirectory() || dirStat.isSymbolicLink()
                || !metaStat.isFile() || metaStat.isSymbolicLink()
                || !fs.realpathSync(bundleDirectory).startsWith(assetsRoot + path.sep)) throw Error('unsafe bundle folder');
            const folderMeta = JSON.parse(fs.readFileSync(bundleMetaFile, 'utf8'));
            if (folderMeta.importer !== 'folder' || folderMeta.isBundle !== true
                || folderMeta.bundleName !== manifest.bundleName || folderMeta.isRemoteBundle === true)
                return fail('BUNDLE_CONFIGURATION_MISMATCH', 'Bundle folder metadata must declare the requested local 2.4 Bundle name.');
        } catch (_) { return fail('BUNDLE_NOT_READY', 'Bundle folder, metadata, or project path is missing or unsafe.'); }
    }
    const ids = new Set();
    const sources = new Set();
    const records = [];
    for (const asset of manifest.assets) {
        const sourceName = typeof asset?.source === 'string' ? asset.source.slice(`${manifest.bundleRoot || ''}/`.length) : '';
        const validSource = isBundle
            ? typeof asset?.source === 'string' && asset.source.startsWith(`${manifest.bundleRoot}/`)
                && !sourceName.includes('/') && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i.test(sourceName)
            : sourcePattern.test(asset?.source || '');
        if (!asset || !assetIdPattern.test(asset.id || '') || ids.has(asset.id)
            || !validSource || sources.has(asset.source.toLowerCase())
            || !digestPattern.test(asset.sha256 || '') || !Array.isArray(asset.dependsOn)
            || !asset.dependsOn.every((id) => assetIdPattern.test(id))
            || new Set(asset.dependsOn).size !== asset.dependsOn.length) return fail('INVALID_ASSET', 'Invalid asset identity, source, digest or dependencies.');
        ids.add(asset.id);
        sources.add(asset.source.toLowerCase());
        const base = path.basename(asset.source).replace(/\.png$/i, '');
        const runtimePath = params.creatorVersion === '2.4.15' ? base : `${base}/texture`;
        if (asset.runtimePath !== runtimePath) return fail('RUNTIME_PATH_MISMATCH', `Expected ${runtimePath} for ${asset.id}.`);
        const filename = path.join(target.root, ...asset.source.split('/'));
        const metaFile = `${filename}.meta`;
        let bytes; let meta;
        try {
            const sourceStat = fs.lstatSync(filename);
            const metaStat = fs.lstatSync(metaFile);
            if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || !metaStat.isFile() || metaStat.isSymbolicLink()) throw Error('not regular');
            const realRoot = fs.realpathSync(target.root) + path.sep;
            const allowed = fs.realpathSync(isBundle ? bundleDirectory : path.join(target.root, 'assets', 'resources')) + path.sep;
            if (!allowed.startsWith(realRoot)) throw Error('asset directory outside project');
            if (!fs.realpathSync(filename).startsWith(allowed) || !fs.realpathSync(metaFile).startsWith(allowed)) throw Error('outside allowed asset directory');
            bytes = fs.readFileSync(filename);
            meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        } catch (_) { return fail('ASSET_NOT_READY', `Asset or Creator meta is missing: ${asset.source}`); }
        if (bytes.length < 24 || bytes.length > 16 * 1024 * 1024
            || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
            return fail('INVALID_PNG', `Invalid PNG signature or size: ${asset.source}`);
        if (sha256(bytes) !== asset.sha256) return fail('DIGEST_MISMATCH', `Digest differs: ${asset.source}`);
        const resourceUuid = params.creatorVersion === '2.4.15' && meta.importer === 'texture' ? meta.uuid
            : Object.values(meta.subMetas || {}).find((subMeta) => subMeta.importer === 'texture' && subMeta.imported === true)?.uuid;
        let spriteFrameUuid;
        if (isBundle) {
            const frames = Object.values(meta.subMetas || {}).filter((subMeta) => subMeta.importer === 'sprite-frame'
                && subMeta.rawTextureUuid === meta.uuid && uuidPattern.test(subMeta.uuid || ''));
            if (!uuidPattern.test(meta.uuid || '') || frames.length !== 1
                || (asset.spriteFrameUuid && asset.spriteFrameUuid !== frames[0].uuid))
                return fail('BUNDLE_SPRITE_FRAME_MISMATCH', `Expected one SpriteFrame linked to the imported Texture: ${asset.source}`);
            spriteFrameUuid = frames[0].uuid;
        }
        if (!resourceUuid || (asset.resourceUuid && asset.resourceUuid !== resourceUuid)
            || (params.creatorVersion === '3.8.7' && meta.imported !== true))
            return fail('ASSET_NOT_READY', `Expected imported Texture2D metadata: ${asset.source}`);
        records.push({ id: asset.id, source: asset.source, sha256: asset.sha256, runtimePath,
            dependsOn: [...asset.dependsOn], resourceUuid, ...(isBundle ? { spriteFrameUuid } : {}) });
    }
    if (!ids.has(manifest.entryAssetId)) return fail('MISSING_ENTRY', 'Entry asset is absent.');
    const graph = new Map(records.map((asset) => [asset.id, asset.dependsOn]));
    const visited = new Set(); const active = new Set();
    function visit(id) {
        if (!graph.has(id)) return 'MISSING_DEPENDENCY';
        if (active.has(id)) return 'DEPENDENCY_CYCLE';
        if (visited.has(id)) return null;
        active.add(id);
        for (const dependency of graph.get(id)) { const error = visit(dependency); if (error) return error; }
        active.delete(id); visited.add(id);
        return null;
    }
    for (const id of ids) { const error = visit(id); if (error) return fail(error, `Invalid dependency graph at ${id}.`); }
    const release = { contractVersion: '0.1', releaseId: manifest.releaseId, creatorVersion: params.creatorVersion,
        delivery: manifest.delivery, ...(isBundle ? { bundleRoot: manifest.bundleRoot, bundleName: manifest.bundleName } : {}),
        entryAssetId: manifest.entryAssetId, assets: records };
    return { success: true, outcome: 'ready', projectRoot: target.root, release,
        fingerprint: sha256(Buffer.from(JSON.stringify(release))) };
}
function stage(params) {
    const plan = validate(params);
    if (!plan.success) return plan;
    if (plan.release.delivery === 'asset-bundle') {
        try {
            const releaseDir = directory(plan.projectRoot);
            if (fs.existsSync(releaseDir)) {
                const stat = fs.lstatSync(releaseDir);
                if (!stat.isDirectory() || stat.isSymbolicLink())
                    return fail('INVALID_RECORD_DIRECTORY', 'Content release directory is not a regular project directory.');
                for (const name of fs.readdirSync(releaseDir)) {
                    if (!name.endsWith('.json') || name === 'selected.json' || name === 'effective.json') continue;
                    const priorFile = path.join(releaseDir, name);
                    const priorStat = fs.lstatSync(priorFile);
                    if (!priorStat.isFile() || priorStat.isSymbolicLink()) continue;
                    const prior = JSON.parse(fs.readFileSync(priorFile, 'utf8'));
                    if (prior.releaseId !== plan.release.releaseId && prior.delivery === 'asset-bundle'
                        && prior.bundleName === plan.release.bundleName)
                        return fail('BUNDLE_NAME_CONFLICT', 'Each staged Bundle release needs a unique bundleName to avoid 2.4 runtime cache collisions.');
                }
            }
        } catch (_) { return fail('RELEASE_SCAN_FAILED', 'Could not safely inspect staged Bundle releases.'); }
    }
    const filename = releaseFile(plan.projectRoot, plan.release.releaseId);
    if (fs.existsSync(filename)) {
        const prior = JSON.parse(fs.readFileSync(filename, 'utf8'));
        const { fingerprint, stagedAt, ...savedRelease } = prior;
        if (fingerprint !== plan.fingerprint || JSON.stringify(savedRelease) !== JSON.stringify(plan.release))
            return fail('RELEASE_CONFLICT', 'Release ID already contains different content.');
        return { success: true, outcome: 'staged', releaseId: plan.release.releaseId, fingerprint: plan.fingerprint, idempotent: true };
    }
    const record = { ...plan.release, fingerprint: plan.fingerprint, stagedAt: new Date().toISOString() };
    try { atomicWrite(filename, record, true); }
    catch (error) { if (error.code === 'EEXIST') return fail('RELEASE_CONFLICT', 'Concurrent release ID already exists.'); throw error; }
    return { success: true, outcome: 'staged', releaseId: record.releaseId, fingerprint: record.fingerprint, idempotent: false };
}
function selected(root) {
    try { return JSON.parse(fs.readFileSync(pointerFile(root), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function effective(root) {
    try { return JSON.parse(fs.readFileSync(effectiveFile(root), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function select(params) {
    const target = project(params);
    if (!target.success) return target;
    if (!releaseIdPattern.test(params.releaseId || '') || reservedIds.has(params.releaseId)
        || (params.expectedCurrent !== null && params.expectedCurrent !== undefined
        && !releaseIdPattern.test(params.expectedCurrent))) return fail('INVALID_ARGUMENT', 'Provide a staged release and expected current release.');
    const current = selected(target.root);
    if ((current?.releaseId || null) !== (params.expectedCurrent ?? null)) return fail('CURRENT_CHANGED', 'Selected release differs from expectedCurrent.');
    let release;
    try { release = JSON.parse(fs.readFileSync(releaseFile(target.root, params.releaseId), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fail('RELEASE_NOT_FOUND', 'Release is not staged.'); throw error; }
    if (release.creatorVersion !== params.creatorVersion) return fail('CREATOR_VERSION_MISMATCH', 'Release targets another Creator version.');
    const checked = validate({ projectRoot: target.root, creatorVersion: params.creatorVersion, manifest: release });
    if (!checked.success || checked.fingerprint !== release.fingerprint) return fail('RELEASE_CHANGED', 'Staged asset or manifest no longer matches.');
    if (current?.releaseId === release.releaseId) return { success: true, outcome: 'selected', releaseId: release.releaseId, idempotent: true };
    atomicWrite(pointerFile(target.root), { releaseId: release.releaseId, previousReleaseId: current?.releaseId || null,
        fingerprint: release.fingerprint, selectedAt: new Date().toISOString() });
    return { success: true, outcome: 'selected', releaseId: release.releaseId, previousReleaseId: current?.releaseId || null, idempotent: false };
}
function get(params) {
    const target = project(params);
    if (!target.success) return target;
    const pointer = selected(target.root);
    if (!params.releaseId) return { success: true, outcome: 'read', selected: pointer, effective: effective(target.root) };
    if (!releaseIdPattern.test(params.releaseId) || reservedIds.has(params.releaseId)) return fail('INVALID_ARGUMENT', 'Invalid release ID.');
    try { return { success: true, outcome: 'read', release: JSON.parse(fs.readFileSync(releaseFile(target.root, params.releaseId), 'utf8')), selected: pointer, effective: effective(target.root) }; }
    catch (error) { if (error.code === 'ENOENT') return fail('RELEASE_NOT_FOUND', 'Release is not staged.'); throw error; }
}
function acceptRuntimeForPlatform(params, platform) {
    const target = project(params);
    if (!target.success) return target;
    const receipt = params.receipt;
    const pointer = selected(target.root);
    if (!receipt || !['applied', 'already-active'].includes(receipt.outcome)
        || !pointer || receipt.releaseId !== pointer.releaseId || receipt.activeReleaseId !== pointer.releaseId
        || receipt.activeFingerprint !== pointer.fingerprint || typeof receipt.assetId !== 'string'
        || receipt.activeAssetId !== receipt.assetId || !Number.isFinite(receipt.currentRefCount)
        || receipt.currentRefCount < 1)
        return fail('RUNTIME_RECEIPT_MISMATCH', 'Runtime receipt does not match the selected release.');
    let release;
    try { release = JSON.parse(fs.readFileSync(releaseFile(target.root, pointer.releaseId), 'utf8')); }
    catch (_) { return fail('RELEASE_NOT_FOUND', 'Selected release record is missing.'); }
    const asset = release.assets.find((item) => item.id === receipt.assetId);
    if (!asset || receipt.resourceUuid !== asset.resourceUuid || release.creatorVersion !== params.creatorVersion)
        return fail('RUNTIME_RECEIPT_MISMATCH', 'Runtime resource identity differs from the staged release.');
    const checked = validate({ projectRoot: target.root, creatorVersion: params.creatorVersion, manifest: release });
    if (!checked.success || checked.fingerprint !== release.fingerprint)
        return fail('RELEASE_CHANGED', 'Selected release no longer matches project assets.');
    const observation = { releaseId: release.releaseId, fingerprint: release.fingerprint,
        assetId: asset.id, resourceUuid: asset.resourceUuid, platform,
        observedAt: new Date().toISOString() };
    atomicWrite(effectiveFile(target.root), observation);
    return { success: true, outcome: 'runtime-observed', effective: observation };
}
function acceptRuntime(params) {
    if (!params || params.platform !== 'web-preview') return fail('UNTRUSTED_RUNTIME_PLATFORM', 'Use the authenticated runtime channel for native receipts.');
    return acceptRuntimeForPlatform(params, 'web-preview');
}
function acceptNativeRuntime(params) {
    return acceptRuntimeForPlatform(params, 'mac-native');
}
function rollback(params) {
    const target = project(params);
    if (!target.success) return target;
    const pointer = selected(target.root);
    if (!pointer || pointer.releaseId !== params.expectedCurrent) return fail('CURRENT_CHANGED', 'Selected release differs from expectedCurrent.');
    if (!pointer.previousReleaseId) return fail('NO_PREVIOUS_RELEASE', 'There is no previous selected release.');
    return select({ projectRoot: target.root, creatorVersion: params.creatorVersion,
        releaseId: pointer.previousReleaseId, expectedCurrent: pointer.releaseId });
}
function handle(method, params) {
    if (method === 'content.plan' || method === 'content.bundle.plan') return validate(params);
    if (method === 'content.stage' || method === 'content.bundle.stage') return stage(params);
    if (method === 'content.select') return select(params);
    if (method === 'content.rollback') return rollback(params);
    if (method === 'content.get') return get(params);
    if (method === 'content.runtime.accept') return acceptRuntime(params);
    return fail('UNKNOWN_METHOD', 'Unknown content release method.');
}
module.exports = { validate, stage, select, rollback, get, acceptRuntime, acceptNativeRuntime, handle };
