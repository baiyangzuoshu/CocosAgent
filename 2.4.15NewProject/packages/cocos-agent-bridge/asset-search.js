'use strict';

const fs = require('fs');
const path = require('path');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function decodeUrl(relativeUrl) {
    try { return decodeURIComponent(relativeUrl); } catch (_) { return relativeUrl; }
}

function metadataFor(item, relativeUrl, assetsRoot) {
    let metadataStatus = 'metadata-unavailable';
    let spriteFrameUuid = null;
    let width = null;
    let height = null;
    const decoded = decodeUrl(relativeUrl);
    try {
        const segments = decoded.split('/');
        if (!decoded || decoded.includes('\\') || segments.some((segment) => !segment || segment === '.' || segment === '..'))
            throw new Error('Asset URL is not a safe project-relative path.');
        const assetPath = path.resolve(assetsRoot, ...segments);
        if (!assetPath.startsWith(`${assetsRoot}${path.sep}`)) throw new Error('Asset path escaped project assets.');
        const realAssetPath = fs.realpathSync(assetPath);
        if (!realAssetPath.startsWith(`${assetsRoot}${path.sep}`)) throw new Error('Asset path resolves outside project assets.');
        const assetStat = fs.lstatSync(assetPath);
        const metaStat = fs.lstatSync(`${assetPath}.meta`);
        if (!assetStat.isFile() || assetStat.isSymbolicLink() || !metaStat.isFile() || metaStat.isSymbolicLink())
            throw new Error('Asset and metadata must be regular files.');
        const meta = JSON.parse(fs.readFileSync(`${assetPath}.meta`, 'utf8'));
        if (meta.importer !== 'texture' || meta.uuid !== item.uuid) metadataStatus = 'identity-mismatch';
        else {
            width = Number.isInteger(meta.width) && meta.width > 0 ? meta.width : null;
            height = Number.isInteger(meta.height) && meta.height > 0 ? meta.height : null;
            const frames = Object.values(meta.subMetas || {}).filter((sub) => sub && sub.importer === 'sprite-frame');
            if (frames.length === 1 && frames[0].rawTextureUuid === item.uuid && UUID_PATTERN.test(frames[0].uuid || '')) {
                spriteFrameUuid = frames[0].uuid;
                metadataStatus = 'valid';
            } else metadataStatus = 'sprite-frame-unavailable';
        }
    } catch (_) { metadataStatus = 'metadata-unavailable'; }
    return { name: path.posix.basename(decoded), url: item.url, type: 'texture', textureUuid: item.uuid,
        spriteFrameUuid, width, height, metadataStatus };
}

function searchPngAssets(assetDb, projectAssetsRoot, search, callback) {
    if (!assetDb || typeof assetDb.queryAssets !== 'function') {
        callback(failure('ASSETDB_UNAVAILABLE', 'Editor.assetdb.queryAssets is unavailable.'));
        return;
    }
    let assetsRoot;
    try { assetsRoot = fs.realpathSync(projectAssetsRoot); }
    catch (error) { callback(failure('ASSET_QUERY_FAILED', error.message)); return; }
    const query = search.query.toLocaleLowerCase();
    try {
        assetDb.queryAssets('db://assets/**/*', 'texture', (error, results) => {
            if (error || !Array.isArray(results)) {
                callback(failure('ASSET_QUERY_FAILED', error && error.message || 'AssetDB returned no result list.'));
                return;
            }
            try {
                const matches = results.filter((item) => item && item.isSubAsset !== true && item.type === 'texture'
                    && typeof item.url === 'string' && item.url.startsWith('db://assets/') && /\.png$/i.test(item.url)
                    && typeof item.uuid === 'string' && UUID_PATTERN.test(item.uuid))
                    .map((item) => ({ item, relativeUrl: item.url.slice('db://assets/'.length) }))
                    .filter(({ relativeUrl }) => {
                        const decoded = decodeUrl(relativeUrl);
                        return `${decoded} ${path.posix.basename(decoded)}`.toLocaleLowerCase().includes(query);
                    })
                    .sort((left, right) => left.item.url.localeCompare(right.item.url));
                const total = matches.length;
                const items = matches.slice(search.offset, search.offset + search.limit)
                    .map(({ item, relativeUrl }) => metadataFor(item, relativeUrl, assetsRoot));
                callback(null, { query: search.query, total, offset: search.offset, limit: search.limit,
                    nextOffset: search.offset + items.length < total ? search.offset + items.length : null, items });
            } catch (queryError) { callback(failure('ASSET_QUERY_FAILED', queryError.message)); }
        });
    } catch (error) { callback(failure('ASSET_QUERY_FAILED', error.message)); }
}

module.exports = { searchPngAssets };
