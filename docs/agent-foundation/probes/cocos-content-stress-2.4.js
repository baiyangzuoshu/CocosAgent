(function (root) {
    'use strict';

    function now() { return root.performance && typeof root.performance.now === 'function' ? root.performance.now() : Date.now(); }
    function round(value) { return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null; }
    function percentile(values, fraction) {
        if (!values.length) return null;
        var sorted = values.slice().sort(function (a, b) { return a - b; });
        return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
    }
    function summary(values) {
        if (!values.length) return { count: 0, minMs: null, p50Ms: null, p95Ms: null, maxMs: null, meanMs: null };
        var sum = values.reduce(function (total, value) { return total + value; }, 0);
        return { count: values.length, minMs: round(Math.min.apply(Math, values)),
            p50Ms: round(percentile(values, 0.5)), p95Ms: round(percentile(values, 0.95)),
            maxMs: round(Math.max.apply(Math, values)), meanMs: round(sum / values.length) };
    }
    function evaluateBudgets(result, budgets) {
        budgets = budgets || {};
        var checks = [];
        function add(name, limit, observed) {
            if (!Number.isFinite(limit)) return;
            checks.push({ metric: name, limitMs: round(limit), observedMs: observed,
                status: !Number.isFinite(observed) ? 'unobserved' : observed <= limit ? 'passed' : 'exceeded',
                passed: Number.isFinite(observed) && observed <= limit });
        }
        if (Number.isFinite(budgets.targetFps) && budgets.targetFps > 0)
            add('frameIntervalP95', 1000 / budgets.targetFps, result.frame.intervalMs.p95Ms);
        add('resourceLoadTotalP95', budgets.maxResourceLoadP95Ms, result.timings.resourceLoadTotalMs.p95Ms);
        add('importDeserializeParserP95', budgets.maxImportParserP95Ms,
            result.parse.samplesByType.import && result.parse.samplesByType.import.duration.p95Ms);
        add('pngImageParserP95', budgets.maxPngParserP95Ms,
            result.parse.samplesByType['.png'] && result.parse.samplesByType['.png'].duration.p95Ms);
        add('releaseCallP95', budgets.maxReleaseCallP95Ms, result.timings.releaseCallMs.p95Ms);
        var hasExceeded = checks.some(function (check) { return check.status === 'exceeded'; });
        var hasUnobserved = checks.some(function (check) { return check.status === 'unobserved'; });
        return { verdict: !checks.length ? 'not-set' : hasExceeded ? 'exceeded' : hasUnobserved ? 'insufficient-data' : 'passed',
            checks: checks };
    }
    function validBudgets(budgets) {
        return !!budgets && typeof budgets === 'object'
            && Number.isFinite(budgets.targetFps) && budgets.targetFps >= 1 && budgets.targetFps <= 360
            && Number.isFinite(budgets.maxResourceLoadP95Ms) && budgets.maxResourceLoadP95Ms >= 0.01 && budgets.maxResourceLoadP95Ms <= 60000
            && Number.isFinite(budgets.maxImportParserP95Ms) && budgets.maxImportParserP95Ms >= 0.01 && budgets.maxImportParserP95Ms <= 60000
            && Number.isFinite(budgets.maxPngParserP95Ms) && budgets.maxPngParserP95Ms >= 0.01 && budgets.maxPngParserP95Ms <= 60000
            && Number.isFinite(budgets.maxReleaseCallP95Ms) && budgets.maxReleaseCallP95Ms >= 0.01 && budgets.maxReleaseCallP95Ms <= 60000;
    }
    function onceAfterDraw(cc, timeoutMs) {
        return new Promise(function (resolve, reject) {
            var settled = false;
            var finish = function (error) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                cc.director.off(cc.Director.EVENT_AFTER_DRAW, onDraw);
                if (error) reject(error); else resolve(now());
            };
            var onDraw = function () { finish(null); };
            var timer = setTimeout(function () { finish(Error('AFTER_DRAW_TIMEOUT')); }, timeoutMs || 5000);
            cc.director.once(cc.Director.EVENT_AFTER_DRAW, onDraw);
        });
    }
    function loadTexture(cc, path) {
        return new Promise(function (resolve, reject) {
            cc.resources.load(path, cc.Texture2D, function (error, texture) {
                if (error) reject(error); else resolve(texture);
            });
        });
    }
    function preloadTexture(cc, path) {
        return new Promise(function (resolve, reject) {
            cc.resources.preload(path, cc.Texture2D, function (error) {
                if (error) reject(error); else resolve();
            });
        });
    }
    function cacheSnapshot(cc, texture) {
        var cache = cc.assetManager.assets;
        var uuid = texture && texture._uuid || null;
        return {
            resourceUuid: uuid,
            refCount: texture && Number.isFinite(texture.refCount) ? texture.refCount : null,
            packable: texture && typeof texture.packable === 'boolean' ? texture.packable : null,
            valid: !!(texture && cc.isValid(texture)),
            cached: !!(uuid && cache && typeof cache.has === 'function' && cache.has(uuid)),
            assetCacheCount: cache && Number.isInteger(cache.count) ? cache.count : null,
            bundleCacheCount: cc.assetManager.bundles && Number.isInteger(cc.assetManager.bundles.count)
                ? cc.assetManager.bundles.count : null,
            dynamicAtlasEnabled: cc.dynamicAtlasManager && typeof cc.dynamicAtlasManager.enabled === 'boolean'
                ? cc.dynamicAtlasManager.enabled : null,
            jsHeapUsedBytes: root.performance && root.performance.memory
                && Number.isFinite(root.performance.memory.usedJSHeapSize)
                ? root.performance.memory.usedJSHeapSize : null,
        };
    }
    function parserTap(cc) {
        var parser = cc.assetManager && cc.assetManager.parser;
        if (!parser || typeof parser.parse !== 'function') return { available: false, samples: [], restore: function () {} };
        var original = parser.parse;
        var samples = [];
        parser.parse = function (id, file, type, options, callback) {
            if (typeof callback !== 'function') return original.apply(this, arguments);
            var started = now();
            var self = this;
            var args = arguments;
            return original.call(self, id, file, type, options, function (error, value) {
                samples.push({ parserType: type, id: typeof id === 'string' ? id : String(id),
                    durationMs: round(now() - started), success: !error });
                callback(error, value);
            });
        };
        return { available: true, samples: samples, restore: function () { parser.parse = original; } };
    }

    async function run(options) {
        options = options || {};
        var cycles = options.cycles === undefined ? 48 : options.cycles;
        var nodeCount = options.nodeCount === undefined ? 32 : options.nodeCount;
        var packable = options.packable === undefined ? true : options.packable;
        var paths = options.paths || ['cocos-agent-batch-red', 'cocos-agent-batch-blue'];
        var parseFixturePaths = options.parseFixturePaths || [];
        var failurePath = options.failurePath;
        var resourceUuids = options.resourceUuids || {};
        if (!Number.isInteger(cycles) || cycles < 4 || cycles > 256
            || !Number.isInteger(nodeCount) || nodeCount < 1 || nodeCount > 1024
            || typeof packable !== 'boolean'
            || !Array.isArray(paths) || paths.length < 2 || paths.length > 16
            || !paths.every(function (path) { return typeof path === 'string' && /^[A-Za-z0-9_-]{1,64}(?:\/[A-Za-z0-9_-]{1,64}){0,7}$/.test(path); })
            || new Set(paths).size !== paths.length
            || !Array.isArray(parseFixturePaths) || parseFixturePaths.length < 2 || parseFixturePaths.length > 16
            || !parseFixturePaths.every(function (path) { return typeof path === 'string' && /^[A-Za-z0-9_-]{1,64}(?:\/[A-Za-z0-9_-]{1,64}){0,7}$/.test(path); })
            || new Set(parseFixturePaths).size !== parseFixturePaths.length
            || parseFixturePaths.some(function (path) { return paths.indexOf(path) !== -1; })
            || typeof failurePath !== 'string' || parseFixturePaths.indexOf(failurePath) === -1
            || !resourceUuids[failurePath] || !validBudgets(options.budgets)) {
            throw Error('INVALID_STRESS_OPTIONS');
        }
        if (root.__cocosAgentStress24Running) throw Error('STRESS_ALREADY_RUNNING');
        var cc = root.cc;
        if (!cc || !cc.director || !cc.assetManager || !cc.resources) throw Error('CREATOR_RUNTIME_UNAVAILABLE');
        var scene = cc.director.getScene();
        var canvas = scene && scene.getChildByName('Canvas');
        if (!canvas) throw Error('CANVAS_UNAVAILABLE');
        if (canvas.getChildByName('CocosAgentStressProbe')) throw Error('STRESS_NODE_ALREADY_EXISTS');

        var rootNode = null;
        var sprites = [];
        var active = null;
        var tap = parserTap(cc);
        var frameIntervals = [];
        var lastDrawAt = null;
        var loadMs = [];
        var preloadMs = [];
        var parserFixtureLoadMs = [];
        var parserFixtureReadback = [];
        var createFrameMs = [];
        var nodeMutationMs = [];
        var spriteFrameInstallMs = [];
        var visibleDrawWaitMs = [];
        var releaseCallMs = [];
        var releaseObservedMs = [];
        var cyclesTrace = [];
        var ownerReferenceReleases = [];
        var failure = null;
        var cleanup = null;
        var errors = [];
        root.__cocosAgentStress24Running = true;
        root.__cocosAgentStress24State = { phase: 'starting', cycle: 0 };
        function captureGate(phase, details) {
            root.__cocosAgentStress24State = Object.assign({ phase: phase }, details || {});
            return new Promise(function (resolve) {
                var settled = false;
                var timer = setTimeout(finish, 500);
                function finish() {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    root.__cocosAgentStress24Continue = null;
                    resolve();
                }
                root.__cocosAgentStress24Continue = finish;
            });
        }
        var onAfterDraw = function () {
            var current = now();
            if (lastDrawAt !== null) frameIntervals.push(current - lastDrawAt);
            lastDrawAt = current;
        };
        var beforeCacheCount = cc.assetManager.assets && cc.assetManager.assets.count;
        function cacheLookup(path) {
            var uuid = resourceUuids[path];
            var cache = cc.assetManager.assets;
            var asset = uuid && cache && typeof cache.get === 'function' ? cache.get(uuid) : null;
            return { path: path, expectedUuid: uuid || null, cachedBeforeOrAfterPreload: !!asset,
                refCount: asset && Number.isFinite(asset.refCount) ? asset.refCount : null,
                valid: !!(asset && cc.isValid(asset)) };
        }

        function loadMeasured(path) {
            var started = now();
            return loadTexture(cc, path).then(function (texture) {
                var duration = now() - started;
            if (resourceUuids[path] && texture._uuid !== resourceUuids[path]) throw Error('RESOURCE_UUID_MISMATCH:' + path);
                loadMs.push(duration);
                return { texture: texture, durationMs: duration };
            });
        }
        function replaceSprites(frame, cycleIndex) {
            var startInstall = now();
            sprites.forEach(function (entry) { entry.sprite.spriteFrame = frame; });
            spriteFrameInstallMs.push(now() - startInstall);
            var startUpdate = now();
            var phase = cycleIndex * 0.17;
            sprites.forEach(function (entry, index) {
                entry.node.setPosition(entry.baseX + Math.sin(phase + index * 0.13) * 8,
                    entry.baseY + Math.cos(phase + index * 0.11) * 8);
                var scale = 1 + ((cycleIndex + index) % 4) * 0.015;
                entry.node.setScale(scale, scale);
            });
            nodeMutationMs.push(now() - startUpdate);
        }
        function currentReadback() {
            return { texture: cacheSnapshot(cc, active && active.texture),
                spriteCount: sprites.length,
                allSpritesUseActiveFrame: !!active && sprites.every(function (entry) { return entry.sprite.spriteFrame === active.frame; }) };
        }

        cc.director.on(cc.Director.EVENT_AFTER_DRAW, onAfterDraw);
        try {
            rootNode = new cc.Node('CocosAgentStressProbe');
            canvas.addChild(rootNode);
            var visible = cc.view && cc.view.getVisibleSize ? cc.view.getVisibleSize() : { width: 640, height: 480 };
            var columns = Math.ceil(Math.sqrt(nodeCount));
            var spacing = Math.min(40, Math.max(18, Math.floor(Math.min(visible.width, visible.height) / Math.max(4, columns))));
            var rows = Math.ceil(nodeCount / columns);
            for (var i = 0; i < nodeCount; i++) {
                var node = new cc.Node('AgentStressSprite_' + i);
                node.width = node.height = spacing * 0.75;
                rootNode.addChild(node);
                var sprite = node.addComponent(cc.Sprite);
                sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
                var column = i % columns;
                var row = Math.floor(i / columns);
                var baseX = (column - (columns - 1) / 2) * spacing;
                var baseY = ((rows - 1) / 2 - row) * spacing;
                node.setPosition(baseX, baseY);
                sprites.push({ node: node, sprite: sprite, baseX: baseX, baseY: baseY });
            }

        var measuredPaths = paths.concat(parseFixturePaths);
        var resourceCacheBeforePreload = measuredPaths.map(cacheLookup);
            var preloadSamplesStart = tap.samples.length;
        for (var pathIndex = 0; pathIndex < measuredPaths.length; pathIndex++) {
                var preloadStart = now();
            await preloadTexture(cc, measuredPaths[pathIndex]);
                preloadMs.push(now() - preloadStart);
            }
            var preloadParseSamples = tap.samples.slice(preloadSamplesStart);
        var resourceCacheAfterPreload = measuredPaths.map(cacheLookup);
        for (var fixtureIndex = 0; fixtureIndex < parseFixturePaths.length; fixtureIndex++) {
            var fixturePath = parseFixturePaths[fixtureIndex];
            var fixtureStarted = now();
            var fixtureTexture = await loadTexture(cc, fixturePath);
            var fixtureLoadMs = now() - fixtureStarted;
            if (resourceUuids[fixturePath] && fixtureTexture._uuid !== resourceUuids[fixturePath])
                throw Error('RESOURCE_UUID_MISMATCH:' + fixturePath);
            parserFixtureLoadMs.push(fixtureLoadMs);
            var fixtureRefCountBeforeOwner = fixtureTexture.refCount;
            fixtureTexture.addRef();
            fixtureTexture.decRef();
            cc.assetManager.releaseUnusedAssets();
            await onceAfterDraw(cc);
            var fixtureAfterRelease = cacheSnapshot(cc, fixtureTexture);
            parserFixtureReadback.push({ path: fixturePath, uuid: fixtureTexture._uuid,
                loadMs: round(fixtureLoadMs), refCountBeforeOwner: fixtureRefCountBeforeOwner,
                final: fixtureAfterRelease, released: fixtureAfterRelease.refCount === 0
                    && !fixtureAfterRelease.valid && !fixtureAfterRelease.cached });
        }

            var initial = await loadMeasured(paths[0]);
            var initialRefCountBeforeOwner = initial.texture.refCount;
            initial.texture.addRef();
            var initialRefCountAfterOwner = initial.texture.refCount;
            if (typeof initial.texture.packable === 'boolean') initial.texture.packable = packable;
            var frameStarted = now();
            var initialFrame = new cc.SpriteFrame(initial.texture);
            createFrameMs.push(now() - frameStarted);
            active = { path: paths[0], texture: initial.texture, frame: initialFrame };
            var initialInstallStarted = now();
            replaceSprites(active.frame, 0);
            await onceAfterDraw(cc);
            visibleDrawWaitMs.push(now() - initialInstallStarted);
            await onceAfterDraw(cc);

            for (var cycle = 1; cycle <= cycles; cycle++) {
                root.__cocosAgentStress24State = { phase: 'cycle', cycle: cycle };
                var nextPath = paths[cycle % paths.length];
                var loaded = await loadMeasured(nextPath);
                var refCountBeforeOwner = loaded.texture.refCount;
                loaded.texture.addRef();
                var refCountAfterOwner = loaded.texture.refCount;
                if (typeof loaded.texture.packable === 'boolean') loaded.texture.packable = packable;
                var frameStart = now();
                var nextFrame = new cc.SpriteFrame(loaded.texture);
                createFrameMs.push(now() - frameStart);
                var previous = active;
                active = { path: nextPath, texture: loaded.texture, frame: nextFrame };
                var installStarted = now();
                replaceSprites(nextFrame, cycle);
                var installAndMutationMs = now() - installStarted;
                var drawStarted = now();
                await onceAfterDraw(cc);
                visibleDrawWaitMs.push(now() - drawStarted);

                var previousBeforeRelease = cacheSnapshot(cc, previous.texture);
                var releaseStarted = now();
                previous.frame.destroy();
                previous.texture.decRef();
                cc.assetManager.releaseUnusedAssets();
                releaseCallMs.push(now() - releaseStarted);
                var releaseObservedStart = now();
                await onceAfterDraw(cc);
                var releaseObservedDuration = now() - releaseObservedStart;
                releaseObservedMs.push(releaseObservedDuration);
                var previousRead = cacheSnapshot(cc, previous.texture);
                ownerReferenceReleases.push({ cycle: cycle, beforeRefCount: previousBeforeRelease.refCount,
                    afterRefCount: previousRead.refCount,
                    ownerReferenceDelta: previousBeforeRelease.refCount === null || previousRead.refCount === null
                        ? null : previousBeforeRelease.refCount - previousRead.refCount });
                cyclesTrace.push({ cycle: cycle, path: nextPath, resourceUuid: loaded.texture._uuid,
                    resourceRefCountBeforeOwner: refCountBeforeOwner, resourceRefCountAfterOwner: refCountAfterOwner,
                    loadMs: round(loaded.durationMs), createFrameMs: round(createFrameMs[createFrameMs.length - 1]),
                    frameInstallAndNodeMutationMs: round(installAndMutationMs),
                    spriteFrameInstallMs: round(spriteFrameInstallMs[spriteFrameInstallMs.length - 1]),
                    nodeMutationMs: round(nodeMutationMs[nodeMutationMs.length - 1]),
                    visibleDrawWaitMs: round(visibleDrawWaitMs[visibleDrawWaitMs.length - 1]),
                    releaseCallMs: round(releaseCallMs[releaseCallMs.length - 1]),
                    releaseObservedMs: round(releaseObservedDuration),
                    current: cacheSnapshot(cc, active.texture), previousBeforeRelease: previousBeforeRelease,
                    previous: previousRead });
            }

            cc.director.off(cc.Director.EVENT_AFTER_DRAW, onAfterDraw);
            var measuredFrameIntervals = frameIntervals.slice();
            await captureGate('after-cycles', { cycle: cycles, activePath: active.path, resourceUuid: active.texture._uuid });
            var retainedFrame = active.frame;
            var retainedTexture = active.texture;
            var beforeFailure = cacheSnapshot(cc, retainedTexture);
            var failureStarted = now();
            var failureCode = null;
            var failureUuid = options.failureUuid || null;
            var attemptedAssetBefore = cacheLookup(failurePath);
            try { await loadTexture(cc, failurePath); }
            catch (error) { failureCode = String(error && (error.message || error) || 'LOAD_FAILED'); }
            failure = { outcome: failureCode ? 'retained' : 'unexpected-success', code: failureCode,
                elapsedMs: round(now() - failureStarted), sameFrameOnAllSprites: sprites.every(function (entry) {
                    return entry.sprite.spriteFrame === retainedFrame;
                }), attemptedPath: failurePath, attemptedUuid: failureUuid,
                attemptedAssetBefore: attemptedAssetBefore, retainedUuid: retainedTexture._uuid,
                before: beforeFailure, after: cacheSnapshot(cc, retainedTexture) };
            await captureGate('failure-retained', { cycle: cycles, failure: failure });

            cleanup = { beforeCacheCount: beforeCacheCount, activeBeforeCleanup: cacheSnapshot(cc, active.texture),
                nodeCount: sprites.length };
            rootNode.destroy();
            var nodeDestroyStarted = now();
            await onceAfterDraw(cc);
            cleanup.nodeDestroyObservedMs = round(now() - nodeDestroyStarted);
            cleanup.rootValidAfterDraw = cc.isValid(rootNode);
            active.frame.destroy();
            active.texture.decRef();
            var cleanupReleaseStarted = now();
            cc.assetManager.releaseUnusedAssets();
            var cleanupStarted = now();
            await onceAfterDraw(cc);
            cleanup.releaseCallMs = round(now() - cleanupReleaseStarted);
            cleanup.elapsedMs = round(now() - cleanupStarted);
            cleanup.rootValid = cc.isValid(rootNode);
            cleanup.finalTexture = cacheSnapshot(cc, active.texture);
            cleanup.ownerReferenceDelta = cleanup.activeBeforeCleanup.refCount === null || cleanup.finalTexture.refCount === null
                ? null : cleanup.activeBeforeCleanup.refCount - cleanup.finalTexture.refCount;
            cleanup.resourceResidencyAfterOwnerRelease = cleanup.finalTexture.refCount === 0
                && !cleanup.finalTexture.valid && !cleanup.finalTexture.cached ? 'released'
                : cleanup.finalTexture.refCount > 0 && cleanup.finalTexture.valid && cleanup.finalTexture.cached
                    ? 'retained-by-reference' : 'inconsistent-readback';
            cleanup.finalAssetCacheCount = cc.assetManager.assets && Number.isInteger(cc.assetManager.assets.count)
                ? cc.assetManager.assets.count : null;
            cleanup.cacheDelta = cleanup.finalAssetCacheCount !== null && Number.isInteger(beforeCacheCount)
                ? cleanup.finalAssetCacheCount - beforeCacheCount : null;

            var parserByType = Object.create(null);
            tap.samples.forEach(function (sample) {
                var entry = parserByType[sample.parserType] || (parserByType[sample.parserType] = { count: 0, totalMs: 0, maxMs: 0, durationsMs: [], ids: [] });
                entry.count++;
                entry.totalMs += sample.durationMs;
                entry.maxMs = Math.max(entry.maxMs, sample.durationMs);
                entry.durationsMs.push(sample.durationMs);
                if (entry.ids.length < 12 && entry.ids.indexOf(sample.id) === -1) entry.ids.push(sample.id);
            });
            Object.keys(parserByType).forEach(function (type) {
                var entry = parserByType[type];
                entry.totalMs = round(entry.totalMs);
                entry.maxMs = round(entry.maxMs);
                entry.duration = summary(entry.durationsMs);
                delete entry.durationsMs;
            });
            var over16 = measuredFrameIntervals.filter(function (value) { return value > 16.667; }).length;
            var over33 = measuredFrameIntervals.filter(function (value) { return value > 33.333; }).length;
            var result = {
                creatorVersion: '2.4.15', platform: 'web-mobile',
                workload: { cycles: cycles, nodeCount: nodeCount, resourcePaths: paths,
                    texturePackable: packable,
                    operations: ['Texture2D load', 'SpriteFrame creation and assignment', 'Node position/scale updates',
                        'EVENT_AFTER_DRAW visibility wait', 'decRef plus releaseUnusedAssets'] },
                timings: { preloadDownloadOnlyMs: summary(preloadMs), resourceLoadTotalMs: summary(loadMs),
                    parserFixtureResourceLoadMs: summary(parserFixtureLoadMs),
                    spriteFrameCreateMs: summary(createFrameMs), spriteFrameInstallMs: summary(spriteFrameInstallMs),
                    nodeMutationMs: summary(nodeMutationMs), visibleDrawWaitMs: summary(visibleDrawWaitMs),
                    releaseCallMs: summary(releaseCallMs), releaseObservedMs: summary(releaseObservedMs) },
                frame: { sampleCount: measuredFrameIntervals.length, intervalMs: summary(measuredFrameIntervals),
                    over16_667MsCount: over16, over16_667MsRatio: measuredFrameIntervals.length ? round(over16 / measuredFrameIntervals.length) : null,
                    over33_333MsCount: over33, over33_333MsRatio: measuredFrameIntervals.length ? round(over33 / measuredFrameIntervals.length) : null,
                    targetFps: null, budgetVerdict: 'not-set' },
                resourceCache: { beforePreload: resourceCacheBeforePreload, afterPreload: resourceCacheAfterPreload,
                    cacheCountBefore: beforeCacheCount },
                parse: { tapAvailable: tap.available, preloadProducedParserCalls: preloadParseSamples.length,
                    parserFixtureReadback: parserFixtureReadback,
                    samplesByType: parserByType, samples: tap.samples.slice(0, 64), truncated: tap.samples.length > 64,
                    fixturePaths: parseFixturePaths, fixtureCacheBeforePreload: resourceCacheBeforePreload.filter(function (item) {
                        return parseFixturePaths.indexOf(item.path) !== -1;
                    }),
                    interpretation: 'The import parser callback includes Creator 2.4 deserialize(); .png parser time includes image parse/decode. A zero sample count means the selected resource was already parsed/cached or the parser hook was not reached; do not infer zero deserialization cost.' },
                failureRetention: failure, cleanup: cleanup, ownerReferenceReleases: ownerReferenceReleases,
                perCycle: cyclesTrace,
                errors: errors,
            };
            result.budgetEvaluation = evaluateBudgets(result, options.budgets);
            result.frame.targetFps = Number.isFinite(options.budgets && options.budgets.targetFps)
                ? options.budgets.targetFps : null;
            result.frame.budgetVerdict = result.budgetEvaluation.verdict;
            var ownerReferencesBalanced = ownerReferenceReleases.every(function (item) {
                return item.ownerReferenceDelta === 1;
            });
            var invariantsMet = !!failure && failure.outcome === 'retained' && failure.sameFrameOnAllSprites
                && failure.after.resourceUuid === failure.retainedUuid && failure.after.valid && failure.after.cached
                && ownerReferencesBalanced && cleanup.ownerReferenceDelta === 1 && !cleanup.rootValid
                && cleanup.finalTexture && cleanup.resourceResidencyAfterOwnerRelease !== 'inconsistent-readback';
            if (!invariantsMet) {
                result.acceptance = { success: false, code: 'STRESS_INVARIANT_FAILED', invariantsMet: false };
            } else if (result.budgetEvaluation.verdict === 'exceeded') {
                result.acceptance = { success: false, code: 'STRESS_BUDGET_EXCEEDED', invariantsMet: true };
            } else if (result.budgetEvaluation.verdict === 'insufficient-data') {
                result.acceptance = { success: false, code: 'STRESS_DATA_INSUFFICIENT', invariantsMet: true };
            } else {
                result.acceptance = { success: true,
                    outcome: result.budgetEvaluation.verdict === 'not-set' ? 'completed-without-budget-gate' : 'passed-configured-budgets',
                    invariantsMet: true };
            }
            result.acceptance.ownerReferencesBalanced = ownerReferencesBalanced;
            root.__cocosAgentStress24State = { phase: 'completed', cycle: cycles, acceptance: result.acceptance };
            return result;
        } catch (error) {
            errors.push(String(error && (error.stack || error.message || error) || error));
            throw error;
        } finally {
            tap.restore();
            cc.director.off(cc.Director.EVENT_AFTER_DRAW, onAfterDraw);
            if (rootNode && cc.isValid(rootNode)) rootNode.destroy();
            root.__cocosAgentStress24Running = false;
        }
    }

    root.CocosAgentDynamicStress24 = { run: run, summary: summary, evaluateBudgets: evaluateBudgets, validBudgets: validBudgets };
    if (typeof module === 'object' && module.exports) module.exports = root.CocosAgentDynamicStress24;
})(typeof window !== 'undefined' ? window : globalThis);
