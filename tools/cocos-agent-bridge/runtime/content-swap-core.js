/* Runtime-only core. Injected after Creator starts; no Node or editor APIs. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.CocosAgentContentSwapCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function create(adapter) {
        if (!adapter || !adapter.creatorVersion || !adapter.load || !adapter.createFrame
            || !adapter.installFrame || !adapter.disposeFrame || !adapter.confirmFrame
            || !adapter.releaseUnused || !adapter.isValid || !adapter.assetId) throw Error('INVALID_ADAPTER');
        let current = null;
        let busy = false;
        let closed = false;
        function receipt(outcome, request, extra) {
            const result = Object.assign({ outcome, releaseId: request && request.releaseId || null,
                assetId: request && request.assetId || null, activeReleaseId: current && current.releaseId || null,
                activeAssetId: current && current.assetId || null,
                activeFingerprint: current && current.fingerprint || null }, extra || {});
            if (adapter.report) try { adapter.report(result); } catch (_) { /* reporting cannot roll back a committed frame */ }
            return result;
        }
        function checked(release, assetId) {
            if (!release || release.contractVersion !== '0.1' || release.creatorVersion !== adapter.creatorVersion
                || release.delivery !== 'built-in-resources' || !release.releaseId || !release.fingerprint
                || !Array.isArray(release.assets)) throw Error('RELEASE_MISMATCH');
            const asset = release.assets.find((item) => item.id === assetId);
            if (!asset || !asset.runtimePath || !asset.resourceUuid) throw Error('ASSET_NOT_IN_RELEASE');
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
                && current.fingerprint === release.fingerprint) return receipt('already-active', request);
            busy = true;
            const previous = current;
            let candidate = null;
            let frame = null;
            let installed = false;
            let owned = false;
            try {
                candidate = await adapter.load(asset.runtimePath);
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
                    assetId, resourceUuid: asset.resourceUuid, texture: candidate, frame };
                try {
                    if (previous) {
                        adapter.disposeFrame(previous.frame);
                        previous.texture.decRef();
                    }
                    adapter.releaseUnused();
                } catch (error) {
                    return receipt('needs-review', request, { code: 'OLD_RESOURCE_CLEANUP_FAILED', cause: String(error),
                        previousReleaseId: previous && previous.releaseId || null });
                }
                return receipt('applied', request, { previousReleaseId: previous && previous.releaseId || null,
                    resourceUuid: current.resourceUuid, currentRefCount: candidate.refCount });
            } catch (error) {
                if (installed) {
                    try { adapter.installFrame(previous ? previous.frame : null); }
                    catch (_) { return receipt('needs-review', request, { code: 'RESTORE_FAILED', cause: String(error) }); }
                }
                if (frame) adapter.disposeFrame(frame);
                if (owned && candidate && adapter.isValid(candidate)) candidate.decRef();
                adapter.releaseUnused();
                return receipt('retained', request, { code: String(error.message || error),
                    retainedReleaseId: previous && previous.releaseId || null });
            } finally { busy = false; }
        }
        function snapshot() { return { busy, closed, activeReleaseId: current && current.releaseId || null,
            activeAssetId: current && current.assetId || null,
            resourceUuid: current && current.resourceUuid || null,
            valid: current ? adapter.isValid(current.texture) : false,
            refCount: current ? current.texture.refCount : null }; }
        function dispose() {
            if (busy) return { outcome: 'rejected', code: 'BUSY' };
            if (closed) return { outcome: 'disposed', idempotent: true };
            adapter.installFrame(null);
            closed = true;
            if (current) { adapter.disposeFrame(current.frame); current.texture.decRef(); current = null; }
            adapter.releaseUnused();
            return { outcome: 'disposed', idempotent: false };
        }
        return { apply, snapshot, dispose };
    }
    return { create };
});
