'use strict';

const MAX_DIAGNOSTIC_ASSET_UUIDS = 512;
const MAX_DIAGNOSTIC_ASSET_VISITS = 20000;
const MAX_DIAGNOSTIC_ARRAY_ITEMS = 256;
const MAX_DIAGNOSTIC_OBJECT_KEYS = 128;

function collectDiagnosticAssetUuids(value) {
    const assetUuids = new Set();
    const seen = new WeakSet();
    let visits = 0;
    let complete = true;
    let halted = false;

    function visit(current, depth) {
        if (current === null || current === undefined || typeof current !== 'object' || halted) return;
        if (depth > 6) {
            complete = false;
            return;
        }
        if (visits >= MAX_DIAGNOSTIC_ASSET_VISITS) {
            complete = false;
            halted = true;
            return;
        }
        if (seen.has(current)) {
            return;
        }
        seen.add(current);
        visits += 1;
        if (Array.isArray(current)) {
            if (current.length > MAX_DIAGNOSTIC_ARRAY_ITEMS) complete = false;
            for (const item of current.slice(0, MAX_DIAGNOSTIC_ARRAY_ITEMS)) visit(item, depth + 1);
            return;
        }
        if (typeof current.assetUuid === 'string' && current.assetUuid) {
            if (!assetUuids.has(current.assetUuid) && assetUuids.size >= MAX_DIAGNOSTIC_ASSET_UUIDS) {
                complete = false;
                halted = true;
                return;
            }
            assetUuids.add(current.assetUuid);
        }
        const keys = Object.keys(current);
        if (keys.length > MAX_DIAGNOSTIC_OBJECT_KEYS) complete = false;
        for (const key of keys.slice(0, MAX_DIAGNOSTIC_OBJECT_KEYS)) visit(current[key], depth + 1);
    }

    visit(value, 0);
    return { assetUuids, complete, visitedObjects: visits };
}

function queryDiagnosticAssets(assetUuids, assetdb, inputComplete = true) {
    const requested = [];
    const seen = new Set();
    let requestedCount = 0;
    let requestedCountTruncated = false;
    let inputVisits = 0;
    for (const uuid of assetUuids || []) {
        if (++inputVisits > MAX_DIAGNOSTIC_ASSET_VISITS) {
            inputComplete = false;
            requestedCountTruncated = true;
            break;
        }
        if (seen.has(uuid)) continue;
        seen.add(uuid);
        requestedCount += 1;
        if (requested.length < MAX_DIAGNOSTIC_ASSET_UUIDS) requested.push(uuid);
        else {
            inputComplete = false;
            requestedCountTruncated = true;
            break;
        }
    }
    const assets = [];
    const unresolvedUuids = [];
    const failedUuids = [];
    if (!assetdb || typeof assetdb.assetInfoByUuid !== 'function') {
        return { available: false, complete: false, reason: 'ASSETDB_UUID_QUERY_UNAVAILABLE',
            requestedCount, requestedCountTruncated, assets, unresolvedUuids, failedUuids };
    }

    for (const uuid of requested) {
        try {
            const info = assetdb.assetInfoByUuid(uuid);
            if (!info) {
                unresolvedUuids.push(uuid);
                continue;
            }
            if (typeof info.uuid !== 'string' || info.uuid !== uuid
                || typeof info.url !== 'string' || typeof info.type !== 'string') {
                failedUuids.push(uuid);
                continue;
            }
            assets.push({ uuid, url: info.url, type: info.type,
                importer: typeof info.importer === 'string' ? info.importer : null });
        } catch (_) {
            failedUuids.push(uuid);
        }
    }

    const complete = inputComplete && !requestedCountTruncated && failedUuids.length === 0;
    return { available: true, complete,
        ...(failedUuids.length ? { reason: 'ASSETDB_QUERY_FAILED' } : {}),
        requestedCount, requestedCountTruncated, assets, unresolvedUuids, failedUuids };
}

module.exports = { collectDiagnosticAssetUuids, queryDiagnosticAssets,
    MAX_DIAGNOSTIC_ASSET_UUIDS, MAX_DIAGNOSTIC_ASSET_VISITS };
