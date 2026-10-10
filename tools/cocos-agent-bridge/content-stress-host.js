'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const PROFILE_ID = 'macos-arm64-chrome-headless-swiftshader-1280x800';
const BUDGET_KEYS = ['targetFps', 'maxResourceLoadP95Ms', 'maxImportParserP95Ms', 'maxPngParserP95Ms', 'maxReleaseCallP95Ms'];

function readInput(argv) {
    const index = argv.indexOf('--input');
    if (index < 0 || !argv[index + 1]) throw Error('STRESS_INPUT_REQUIRED');
    try { return JSON.parse(argv[index + 1]); } catch (_) { throw Error('STRESS_INPUT_INVALID_JSON'); }
}

function validInput(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).length !== 9
        || !/^[a-z0-9][a-z0-9-]{2,31}$/.test(input.buildId || '')
        || !Array.isArray(input.resourcePaths) || input.resourcePaths.length < 2 || input.resourcePaths.length > 16
        || !input.resourcePaths.every((item) => typeof item === 'string' && /^[A-Za-z0-9_-]{1,64}(?:\/[A-Za-z0-9_-]{1,64}){0,7}$/.test(item))
        || new Set(input.resourcePaths).size !== input.resourcePaths.length
        || !Array.isArray(input.parseFixturePaths) || input.parseFixturePaths.length < 2 || input.parseFixturePaths.length > 16
        || !input.parseFixturePaths.every((item) => typeof item === 'string' && /^[A-Za-z0-9_-]{1,64}(?:\/[A-Za-z0-9_-]{1,64}){0,7}$/.test(item))
        || new Set(input.parseFixturePaths).size !== input.parseFixturePaths.length
        || input.parseFixturePaths.some((item) => input.resourcePaths.includes(item))
        || typeof input.failureResourcePath !== 'string' || !input.parseFixturePaths.includes(input.failureResourcePath)
        || input.resourcePaths.includes(input.failureResourcePath)
        || !Number.isInteger(input.cycles) || input.cycles < 8 || input.cycles > 256 || input.cycles < input.resourcePaths.length + 1
        || !Number.isInteger(input.nodeCount) || input.nodeCount < 32 || input.nodeCount > 1024
        || typeof input.packable !== 'boolean' || input.profileId !== PROFILE_ID
        || !input.budgets || typeof input.budgets !== 'object' || Array.isArray(input.budgets)
        || Object.keys(input.budgets).length !== BUDGET_KEYS.length
        || !BUDGET_KEYS.every((key) => Number.isFinite(input.budgets[key]))) return false;
    return input.budgets.targetFps >= 1 && input.budgets.targetFps <= 360
        && BUDGET_KEYS.slice(1).every((key) => input.budgets[key] >= 0.01 && input.budgets[key] <= 60000);
}

function percentile(result, parserType) {
    return result?.parse?.samplesByType?.[parserType]?.duration?.p95Ms ?? null;
}

function resultFromTrace(tracePath, trace) {
    const result = trace.result || {};
    const frame = result.frame || {};
    const timings = result.timings || {};
    const cleanup = result.cleanup || {};
    return {
        runId: trace.runId,
        creatorVersion: trace.creatorVersion,
        platform: trace.platform,
        buildId: trace.buildId,
        testProfile: trace.environment?.profileId || null,
        testRig: {
            host: trace.environment?.host || null,
            architecture: trace.environment?.architecture || null,
            osRelease: trace.environment?.osRelease || null,
            cpuModel: trace.environment?.cpuModel || null,
            logicalCpuCount: trace.environment?.logicalCpuCount ?? null,
            totalMemoryBytes: trace.environment?.totalMemoryBytes ?? null,
            browser: trace.environment?.browser || null,
            renderer: trace.environment?.renderer || null,
            viewport: trace.environment?.viewport || null,
            deviceClass: trace.environment?.deviceClass || null,
        },
        workload: trace.workload,
        metrics: {
            resourceLoadP95Ms: timings.resourceLoadTotalMs?.p95Ms ?? null,
            parserFixtureResourceLoadP95Ms: timings.parserFixtureResourceLoadMs?.p95Ms ?? null,
            importDeserializeP95Ms: percentile(result, 'import'),
            pngParseP95Ms: percentile(result, '.png'),
            frameIntervalP95Ms: frame.intervalMs?.p95Ms ?? null,
            frameIntervalMaxMs: frame.intervalMs?.maxMs ?? null,
            ownerReferenceDeltaPerRelease: result.acceptance?.ownerReferencesBalanced === true ? 1 : null,
            ownerReferenceReleaseCount: result.ownerReferenceReleases?.length ?? 0,
            ownerReferencesBalanced: result.acceptance?.ownerReferencesBalanced === true,
            cleanupOwnerReferenceDelta: cleanup.ownerReferenceDelta ?? null,
            cleanupResidency: cleanup.resourceResidencyAfterOwnerRelease ?? null,
            assetCacheCountBefore: result.resourceCache?.cacheCountBefore ?? null,
            assetCacheCountAfterCleanup: cleanup.finalAssetCacheCount ?? null,
            assetCacheDeltaAfterCleanup: cleanup.cacheDelta ?? null,
            bundleCacheCount: result.perCycle?.at(-1)?.current?.bundleCacheCount ?? null,
            releaseCallP95Ms: timings.releaseCallMs?.p95Ms ?? null,
            releaseObservedP95Ms: timings.releaseObservedMs?.p95Ms ?? null,
        },
        resourceCache: {
            beforePreload: result.resourceCache?.beforePreload || [],
            afterPreload: result.resourceCache?.afterPreload || [],
        },
        budgetEvaluation: result.budgetEvaluation || null,
        acceptance: trace.error
            ? { success: false, code: result.acceptance?.code || trace.error, invariantsMet: result.acceptance?.invariantsMet ?? false }
            : result.acceptance || { success: false, code: 'STRESS_RESULT_MISSING' },
        tracePath: path.relative(REPOSITORY_ROOT, tracePath),
        screenshots: trace.screenshots || {},
        evidenceBoundary: 'Mac Chrome headless + SwiftShader screening; not a physical-device frame-time or GPU-memory result.',
    };
}

