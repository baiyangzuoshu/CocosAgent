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

test('optional budgets compare configured p95 gates without inventing defaults', () => {
    const metrics = {
        frame: { intervalMs: { p95Ms: 17 } },
        timings: { resourceLoadTotalMs: { p95Ms: 3.5 }, releaseCallMs: { p95Ms: 0.1 } },
        parse: { samplesByType: { import: { duration: { p95Ms: 0.1 } }, '.png': { duration: { p95Ms: 0.3 } } } },
    };
    assert.deepEqual(stress.evaluateBudgets(metrics, {}).verdict, 'not-set');
    assert.equal(stress.evaluateBudgets(metrics, { targetFps: 58, maxResourceLoadP95Ms: 4 }).verdict, 'passed');
    const exceeded = stress.evaluateBudgets(metrics, { targetFps: 60, maxResourceLoadP95Ms: 3 });
    assert.equal(exceeded.verdict, 'exceeded');
    assert.deepEqual(exceeded.checks.map((check) => check.passed), [false, false]);
});

test('workload bounds reject invalid cycles, node counts, and resource paths before touching Creator', async () => {
    await assert.rejects(stress.run({ cycles: 3 }), /INVALID_STRESS_OPTIONS/);
    await assert.rejects(stress.run({ nodeCount: 129 }), /INVALID_STRESS_OPTIONS/);
    await assert.rejects(stress.run({ paths: ['RedReleaseOct09', '../outside'] }), /INVALID_STRESS_OPTIONS/);
});
