'use strict';

// Creator 2.4.15 Web-Mobile cross-Bundle static dependency contract.
// Owners and consumers are derived from imported PNG metadata and serialized .fire scenes.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ID = /^(?!selected$|effective$)[a-z0-9][a-z0-9._-]{0,63}$/;
const BUILD_ID = /^[a-z0-9][a-z0-9-]{2,31}$/;
const fail = (code, message, details) => ({ success: false, outcome: 'failed', error: { code, message }, ...(details ? { details } : {}) });
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const slash = (value) => value.split(path.sep).join('/');

function safeJson(filename) {
    try { return JSON.parse(fs.readFileSync(filename, 'utf8')); } catch (_) { return null; }
}

function walk(root, visit, maxEntries = 50000) {
    const stack = [{ directory: root, depth: 0 }];
    let count = 0;
    while (stack.length) {
        const current = stack.pop();
        if (current.depth > 14) continue;
        let entries;
        try { entries = fs.readdirSync(current.directory, { withFileTypes: true }); } catch (_) { return false; }
        for (const entry of entries) {
            if (++count > maxEntries) return false;
            const filename = path.join(current.directory, entry.name);
            if (entry.isDirectory()) stack.push({ directory: filename, depth: current.depth + 1 });
            else if (entry.isFile() && visit(filename) === false) return true;
        }
    }
    return true;
}

function classifySource(root, source) {
    const parts = source.split('/');
    if (parts[0] !== 'assets' || parts.length < 3) return null;
    if (parts[1] === 'resources') return { id: 'owner-resources', kind: 'builtin-bundle', bundleName: 'resources', role: 'owner' };
    const folder = parts[1];
    const meta = safeJson(path.join(root, 'assets', `${folder}.meta`));
    if (!meta || meta.isBundle !== true || meta.isRemoteBundle === true || typeof meta.bundleName !== 'string'
        || !/^[a-z][a-z0-9_-]{0,31}$/.test(meta.bundleName)) return null;
    return { id: `owner-${meta.bundleName}`, kind: 'bundle', bundleName: meta.bundleName, role: 'owner' };
}

function classifyScene(root, filename) {
    const assetsRoot = path.join(root, 'assets');
    const relative = slash(path.relative(assetsRoot, filename));
    const first = relative.split('/')[0];
    const meta = safeJson(path.join(assetsRoot, `${first}.meta`));
    if (meta && meta.isBundle === true && meta.isRemoteBundle !== true && typeof meta.bundleName === 'string') {
        return { id: `consumer-${meta.bundleName}`, kind: 'bundle', bundleName: meta.bundleName, role: 'consumer' };
    }
    return { id: 'consumer-main', kind: 'main', bundleName: 'main', role: 'consumer' };
}

function pngMeta(root, source) {
    const segments = source.split('/');
    const assetsRoot = path.join(root, 'assets');
    let cursor = assetsRoot;
    try {
        for (const segment of segments.slice(1, -1)) {
            cursor = path.join(cursor, segment);
            const directoryStat = fs.lstatSync(cursor);
            if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) return null;
        }
    } catch (_) { return null; }
    const filename = path.join(root, ...segments);
    let stat; let bytes; let meta;
    try {
        stat = fs.lstatSync(filename);
        if (!stat.isFile() || stat.isSymbolicLink()) return null;
        const realAssets = fs.realpathSync(assetsRoot);
        const realFile = fs.realpathSync(filename);
        if (!realFile.startsWith(`${realAssets}${path.sep}`)) return null;
        bytes = fs.readFileSync(realFile);
        meta = safeJson(`${realFile}.meta`);
    } catch (_) { return null; }
    if (bytes.length < 24 || bytes.length > 16 * 1024 * 1024
        || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
        || !meta || meta.importer !== 'texture' || !UUID.test(meta.uuid || '') || !meta.subMetas
        || typeof meta.subMetas !== 'object') return null;
    const frames = Object.entries(meta.subMetas).filter(([, sub]) => sub && sub.importer === 'sprite-frame'
        && UUID.test(sub.uuid || '') && typeof sub.rawTextureUuid === 'string'
        && sub.rawTextureUuid.toLowerCase() === meta.uuid.toLowerCase());
    if (frames.length !== 1) return null;
    return { textureUuid: meta.uuid.toLowerCase(), spriteFrameUuid: frames[0][1].uuid.toLowerCase(),
        rawTextureUuid: frames[0][1].rawTextureUuid.toLowerCase(), frameName: frames[0][0], sha256: digest(bytes) };
}

function topologicalOrder(deliveries) {
    const pending = new Map(deliveries.map((item) => [item.id, new Set(item.dependsOn || [])]));
    const order = [];
    while (pending.size) {
        const ready = [...pending.entries()].filter(([, deps]) => [...deps].every((id) => !pending.has(id)))
            .map(([id]) => id).sort();
        if (!ready.length) return null;
        for (const id of ready) { pending.delete(id); order.push(id); }
    }
    return order;
}