function run(projectRoot, input, runner = spawnSync) {
    if (!validInput(input)) throw Error('STRESS_INPUT_INVALID');
    const project = fs.realpathSync(projectRoot);
    if (path.basename(project) !== '2.4.15NewProject') throw Error('PROJECT_VERSION_MISMATCH');
    const recordPath = path.join(project, '.cocos-agent', 'content-builds', `${input.buildId}.json`);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    const outputRoot = path.join(project, 'build', 'cocos-agent', input.buildId);
    if (record.creatorVersion !== '2.4.15' || record.platform !== 'web-mobile' || record.state !== 'completed'
        || record.artifact?.success !== true || path.resolve(record.outputRoot) !== outputRoot
        || !fs.existsSync(path.join(outputRoot, 'web-mobile', 'index.html'))) throw Error('BUILD_NOT_VERIFIED_2_4_WEB_MOBILE');

    const runnerPath = path.join(REPOSITORY_ROOT, 'docs/agent-foundation/probes/cocos-content-stress-2.4-live.mjs');
    const args = [runnerPath, '--build', input.buildId, '--cycles', String(input.cycles), '--node-count', String(input.nodeCount),
        '--packable', String(input.packable), '--resource-paths', JSON.stringify(input.resourcePaths),
        '--parse-fixture-paths', JSON.stringify(input.parseFixturePaths), '--failure-resource-path', input.failureResourcePath,
        '--test-profile', input.profileId, '--budgets', JSON.stringify(input.budgets)];
    const execution = runner(process.execPath, args, { cwd: REPOSITORY_ROOT, encoding: 'utf8', timeout: 270000, maxBuffer: 4 * 1024 * 1024 });
    const output = `${execution.stdout || ''}\n${execution.stderr || ''}`;
    const match = output.match(/(?:CONTENT_STRESS_ACCEPTED|CONTENT_STRESS_FAILED) (.+\.json)/);
    if (execution.error || !match) throw Error(execution.error?.code === 'ETIMEDOUT' ? 'STRESS_RUN_TIMEOUT' : 'STRESS_RUN_FAILED');
    const tracePath = path.resolve(REPOSITORY_ROOT, match[1]);
    const traceRoot = path.resolve(REPOSITORY_ROOT, 'docs/agent-foundation/traces');
    if (!tracePath.startsWith(`${traceRoot}${path.sep}`)) throw Error('STRESS_TRACE_PATH_INVALID');
    const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
    if (trace.creatorVersion !== '2.4.15' || trace.platform !== 'web-mobile' || trace.buildId !== input.buildId
        || trace.workload?.nodeCount !== input.nodeCount || JSON.stringify(trace.workload?.assets?.map((asset) => asset.name)) !== JSON.stringify(input.resourcePaths)) {
        throw Error('STRESS_TRACE_MISMATCH');
    }
    return resultFromTrace(tracePath, trace);
}

if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        const projectIndex = args.indexOf('--project');
        if (projectIndex < 0 || !args[projectIndex + 1]) throw Error('PROJECT_REQUIRED');
        const result = run(args[projectIndex + 1], readInput(args));
        process.stdout.write(`command.result ${JSON.stringify({ command: 'content.stress.run', result })}\n`);
    } catch (error) {
        process.stderr.write(`${error.code || error.message || 'STRESS_RUN_FAILED'}\n`);
        process.exitCode = 1;
    }
}

module.exports = { PROFILE_ID, validInput, resultFromTrace, run };
