'use strict';

const assert = require('assert');
const { PROFILE_ID, validInput, resultFromTrace } = require('./content-stress-host');

const input = {
    buildId: 'p1-web-20261009',
    resourcePaths: ['RedReleaseOct09', 'BlueReleaseOct09'],
    parseFixturePaths: ['cocos-agent-batch-red', 'cocos-agent-batch-blue'],
    failureResourcePath: 'cocos-agent-batch-blue',
    cycles: 96,
    nodeCount: 512,
    packable: true,
    profileId: PROFILE_ID,
    budgets: { targetFps: 30, maxResourceLoadP95Ms: 100, maxImportParserP95Ms: 20,
        maxPngParserP95Ms: 20, maxReleaseCallP95Ms: 8 },
};

assert.strictEqual(validInput(input), true);
for (const invalid of [
    { ...input, resourcePaths: ['RedReleaseOct09', 'RedReleaseOct09'] },
    { ...input, failureResourcePath: 'RedReleaseOct09' },
    { ...input, parseFixturePaths: ['RedReleaseOct09', 'cocos-agent-batch-blue'] },
    { ...input, cycles: 8, resourcePaths: Array.from({ length: 8 }, (_, index) => `image-${index}`) },
    { ...input, nodeCount: 1025 },
    { ...input, profileId: 'iphone-actual-device' },
    { ...input, budgets: { targetFps: 30 } },
    { ...input, budgets: { ...input.budgets, maxPngParserP95Ms: 60001 } },
]) assert.strictEqual(validInput(invalid), false);

const summary = resultFromTrace('/repo/docs/agent-foundation/traces/stress.json', {
    runId: 'screening-1', creatorVersion: '2.4.15', platform: 'web-mobile', buildId: input.buildId,
    environment: { profileId: PROFILE_ID, host: 'darwin', architecture: 'arm64', browser: 'Chrome 1', renderer: 'SwiftShader',
        deviceClass: 'development-host-headless-screening', viewport: { width: 1280, height: 800 } },
    workload: { nodeCount: 512, assets: [{ name: 'RedReleaseOct09', png: { width: 128, height: 128 } }] },
    result: { frame: { intervalMs: { p95Ms: 20, maxMs: 45 } }, timings: {
        resourceLoadTotalMs: { p95Ms: 4 }, parserFixtureResourceLoadMs: { p95Ms: 1.4 }, releaseCallMs: { p95Ms: 0.2 }, releaseObservedMs: { p95Ms: 17 },
    }, parse: { samplesByType: { import: { duration: { p95Ms: 0.3 } }, '.png': { duration: { p95Ms: 0.7 } } } },
    ownerReferenceReleases: [{ ownerReferenceDelta: 1 }, { ownerReferenceDelta: 1 }],
    resourceCache: { cacheCountBefore: 29, beforePreload: [{ path: 'Red', cachedBeforeOrAfterPreload: false }],
        afterPreload: [{ path: 'Red', cachedBeforeOrAfterPreload: true }] },
    cleanup: { finalAssetCacheCount: 29, cacheDelta: 0, ownerReferenceDelta: 1, resourceResidencyAfterOwnerRelease: 'released' },
    budgetEvaluation: { verdict: 'passed' }, acceptance: { success: true, ownerReferencesBalanced: true },
    perCycle: [{ current: { bundleCacheCount: 3 } }] },
    screenshots: {},
});
assert.deepStrictEqual(summary.metrics, {
    resourceLoadP95Ms: 4, parserFixtureResourceLoadP95Ms: 1.4, importDeserializeP95Ms: 0.3, pngParseP95Ms: 0.7,
    frameIntervalP95Ms: 20, frameIntervalMaxMs: 45, ownerReferenceDeltaPerRelease: 1,
    ownerReferenceReleaseCount: 2, ownerReferencesBalanced: true, cleanupOwnerReferenceDelta: 1, cleanupResidency: 'released',
    assetCacheCountBefore: 29, assetCacheCountAfterCleanup: 29, assetCacheDeltaAfterCleanup: 0,
    bundleCacheCount: 3, releaseCallP95Ms: 0.2, releaseObservedP95Ms: 17,
});
assert.match(summary.evidenceBoundary, /not a physical-device/);
assert.deepStrictEqual(summary.resourceCache.beforePreload, [{ path: 'Red', cachedBeforeOrAfterPreload: false }]);
process.stdout.write('runtime performance command bounds and structured report mapping passed\n');