function normalized(params) {
    if (!params || params.creatorVersion !== '2.4.15' || typeof params.projectRoot !== 'string'
        || !path.isAbsolute(params.projectRoot) || !ID.test(params.contractId || '') || !BUILD_ID.test(params.buildId || '')
        || params.platform !== undefined && params.platform !== 'web-mobile'
        || !Array.isArray(params.assetSources) || params.assetSources.length < 1 || params.assetSources.length > 32) {
        return fail('INVALID_ARGUMENT', 'Provide a Creator 2.4.15 project, contract/build IDs, and 1–32 project-relative PNG assetSources for web-mobile.');
    }
    const root = path.resolve(params.projectRoot);
    try { if (!fs.statSync(root).isDirectory()) throw Error(); } catch (_) { return fail('PROJECT_NOT_FOUND', 'Project directory does not exist.'); }
    const sources = params.assetSources;
    if (sources.some((source) => typeof source !== 'string' || !/^assets\/[A-Za-z0-9_./-]+\.png$/i.test(source)
        || source.split('/').includes('..') || source.includes('\\')) || new Set(sources).size !== sources.length) {
        return fail('INVALID_ASSET_SOURCES', 'assetSources must be unique project-relative PNG paths under assets/.');
    }
    return { root, sources: [...sources].sort() };
}

function plan(params) {
    const input = normalized(params);
    if (input.success === false) return input;
    const { root, sources } = input;
    const assetsRoot = path.join(root, 'assets');
    if (!fs.existsSync(assetsRoot)) return fail('ASSETS_NOT_FOUND', 'Project assets directory is missing.');
    const assets = [];
    const deliveryMap = new Map();
    const sceneFiles = [];
    for (const source of sources) {
        const owner = classifySource(root, source);
        const imported = pngMeta(root, source);
        if (!owner || !imported) return fail('ASSET_IDENTITY_INVALID', `PNG, .meta UUID chain, or local owner Bundle is invalid: ${source}`);
        for (const [uuid, type] of [[imported.spriteFrameUuid, 'cc.SpriteFrame'], [imported.textureUuid, 'cc.Texture2D']]) {
            const prior = assets.find((asset) => asset.uuid === uuid);
            if (prior && (prior.type !== type || prior.source !== source))
                return fail('UUID_COLLISION', `Selected source assets contain a duplicate or conflicting UUID: ${uuid}`);
            if (!prior) assets.push({ uuid, type, source, ownerDeliveryId: owner.id,
                ...(type === 'cc.SpriteFrame' ? { meta: { rawTextureUuid: imported.rawTextureUuid, frameName: imported.frameName }, dependsOn: [imported.textureUuid] } : { dependsOn: [] }),
                sourceSha256: imported.sha256 });
        }
        deliveryMap.set(owner.id, owner);
    }
    const frameUuids = new Set(assets.filter((asset) => asset.type === 'cc.SpriteFrame').map((asset) => asset.uuid));
    const references = [];
    const consumers = new Map();
    const complete = walk(assetsRoot, (filename) => {
        if (!/\.fire\.meta$/i.test(filename)) return;
        const meta = safeJson(filename);
        const sceneFile = filename.slice(0, -'.meta'.length);
        if (!meta || !UUID.test(meta.uuid || '') || !fs.existsSync(sceneFile)) return;
        let contents;
        try { contents = fs.readFileSync(sceneFile, 'utf8'); } catch (_) { return; }
        const delivery = classifyScene(root, sceneFile);
        for (const assetUuid of frameUuids) {
            if (!contents.toLowerCase().includes(assetUuid)) continue;
            const owner = assets.find((asset) => asset.uuid === assetUuid).ownerDeliveryId;
            if (delivery.id === owner) continue;
            deliveryMap.set(delivery.id, delivery);
            consumers.set(delivery.id, delivery);
            references.push({ consumerDeliveryId: delivery.id, sceneUuid: meta.uuid.toLowerCase(),
                scenePath: slash(path.relative(root, sceneFile)), assetUuid });
        }
    });
    if (!complete) return fail('ASSET_SCAN_LIMIT', 'Project asset tree exceeds the bounded 50,000-entry scan limit.');
    if (!references.length) return fail('NO_CROSS_BUNDLE_REFERENCES', 'No serialized .fire scene outside the owner delivery references the selected SpriteFrame UUIDs.');
    for (const consumer of consumers.values()) {
        const ownerIds = [...new Set(assets.map((asset) => asset.ownerDeliveryId))];
        deliveryMap.set(consumer.id, { ...consumer, dependsOn: ownerIds.sort() });
    }
    for (const [id, delivery] of deliveryMap) {
        if (!delivery.dependsOn) deliveryMap.set(id, { ...delivery, dependsOn: [] });
    }
    const deliveries = [...deliveryMap.values()].sort((a, b) => a.id.localeCompare(b.id));
    const loadOrder = topologicalOrder(deliveries);
    if (!loadOrder) return fail('DEPENDENCY_CYCLE', 'Derived Bundle dependency graph contains a cycle.');
    const contract = { schema: 'cocos.asset-bundle-dependency', version: '0.2', creatorVersion: '2.4.15',
        platform: 'web-mobile', contractId: params.contractId, buildId: params.buildId, assetSources: sources,
        deliveries, assets: assets.sort((a, b) => a.uuid.localeCompare(b.uuid)), references: references.sort((a, b) =>
            `${a.consumerDeliveryId}/${a.sceneUuid}/${a.assetUuid}`.localeCompare(`${b.consumerDeliveryId}/${b.sceneUuid}/${b.assetUuid}`)),
        loadOrder, unloadOrder: [...loadOrder].reverse() };
    if (Buffer.byteLength(JSON.stringify(contract), 'utf8') > 20 * 1024)
        return fail('DEPENDENCY_CONTRACT_TOO_LARGE', 'Derived dependency contract exceeds the bounded 20 KiB runtime message budget.');
    const fingerprint = digest(JSON.stringify(contract));
    return { success: true, outcome: 'ready', projectRoot: root, creatorVersion: contract.creatorVersion,
        platform: contract.platform, contractId: contract.contractId, buildId: contract.buildId,
        contract, fingerprint, deliveryCount: deliveries.length, assetCount: assets.length, referenceCount: references.length };
}

