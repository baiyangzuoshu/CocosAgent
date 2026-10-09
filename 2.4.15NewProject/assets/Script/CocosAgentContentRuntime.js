// Creator 2.4 runtime adapter. mount() is called after the scene is ready.
(function (root) {
    'use strict';
    function mount(options) {
        options = options || {};
        var cc = options.cc || root.cc;
        var core = options.core || root.CocosAgentContentSwapCore;
        if (!cc || !core) throw Error('COCOS_AGENT_RUNTIME_UNAVAILABLE');
        var scene = options.scene || cc.director.getScene();
        var canvas = scene && scene.getChildByName('Canvas');
        if (!canvas) throw Error('COCOS_AGENT_CANVAS_UNAVAILABLE');
        var node = new cc.Node('CocosAgentContentRuntime');
        node.width = node.height = 240;
        canvas.addChild(node);
        node.setPosition(0, 0);
        var sprite = node.addComponent(cc.Sprite);
        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        function loadAsset(runtimePath, asset, release) {
            if (release && release.delivery === 'asset-bundle') return new Promise(function (resolve, reject) {
                var cached = cc.assetManager.getBundle(release.bundleName);
                var load = function (bundleError, bundle) {
                    if (bundleError) { reject(bundleError); return; }
                    bundle.load(runtimePath, cc.Texture2D, function (assetError, texture) {
                        if (assetError) reject(assetError); else resolve(texture);
                    });
                };
                if (cached) load(null, cached);
                else cc.assetManager.loadBundle(release.bundleName, load);
            });
            return new Promise(function (resolve, reject) {
                cc.resources.load(runtimePath, cc.Texture2D, function (error, texture) {
                    if (error) reject(error); else resolve(texture);
                });
            });
        }
        function removeBundle(bundleName) {
            var bundle = cc.assetManager.getBundle(bundleName);
            if (bundle) cc.assetManager.removeBundle(bundle);
        }
        function releaseBundleAsset(bundleName, runtimePath, expectedUuid) {
            var bundle = cc.assetManager.getBundle(bundleName);
            if (!bundle || typeof bundle.get !== 'function' || typeof bundle.release !== 'function')
                throw Error('BUNDLE_NOT_AVAILABLE');
            var texture = bundle.get(runtimePath, cc.Texture2D);
            if (!texture || texture._uuid !== expectedUuid) throw Error('BUNDLE_RESOURCE_ID_MISMATCH');
            bundle.release(runtimePath, cc.Texture2D);
            var cache = cc.assetManager.assets;
            if (cache && typeof cache.has === 'function' && cache.has(expectedUuid)) throw Error('BUNDLE_ASSET_STILL_CACHED');
            return true;
        }
        function runtimeDiagnostics() {
            var manager = cc.assetManager;
            var assets = manager && manager.assets;
            var bundles = manager && manager.bundles;
            var bundleNames = [];
            if (bundles && typeof bundles.forEach === 'function') {
                bundles.forEach(function (_bundle, name) {
                    if (typeof name === 'string' && name.length <= 64 && bundleNames.length < 32) bundleNames.push(name);
                });
            }
            bundleNames.sort();
            var memory = root.performance && root.performance.memory;
            return {
                sampledAt: new Date().toISOString(),
                assetCacheCount: assets && Number.isInteger(assets.count) ? assets.count : null,
                bundleCacheCount: bundles && Number.isInteger(bundles.count) ? bundles.count : null,
                bundleNames: bundleNames,
                bundleNamesTruncated: !!(bundles && Number.isInteger(bundles.count) && bundles.count > bundleNames.length),
                jsHeap: memory ? {
                    usedBytes: Number.isFinite(memory.usedJSHeapSize) ? memory.usedJSHeapSize : null,
                    totalBytes: Number.isFinite(memory.totalJSHeapSize) ? memory.totalJSHeapSize : null,
                    limitBytes: Number.isFinite(memory.jsHeapSizeLimit) ? memory.jsHeapSizeLimit : null,
                    source: 'performance.memory',
                } : null,
            };
        }
        var runtime = core.create({
            creatorVersion: '2.4.15',
            load: options.load || loadAsset,
            createFrame: function (texture) { return new cc.SpriteFrame(texture); },
            installFrame: function (frame) { sprite.spriteFrame = frame; },
            disposeFrame: function (frame) { frame.destroy(); },
            confirmFrame: function () { return new Promise(function (resolve) {
                cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve);
            }); },
            afterCleanup: function () { return new Promise(function (resolve) {
                cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve);
            }); },
            releaseUnused: function () { cc.assetManager.releaseUnusedAssets(); },
            removeBundle: removeBundle,
            releaseBundleAsset: releaseBundleAsset,
            diagnostics: runtimeDiagnostics,
            isValid: function (asset) { return cc.isValid(asset); },
            isCached: function (asset) {
                var cache = cc.assetManager.assets;
                return !!(cache && typeof cache.has === 'function' && cache.has(asset._uuid));
            },
            assetId: function (asset) { return asset._uuid; },
            report: options.report,
        });
        return {
            apply: runtime.apply,
            snapshot: runtime.snapshot,
            dispose: function () {
                var result = runtime.dispose();
                if (result.outcome === 'disposed' && !result.idempotent) node.destroy();
                return result;
            },
        };
    }
    root.CocosAgentContentRuntime24 = { mount: mount };
    if (typeof module === 'object' && module.exports) module.exports = root.CocosAgentContentRuntime24;
})(typeof globalThis !== 'undefined' ? globalThis : this);
