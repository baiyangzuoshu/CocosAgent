/* Runtime-only core. Injected after Creator starts; no Node or editor APIs. */
(function (root, factory) {
    var value = factory();
    if (typeof module === 'object' && module.exports) module.exports = value;
    root.CocosAgentContentSwapCore = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function create(adapter) {
        if (!adapter || !adapter.creatorVersion || !adapter.load || !adapter.createFrame
            || !adapter.installFrame || !adapter.disposeFrame || !adapter.confirmFrame
            || !adapter.releaseUnused || !adapter.isValid || !adapter.assetId) throw Error('INVALID_ADAPTER');
        let current = null;
        let busy = false;
        let closed = false;
        function runtimeDiagnostics() {
            if (typeof adapter.diagnostics !== 'function') return null;
            try {
                const value = adapter.diagnostics();
                return value && typeof value === 'object' ? value : null;
            } catch (_) { return { available: false }; }
        }
        function assetCached(asset) {
            if (!asset || typeof adapter.isCached !== 'function') return null;
            try { return !!adapter.isCached(asset); } catch (_) { return null; }
        }
        function receipt(outcome, request, extra) {
            const result = Object.assign({ outcome, releaseId: request && request.releaseId || null,
                assetId: request && request.assetId || null, activeReleaseId: current && current.releaseId || null,
                activeAssetId: current && current.assetId || null,
                activeFingerprint: current && current.fingerprint || null }, extra || {});
            const diagnostics = runtimeDiagnostics();
            if (diagnostics) result.runtimeDiagnostics = diagnostics;
            if (adapter.report) try { adapter.report(result); } catch (_) { /* reporting cannot roll back a committed frame */ }
            return result;
        }
        function checked(release, assetId) {
            if (!release || release.contractVersion !== '0.1' || release.creatorVersion !== adapter.creatorVersion
                || !['built-in-resources', 'asset-bundle'].includes(release.delivery)
                || (release.delivery === 'asset-bundle' && (release.creatorVersion !== '2.4.15'
                    || !/^[a-z][a-z0-9_-]{0,31}$/.test(release.bundleName || '')))
                || !release.releaseId || !release.fingerprint
                || !Array.isArray(release.assets)) throw Error('RELEASE_MISMATCH');
            const asset = release.assets.find((item) => item.id === assetId);
            if (!asset || !asset.runtimePath || !asset.resourceUuid) throw Error('ASSET_NOT_IN_RELEASE');
            if (release.delivery === 'asset-bundle' && !/^[a-f0-9-]{36}$/i.test(asset.spriteFrameUuid || ''))
                throw Error('ASSET_NOT_IN_RELEASE');
            return asset;
        }
        async function apply(release, assetId) {
            const request = { releaseId: release && release.releaseId, assetId };
            if (closed) return receipt('rejected', request, { code: 'CLOSED' });
            if (busy) return receipt('rejected', request, { code: 'BUSY' });
            let asset;
            try { asset = checked(release, assetId); }
            catch (error) { return receipt('rejected', request, { code: String(error.message || error) }); }
            if (current && current.releaseId === release.releaseId && current.assetId === assetId
                && current.fingerprint === release.fingerprint) return receipt('already-active', request,
                    { resourceUuid: current.resourceUuid, currentRefCount: current.texture.refCount });
            busy = true;
            const previous = current;
            let candidate = null;
            let frame = null;
            let installed = false;
            let owned = false;
            try {
                candidate = await adapter.load(asset.runtimePath, asset, release);
                if (!candidate || !adapter.isValid(candidate) || adapter.assetId(candidate) !== asset.resourceUuid)
                    throw Error('RESOURCE_ID_MISMATCH');
                candidate.addRef();
                owned = true;
                frame = adapter.createFrame(candidate);
                installed = true;
                adapter.installFrame(frame);
                await adapter.confirmFrame(frame);
                if (!adapter.isValid(candidate)) throw Error('CANDIDATE_INVALID_AFTER_DRAW');
                current = { releaseId: release.releaseId, fingerprint: release.fingerprint,
                    assetId, resourceUuid: asset.resourceUuid, delivery: release.delivery,
                    bundleName: release.bundleName || null, runtimePath: asset.runtimePath, texture: candidate, frame };
                try {
                    if (previous) {
                        adapter.disposeFrame(previous.frame);
                        previous.texture.decRef();
                    }
                    if (previous && previous.delivery === 'asset-bundle' && previous.texture.refCount === 0
                        && adapter.releaseBundleAsset) {
                        adapter.releaseBundleAsset(previous.bundleName, previous.runtimePath, previous.resourceUuid);
                    }
                    adapter.releaseUnused();
                    if (previous && previous.delivery === 'asset-bundle' && previous.bundleName !== release.bundleName
                        && adapter.removeBundle) adapter.removeBundle(previous.bundleName);
                    if (previous && typeof adapter.afterCleanup === 'function') await adapter.afterCleanup();
                } catch (error) {
                    return receipt('needs-review', request, { code: 'OLD_RESOURCE_CLEANUP_FAILED', cause: String(error),
                        previousReleaseId: previous && previous.releaseId || null });
                }
                const previousState = previous ? {
                    previousResourceUuid: previous.resourceUuid,
                    previousAssetRefCount: previous.texture.refCount,
                    previousAssetValid: adapter.isValid(previous.texture),
                    previousAssetCached: assetCached(previous.texture),
                } : {};
                return receipt('applied', request, { previousReleaseId: previous && previous.releaseId || null,
                    ...previousState, resourceUuid: current.resourceUuid, currentRefCount: candidate.refCount });
            } catch (error) {
                if (installed) {
                    try { adapter.installFrame(previous ? previous.frame : null); }
                    catch (_) { return receipt('needs-review', request, { code: 'RESTORE_FAILED', cause: String(error) }); }
                }
                if (frame) adapter.disposeFrame(frame);
                if (owned && candidate && adapter.isValid(candidate)) candidate.decRef();
                adapter.releaseUnused();
                if (release.delivery === 'asset-bundle' && release.bundleName !== (previous && previous.bundleName)
                    && adapter.removeBundle) adapter.removeBundle(release.bundleName);
                return receipt('retained', request, { code: String(error.message || error),
                    retainedReleaseId: previous && previous.releaseId || null });
            } finally { busy = false; }
        }
        function snapshot() { return { busy, closed, activeReleaseId: current && current.releaseId || null,
            activeAssetId: current && current.assetId || null,
            resourceUuid: current && current.resourceUuid || null,
            valid: current ? adapter.isValid(current.texture) : false,
            refCount: current ? current.texture.refCount : null,
            assetCached: current ? assetCached(current.texture) : false, runtimeDiagnostics: runtimeDiagnostics() }; }
        function dispose() {
            if (busy) return { outcome: 'rejected', code: 'BUSY' };
            if (closed) return { outcome: 'disposed', idempotent: true };
            adapter.installFrame(null);
            closed = true;
            const previous = current;
            if (previous) { adapter.disposeFrame(previous.frame); previous.texture.decRef(); current = null; }
            adapter.releaseUnused();
            if (previous && previous.delivery === 'asset-bundle' && adapter.removeBundle) adapter.removeBundle(previous.bundleName);
            return { outcome: 'disposed', idempotent: false };
        }
        return { apply, snapshot, dispose };
    }
    return { create };
});
