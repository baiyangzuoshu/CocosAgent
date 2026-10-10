'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const stress = require('./cocos-content-stress-2.4.js');

test('performance summaries report nearest-rank percentiles and empty samples', () => {
    assert.deepEqual(stress.summary([]), { count: 0, minMs: null, p50Ms: null, p95Ms: null, maxMs: null, meanMs: null });
    assert.deepEqual(stress.summary([4, 1, 3, 2]), {
        count: 4, minMs: 1, p50Ms: 2, p95Ms: 4, maxMs: 4, meanMs: 2.5,
    });
});

test('host screening budget separates cold/warm load and RGBA estimate with actionable findings', () => {
    const metrics = {
        frame: { intervalMs: { p95Ms: 17 } },
        timings: { coldResourceLoadMs: { p95Ms: 42 }, warmResourceLoadMs: { p95Ms: 1 }, releaseCallMs: { p95Ms: 0.1 } },
        memory: { peakEstimatedRgbaWorkingSetBytes: 8388608 },
        parse: { samplesByType: { import: { duration: { p95Ms: 0.1 } }, '.png': { duration: { p95Ms: 0.3 } } } },
    };
    assert.deepEqual(stress.evaluateBudgets(metrics, {}).verdict, 'not-set');
    const budgets = { targetFps: 58, maxColdResourceLoadP95Ms: 50, maxWarmResourceLoadP95Ms: 2,
        maxImportParserP95Ms: 2, maxPngParserP95Ms: 2, maxReleaseCallP95Ms: 2,
        maxEstimatedRgbaWorkingSetBytes: 16777216 };
    assert.equal(stress.evaluateBudgets(metrics, budgets).verdict, 'passed');
    const exceeded = stress.evaluateBudgets(metrics, { ...budgets, maxColdResourceLoadP95Ms: 30 });
    assert.equal(exceeded.verdict, 'exceeded');
    assert.equal(exceeded.checks.find((check) => check.metric === 'coldResourceLoadP95').status, 'exceeded');
    const coldFinding = exceeded.diagnostics.find((finding) => finding.metric === 'coldResourceLoadP95');
    assert.equal(coldFinding.metric, 'coldResourceLoadP95');
    assert.match(coldFinding.likelyLoci.join(' '), /image decode/);
    const insufficient = stress.evaluateBudgets({ ...metrics, parse: { samplesByType: {} } }, budgets);
    assert.equal(insufficient.verdict, 'insufficient-data');
    assert.ok(insufficient.diagnostics.some((finding) => finding.code === 'METRIC_UNOBSERVED_IMPORTDESERIALIZEPARSERP95'));
});

test('host screening budgets require explicit cold, warm and estimated working-set bounds', () => {
    assert.equal(stress.validBudgets({ targetFps: 30, maxColdResourceLoadP95Ms: 150, maxWarmResourceLoadP95Ms: 10,
        maxImportParserP95Ms: 30, maxPngParserP95Ms: 60, maxReleaseCallP95Ms: 8,
        maxEstimatedRgbaWorkingSetBytes: 33554432 }), true);
    assert.equal(stress.validBudgets({ targetFps: 30 }), false);
});

test('workload bounds reject invalid cycles, node counts, and resource paths before touching Creator', async () => {
    await assert.rejects(stress.run({ cycles: 3 }), /INVALID_STRESS_OPTIONS/);
    await assert.rejects(stress.run({ nodeCount: 129 }), /INVALID_STRESS_OPTIONS/);
    await assert.rejects(stress.run({ paths: ['RedReleaseOct09', '../outside'] }), /INVALID_STRESS_OPTIONS/);
});