function directory(root) { return path.join(root, '.cocos-agent', 'bundle-dependencies'); }
function file(root, id) { return path.join(directory(root), `${id}.json`); }
function write(filename, value, exclusive) {
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    if (exclusive) return fs.writeFileSync(filename, `${JSON.stringify(value)}\n`, { flag: 'wx', mode: 0o600 });
    const temp = `${filename}.${process.pid}.tmp`;
    try { fs.writeFileSync(temp, `${JSON.stringify(value)}\n`, { flag: 'wx', mode: 0o600 }); fs.renameSync(temp, filename); }
    finally { try { fs.unlinkSync(temp); } catch (_) { /* renamed */ } }
}

function stage(params) {
    const planned = plan(params);
    if (!planned.success) return planned;
    const filename = file(planned.projectRoot, planned.contractId);
    if (fs.existsSync(filename)) {
        const existing = get({ projectRoot: planned.projectRoot, creatorVersion: planned.creatorVersion, contractId: planned.contractId });
        if (existing.success && existing.fingerprint === planned.fingerprint)
            return { ...existing, outcome: 'already-staged' };
        return fail('CONTRACT_ID_CONFLICT', 'Contract ID already names a different or stale dependency manifest.');
    }
    const record = { contract: planned.contract, fingerprint: planned.fingerprint, stagedAt: new Date().toISOString() };
    try { write(filename, record, true); }
    catch (error) { return fail(error.code === 'EEXIST' ? 'CONTRACT_ID_CONFLICT' : 'CONTRACT_WRITE_FAILED', 'Could not persist the immutable dependency contract.'); }
    return { ...planned, outcome: 'staged', stagedAt: record.stagedAt };
}

function get(params) {
    if (!params || params.creatorVersion !== '2.4.15' || typeof params.projectRoot !== 'string'
        || !path.isAbsolute(params.projectRoot) || !ID.test(params.contractId || ''))
        return fail('INVALID_ARGUMENT', 'Provide an absolute Creator 2.4.15 project path and contractId.');
    let record;
    try { record = JSON.parse(fs.readFileSync(file(path.resolve(params.projectRoot), params.contractId), 'utf8')); }
    catch (error) { return fail(error.code === 'ENOENT' ? 'CONTRACT_NOT_FOUND' : 'CONTRACT_READ_FAILED', 'Dependency contract record is missing or unreadable.'); }
    if (!record.contract || record.contract.contractId !== params.contractId || record.contract.creatorVersion !== params.creatorVersion)
        return fail('CONTRACT_RECORD_MISMATCH', 'Dependency contract identity does not match its record.');
    if (digest(JSON.stringify(record.contract)) !== record.fingerprint)
        return fail('CONTRACT_RECORD_TAMPERED', 'Persisted dependency contract does not match its stored fingerprint.');
    const checked = plan({ projectRoot: params.projectRoot, creatorVersion: params.creatorVersion,
        contractId: record.contract.contractId, buildId: record.contract.buildId, platform: record.contract.platform,
        assetSources: record.contract.assetSources });
    if (!checked.success || checked.fingerprint !== record.fingerprint
        || JSON.stringify(checked.contract) !== JSON.stringify(record.contract))
        return fail('CONTRACT_SOURCE_CHANGED', 'Source asset metadata, bytes, serialized references, or dependency graph changed after staging.');
    return { success: true, outcome: 'read', projectRoot: path.resolve(params.projectRoot), contract: record.contract,
        fingerprint: record.fingerprint, stagedAt: record.stagedAt };
}

function handle(method, params) {
    if (method === 'content.bundle.dependencies.plan') return plan(params);
    if (method === 'content.bundle.dependencies.stage') return stage(params);
    if (method === 'content.bundle.dependencies.get') return get(params);
    return fail('UNKNOWN_METHOD', 'Unknown Bundle dependency contract method.');
}

module.exports = { handle, plan, stage, get, topologicalOrder };
