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
        var dependencySequence = 0;
        var dependencyLeases = {};
        var dependencyBusy = 0;
        var dependencyListenerAttached = false;
        function currentSceneUuid() {
            var active = cc.director && cc.director.getScene && cc.director.getScene();
            return active && (active._id || active.uuid) || null;
        }
        function bundleByName(name) { return cc.assetManager.getBundle(name); }
        function loadBundle(name) {
            return new Promise(function (resolve, reject) {
                var existing = bundleByName(name);
                if (existing) {
                    if (existing.name !== name) { reject(Error('DEPENDENCY_BUNDLE_IDENTITY_MISMATCH')); return; }
                    resolve(existing); return;
                }
                cc.assetManager.loadBundle(name, function (error, bundle) {
                    if (error) { reject(error); return; }
                    if (!bundle || bundle.name !== name || bundleByName(name) !== bundle) {
                        reject(Error('DEPENDENCY_BUNDLE_IDENTITY_MISMATCH')); return;
                    }
                    resolve(bundle);
                });
            });
        }
        function consumerForScene(contract, sceneUuid) {
            var matches = {};
            (contract.references || []).forEach(function (reference) {
                if (reference.sceneUuid === sceneUuid) matches[reference.consumerDeliveryId] = true;
            });
            var ids = Object.keys(matches);
            if (ids.length > 1) throw Error('DEPENDENCY_CONSUMER_AMBIGUOUS');
            return ids[0] || null;
        }
        function dependencyClosure(contract, consumerId) {
            var deliveries = {};
            (contract.deliveries || []).forEach(function (delivery) { deliveries[delivery.id] = delivery; });
            var ids = {};
            function visit(id) {
                if (ids[id]) return;
                var delivery = deliveries[id];
                if (!delivery) throw Error('DEPENDENCY_DELIVERY_MISSING');
                ids[id] = true;
                (delivery.dependsOn || []).forEach(visit);
            }
            if (consumerId) visit(consumerId);
            else (contract.assets || []).forEach(function (item) { visit(item.ownerDeliveryId); });
            return { deliveries: deliveries, ids: ids };
        }
        function cacheState(contract) {
            var cache = cc.assetManager.assets;
            var result = [];
            (contract.assets || []).forEach(function (item) {
                var object = cache && typeof cache.get === 'function' ? cache.get(item.uuid) : null;
                var cached = !!(cache && typeof cache.has === 'function' && cache.has(item.uuid));
                result.push({ uuid: item.uuid, cached: cached, valid: object ? cc.isValid(object) : null,
                    refCount: object && Number.isFinite(object.refCount) ? object.refCount : null });
            });
            return result;
        }
        function activeConsumerForLease(lease, sceneUuid) {
            return !!(lease.consumerSceneUuids && lease.consumerSceneUuids.indexOf(sceneUuid) >= 0);
        }
        function detachDependencyListenerIfIdle() {
            if (Object.keys(dependencyLeases).length || !dependencyListenerAttached) return;
            if (cc.director && typeof cc.director.off === 'function' && cc.Director && cc.Director.EVENT_AFTER_SCENE_LAUNCH)
                cc.director.off(cc.Director.EVENT_AFTER_SCENE_LAUNCH, sweepDependencyLeases);
            dependencyListenerAttached = false;
        }
        function sweepDependencyLeases() {
            var sceneUuid = currentSceneUuid();
            Object.keys(dependencyLeases).forEach(function (id) {
                var lease = dependencyLeases[id];
                if (!lease.releaseRequested || activeConsumerForLease(lease, sceneUuid)) return;
                var ownerIds = lease.unloadOrder.filter(function (deliveryId) {
                    var delivery = lease.contract.deliveries.find(function (item) { return item.id === deliveryId; });
                    return delivery && delivery.role === 'owner';
                });
                for (var otherId in dependencyLeases) {
                    var otherLease = dependencyLeases[otherId];
                    if (otherId !== id && !otherLease.releaseRequested
                        && ownerIds.some(function (ownerId) { return otherLease.loadOrder.indexOf(ownerId) >= 0; })) return;
                }
                if (dependencyBusy) return;
                cc.assetManager.releaseUnusedAssets();
                var states = cacheState(lease.contract);
                if (states.some(function (state) { return state.cached || (state.refCount !== null && state.refCount > 0); })) {
                    lease.receipt = { outcome: 'OWNER_RELEASE_DEFERRED', reason: 'contract assets remain cached or referenced after non-forced releaseUnusedAssets',
                        consumerDeliveryId: lease.consumerDeliveryId, activeSceneUuid: sceneUuid, assets: states };
                    return;
                }
                delete dependencyLeases[id];
                lease.receipt = { outcome: 'released', consumerDeliveryId: lease.consumerDeliveryId,
                    activeSceneUuid: sceneUuid, assets: states, loadOrder: lease.loadOrder,
                    unloadOrder: lease.unloadOrder, ownerBundleRetained: true };
            });
            detachDependencyListenerIfIdle();
        }
        function acquireDependencies(contract, asset) {
            if (!contract || contract.schema !== 'cocos.asset-bundle-dependency' || contract.version !== '0.2'
                || contract.creatorVersion !== '2.4.15' || contract.platform !== 'web-mobile'
                || !Array.isArray(contract.assets) || !contract.assets.length || !Array.isArray(contract.deliveries)
                || !Array.isArray(contract.references) || !Array.isArray(contract.loadOrder)
                || !Array.isArray(contract.unloadOrder)) return Promise.reject(Error('DEPENDENCY_CONTRACT_INVALID'));
            var sceneUuid = currentSceneUuid();
            var consumerId;
            var closure;
            try {
                consumerId = consumerForScene(contract, sceneUuid);
                closure = dependencyClosure(contract, consumerId);
            } catch (error) { return Promise.reject(error); }
            var required = contract.loadOrder.filter(function (id) { return closure.ids[id]; });
            if (!required.length || Object.keys(closure.ids).some(function (id) { return required.indexOf(id) < 0; }))
                return Promise.reject(Error('DEPENDENCY_LOAD_ORDER_INVALID'));
            if (!dependencyListenerAttached && cc.director && typeof cc.director.on === 'function'
                && cc.Director && cc.Director.EVENT_AFTER_SCENE_LAUNCH) {
                cc.director.on(cc.Director.EVENT_AFTER_SCENE_LAUNCH, sweepDependencyLeases);
                dependencyListenerAttached = true;
            }
            dependencyBusy += 1;
            return required.reduce(function (promise, id) {
                return promise.then(function () {
                    var delivery = closure.deliveries[id];
                    if (delivery.kind === 'main') return;
                    return loadBundle(delivery.bundleName);
                });
            }, Promise.resolve()).then(function () {
                if (currentSceneUuid() !== sceneUuid) throw Error('DEPENDENCY_SCENE_CHANGED');
                var id = 'lease-' + (++dependencySequence);
                var matchingSceneUuids = (contract.references || []).filter(function (reference) {
                    return reference.consumerDeliveryId === consumerId;
                }).map(function (reference) { return reference.sceneUuid; });
                var activeScene = cc.director && cc.director.getScene && cc.director.getScene();
                var activeConsumerCount = Object.keys(dependencyLeases).filter(function (leaseId) {
                    return !dependencyLeases[leaseId].releaseRequested
                        && dependencyLeases[leaseId].consumerDeliveryId === consumerId;
                }).length + 1;
                var lease = { id: id, contract: contract, consumerDeliveryId: consumerId,
                    consumerSceneUuids: matchingSceneUuids, assetUuid: asset && asset.resourceUuid || null,
                    loadOrder: required, unloadOrder: contract.unloadOrder.filter(function (name) { return closure.ids[name]; }),
                    releaseRequested: false, receipt: { outcome: 'acquired', contractId: contract.contractId,
                        buildId: contract.buildId, activeSceneUuid: sceneUuid, consumerDeliveryId: consumerId,
                        ownerDeliveryIds: required.filter(function (deliveryId) { return closure.deliveries[deliveryId].role === 'owner'; }),
                        loadOrder: required, ownerLoaded: required.filter(function (deliveryId) { return closure.deliveries[deliveryId].role === 'owner'; })
                            .every(function (deliveryId) { return !!bundleByName(closure.deliveries[deliveryId].bundleName); }),
                        consumerLoaded: consumerId ? (closure.deliveries[consumerId].kind === 'main'
                            ? matchingSceneUuids.indexOf(sceneUuid) >= 0
                            : !!bundleByName(closure.deliveries[consumerId].bundleName)) : null,
                        consumerSceneAlreadyActive: !!consumerId && matchingSceneUuids.indexOf(sceneUuid) >= 0,
                        candidateAssetUuid: asset && asset.resourceUuid || null,
                        candidateAssetInDependencyContract: !!(asset && contract.assets.some(function (item) {
                            return item.type === 'cc.Texture2D' && item.uuid === asset.resourceUuid;
                        })),
                        redirectTargets: contract.references.filter(function (reference) { return reference.consumerDeliveryId === consumerId; })
                            .map(function (reference) { return { assetUuid: reference.assetUuid,
                                ownerDeliveryId: (contract.assets.find(function (item) { return item.uuid === reference.assetUuid; }) || {}).ownerDeliveryId || null }; }),
                        activeConsumers: activeConsumerCount,
                        autoReleaseAssets: activeScene && typeof activeScene.autoReleaseAssets === 'boolean'
                            ? activeScene.autoReleaseAssets : null,
                        protectedAssetUuids: contract.assets.map(function (item) { return item.uuid; }), assets: cacheState(contract) } };
                dependencyLeases[id] = lease;
                return lease;
            }).then(function (value) {
                dependencyBusy -= 1;
                return value;
            }, function (error) {
                dependencyBusy -= 1;
                detachDependencyListenerIfIdle();
                throw error;
            });
        }
        function releaseDependencies(lease) {
            if (!lease || !dependencyLeases[lease.id]) return lease && lease.receipt || { outcome: 'already-released' };
            lease.releaseRequested = true;
            sweepDependencyLeases();
            if (lease.receipt && lease.receipt.outcome === 'acquired') lease.receipt = {
                outcome: 'OWNER_RELEASE_DEFERRED', reason: 'active consumer scene or tracked lease still uses this dependency',
                contractId: lease.contract.contractId, consumerDeliveryId: lease.consumerDeliveryId,
                activeSceneUuid: currentSceneUuid(), loadOrder: lease.loadOrder,
                unloadOrder: lease.unloadOrder, assets: cacheState(lease.contract),
                activeConsumers: Object.keys(dependencyLeases).filter(function (id) {
                    return !dependencyLeases[id].releaseRequested
                        && dependencyLeases[id].consumerDeliveryId === lease.consumerDeliveryId;
                }).length,
                autoReleaseAssets: cc.director.getScene() && typeof cc.director.getScene().autoReleaseAssets === 'boolean'
                    ? cc.director.getScene().autoReleaseAssets : null };
            return lease.receipt;
        }
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
            acquireDependencies: acquireDependencies,
            releaseDependencies: releaseDependencies,
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
