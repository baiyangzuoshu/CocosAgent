'use strict';

// Optional helper for a project-owned Creator command provider. The provider
// declares the run command as control + approval:true and owns test cleanup.
exports.runTests = async function runTests(cases, options) {
    options = options || {};
    if (!Array.isArray(cases) || !cases.length || cases.length > 1000) throw new Error('TEST_CASES_INVALID');
    var ids = new Set();
    cases.forEach(function (entry) {
        if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)
            || typeof entry.run !== 'function') throw new Error('TEST_CASE_INVALID');
        ids.add(entry.id);
    });
    var selected = options.ids || cases.map(function (entry) { return entry.id; });
    if (!Array.isArray(selected) || selected.some(function (id) { return !ids.has(id); })) throw new Error('TEST_SELECTION_INVALID');
    var timeoutMs = options.timeoutMs === undefined ? 10000 : options.timeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 25000) throw new Error('TEST_TIMEOUT_INVALID');
    var deadline = Date.now() + 25000; // Provider IPC has a 30 second execution limit.
    var tests = [];
    var interrupted = false;
    for (var entry of cases.filter(function (item) { return selected.indexOf(item.id) !== -1; })) {
        if (interrupted) {
            tests.push({ id: entry.id, name: entry.name || entry.id, status: 'skipped', durationMs: 0,
                message: 'Earlier test timed out; remaining cases require manual review before retry.' });
            continue;
        }
        var started = Date.now();
        var timer;
        try {
            await Promise.race([Promise.resolve().then(function () { return entry.run(); }),
                new Promise(function (_, reject) {
                    timer = setTimeout(function () { var error = new Error('CREATOR_TEST_TIMEOUT'); error.timedOut = true; reject(error); }, Math.min(timeoutMs, Math.max(1, deadline - Date.now())));
                })]);
            tests.push({ id: entry.id, name: entry.name || entry.id, status: 'passed', durationMs: Date.now() - started });
        } catch (error) {
            interrupted = Boolean(error && error.timedOut);
            tests.push({ id: entry.id, name: entry.name || entry.id, status: 'failed', durationMs: Date.now() - started,
                message: String(error && (error.stack || error.message) || error).slice(0, 8192) });
        } finally { clearTimeout(timer); }
    }
    var report = { schemaVersion: 1, tests: tests, requiresManualReview: interrupted };
    // Providers may attach counters from their own instrumentation. The CLI
    // validates the coverage schema and source hashes before storing them.
    if (options.coverage && typeof options.coverage === 'object' && !Array.isArray(options.coverage))
        report.coverage = options.coverage;
    return report;
};
