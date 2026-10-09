'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const contentRelease = require('./content-release');

const releaseIdPattern = /^(?!selected$|effective$)[a-z0-9][a-z0-9._-]{0,63}$/;
const assetIdPattern = /^[a-z][a-z0-9_-]{0,63}$/;
const assetNamePattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i;
const bundleRootPattern = /^assets\/[A-Za-z0-9_-]{1,64}$/;
const bundleNamePattern = /^[a-z][a-z0-9_-]{0,31}$/;
const fail = (code, message, details) => ({ success: false, outcome: 'failed', error: { code, message }, ...(details ? { details } : {}) });
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function validateInput(params) {
    if (!params || params.creatorVersion !== '2.4.15' || typeof params.projectRoot !== 'string'
        || !path.isAbsolute(params.projectRoot) || !releaseIdPattern.test(params.releaseId || '')
        || !bundleRootPattern.test(params.bundleRoot || '') || !bundleNamePattern.test(params.bundleName || '')
        || !assetNamePattern.test(params.entryAssetName || '') || !Array.isArray(params.assets)
        || params.assets.length < 1 || params.assets.length > 16) {
        return fail('INVALID_ARGUMENT', 'Provide an absolute Creator 2.4.15 project, Bundle identity, entry PNG, and 1–16 asset mappings.');
    }
    const names = new Set();
    const ids = new Set();
    for (const item of params.assets) {
        if (!item || Object.keys(item).some((key) => !['assetName', 'id', 'dependsOn'].includes(key))
            || !assetNamePattern.test(item.assetName || '') || names.has(item.assetName.toLowerCase())
            || !assetIdPattern.test(item.id || '') || ids.has(item.id)
            || (item.dependsOn !== undefined && (!Array.isArray(item.dependsOn)
                || item.dependsOn.some((dependency) => !assetIdPattern.test(dependency))
                || new Set(item.dependsOn).size !== item.dependsOn.length))) {
            return fail('INVALID_ASSET_MAPPING', 'Bundle asset mappings need unique PNG names and IDs with valid dependency IDs.');
        }
        names.add(item.assetName.toLowerCase());
        ids.add(item.id);
    }
    if (!names.has(params.entryAssetName.toLowerCase())) return fail('MISSING_ENTRY_ASSET', 'Entry asset must be included in the mappings.');
    return null;
}

function plan(params) {
    const invalid = validateInput(params);
    if (invalid) return invalid;
    const projectRoot = path.resolve(params.projectRoot);
    const assets = [];
    for (const item of params.assets) {
        const source = `${params.bundleRoot}/${item.assetName}`;
        const filename = path.join(projectRoot, ...source.split('/'));
        let bytes;
        try {
            const stat = fs.lstatSync(filename);
            if (!stat.isFile() || stat.isSymbolicLink()) throw Error('not a regular file');
            const allowed = fs.realpathSync(path.join(projectRoot, ...params.bundleRoot.split('/'))) + path.sep;
            if (!fs.realpathSync(filename).startsWith(allowed)) throw Error('source outside Bundle');
            bytes = fs.readFileSync(filename);
        } catch (_) { return fail('ASSET_NOT_READY', `Bundle PNG is missing or unsafe: ${item.assetName}`); }
        const base = path.basename(item.assetName).replace(/\.png$/i, '');
        assets.push({ id: item.id, source, sha256: sha256(bytes), runtimePath: base, dependsOn: item.dependsOn || [] });
    }
    const manifest = { contractVersion: '0.1', releaseId: params.releaseId, creatorVersion: '2.4.15',
        delivery: 'asset-bundle', bundleRoot: params.bundleRoot, bundleName: params.bundleName,
        entryAssetId: params.assets.find((item) => item.assetName.toLowerCase() === params.entryAssetName.toLowerCase()).id,
        assets };
    const checked = contentRelease.validate({ projectRoot, creatorVersion: '2.4.15', manifest });
    if (!checked.success) return fail('BUNDLE_RELEASE_INVALID', 'Bundle folder, imported asset identities, or dependencies failed validation.', checked.error);
    return { success: true, outcome: 'ready', projectRoot, creatorVersion: '2.4.15', bundleName: params.bundleName,
        manifest: checked.release, fingerprint: checked.fingerprint,
        assets: checked.release.assets.map((asset) => ({ id: asset.id, source: asset.source, sha256: asset.sha256,
            textureUuid: asset.resourceUuid, spriteFrameUuid: asset.spriteFrameUuid, runtimePath: asset.runtimePath })) };
}

function stage(params) {
    const planned = plan(params);
    if (!planned.success) return planned;
    const staged = contentRelease.stage({ projectRoot: planned.projectRoot, creatorVersion: '2.4.15', manifest: planned.manifest });
    if (!staged.success) return staged;
    return { ...staged, bundleName: planned.bundleName, manifest: planned.manifest, assets: planned.assets };
}

function handle(method, params) {
    if (method === 'content.bundle.plan') return plan(params);
    if (method === 'content.bundle.stage') return stage(params);
    return fail('UNKNOWN_METHOD', 'Unknown content Bundle release method.');
}

module.exports = { handle, plan, stage };
