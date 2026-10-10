'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const contentBuild = require('./content-build');
const contentRelease = require('./content-release');
const bundleDependencies = require('./content-bundle-dependencies');
const contentRuntimeHost = require('./runtime/content-runtime-host');

const BUILD_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,31}$/;
const sessions = new Map();
const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function failure(code, message) { return { success: false, outcome: 'failed', error: { code, message } }; }
function keyFor(root, buildId) { return `${root}\0${buildId}`; }
function target(params) {
    if (!params || params.creatorVersion !== '2.4.15' || typeof params.projectRoot !== 'string'
        || !path.isAbsolute(params.projectRoot) || !BUILD_ID_PATTERN.test(params.buildId || ''))
        return failure('INVALID_ARGUMENT', 'Provide an absolute Creator 2.4.15 project path and a valid buildId.');
    const projectRoot = path.resolve(params.projectRoot);
    try { if (!fs.statSync(projectRoot).isDirectory()) throw Error('not a directory'); }
    catch (_) { return failure('PROJECT_NOT_FOUND', 'Project directory does not exist.'); }
    return { success: true, projectRoot, creatorVersion: params.creatorVersion, buildId: params.buildId };
}

function inside(root, filename) {
    const relative = path.relative(root, filename);
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function withinOrEqual(root, filename) { return root === filename || inside(root, filename); }

function findWebRoot(outputRoot, configPath) {
    if (typeof configPath !== 'string' || path.isAbsolute(configPath)) return null;
    const configFile = path.resolve(outputRoot, configPath);
    if (!inside(outputRoot, configFile) || !fs.existsSync(configFile)) return null;
    const relativeConfig = path.relative(outputRoot, configFile);
    const indexes = [];
    const stack = [{ directory: outputRoot, depth: 0 }];
    let visited = 0;
    while (stack.length) {
        const current = stack.pop();
        if (current.depth > 14) continue;
        let entries;
        try { entries = fs.readdirSync(current.directory, { withFileTypes: true }); } catch (_) { return null; }
        for (const entry of entries) {
            if (++visited > 50000) return null;
            const filename = path.join(current.directory, entry.name);
            if (entry.isDirectory()) stack.push({ directory: filename, depth: current.depth + 1 });
            else if (entry.isFile() && entry.name.toLowerCase() === 'index.html') {
                const relative = path.relative(outputRoot, filename);
                const rootRelative = path.dirname(relative);
                const prefix = rootRelative === '.' ? '' : `${rootRelative}${path.sep}`;
                if (relativeConfig.startsWith(prefix)) indexes.push({ filename, depth: prefix.length });
            }
        }
    }
    indexes.sort((a, b) => b.depth - a.depth);
    const selected = indexes[0];
    if (!selected) return null;
    let realRoot; let realIndex; let realOutput;
    try {
        realOutput = fs.realpathSync(outputRoot);
        realRoot = fs.realpathSync(path.dirname(selected.filename));
        realIndex = fs.realpathSync(selected.filename);
    } catch (_) { return null; }
    return withinOrEqual(realOutput, realRoot) && inside(realRoot, realIndex) ? realRoot : null;
}

function contentType(filename) { return MIME_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream'; }

function serve(root, request, response) {
    if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' });
        response.end();
        return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
    catch (_) { response.writeHead(400, { 'Cache-Control': 'no-store' }); response.end(); return; }
    if (pathname.includes('\\') || pathname.includes('\0')) {
        response.writeHead(400, { 'Cache-Control': 'no-store' }); response.end(); return;
    }
    const relative = pathname.replace(/^\/+/, '') || 'index.html';
    let filename = path.resolve(root, relative);
    if (!inside(root, filename)) { response.writeHead(404, { 'Cache-Control': 'no-store' }); response.end(); return; }
    try {
        const stat = fs.statSync(filename);
        if (stat.isDirectory()) filename = path.join(filename, 'index.html');
        const realRoot = fs.realpathSync(root);
        const realFile = fs.realpathSync(filename);
        if (!inside(realRoot, realFile) || !fs.statSync(realFile).isFile()) throw Error('unsafe file');
        const fileStat = fs.statSync(realFile);
        response.writeHead(200, { 'Content-Type': contentType(realFile), 'Content-Length': fileStat.size,
            'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        if (request.method === 'HEAD') { response.end(); return; }
        const stream = fs.createReadStream(realFile);
        stream.on('error', () => { if (!response.headersSent) response.writeHead(500); response.destroy(); });
        stream.pipe(response);
    } catch (_) {
        response.writeHead(404, { 'Cache-Control': 'no-store' });
        response.end();
    }
}

function drainEvents(session) {
    while (session.runtime.events.length) {
        const event = session.runtime.events.shift();
        if (event.type === 'receipt' && event.acceptance?.success) session.runtimeConfirmed = true;
        session.recentEvents.push(event);
        if (session.recentEvents.length > 50) session.recentEvents.shift();
    }
}

function snapshot(session) {
    drainEvents(session);
    let connected = false;
    let lastReceipt = null;
    let lastError = null;
    for (const event of session.recentEvents) {
        if (event.type === 'connected') { connected = true; lastError = null; }
        else if (event.type === 'disconnected') connected = false;
        else if (event.type === 'receipt') lastReceipt = { receipt: event.receipt, acceptance: event.acceptance };
        else if (event.type === 'handshake-rejected' || event.type === 'host-error') lastError = event;
    }
    const status = lastReceipt && lastReceipt.acceptance?.success
        ? 'runtime-observed' : lastReceipt ? 'needs-review' : connected ? 'connected' : 'waiting-for-runtime';
    let selectedReleaseId = null;
    try {
        const selected = session.releaseTools.get({ projectRoot: session.projectRoot, creatorVersion: session.creatorVersion });
        if (selected.success) selectedReleaseId = selected.selected?.releaseId || null;
    } catch (_) { /* The preview status remains readable if the pointer cannot be read. */ }
    const effectiveReleaseId = lastReceipt?.acceptance?.effective?.releaseId
        || lastReceipt?.receipt?.activeReleaseId || lastReceipt?.receipt?.releaseId || null;
    const recoveryState = !session.previousEffective ? 'not-required'
        : session.runtimeConfirmed ? 'confirmed'
            : lastReceipt ? 'needs-review' : connected ? 'awaiting-receipt' : 'awaiting-runtime';
    return { success: true, outcome: 'read', previewId: session.previewId, buildId: session.buildId,
        creatorVersion: session.creatorVersion, status, connected, baseUrl: session.baseUrl, previewUrl: session.runtime.previewUrl,
        buildReleaseId: session.releaseId, selectedReleaseId, effectiveReleaseId, fingerprint: session.fingerprint,
        recovery: { state: recoveryState, previousAcceptedReleaseId: session.previousEffective?.releaseId || null,
            selectedReleaseId, confirmedInSession: session.runtimeConfirmed },
        ...(lastReceipt ? { lastReceipt } : {}), ...(lastError ? { lastError } : {}),
        recentEvents: session.recentEvents.slice(-20) };
}

async function listen(server) {
    await new Promise((resolve, reject) => {
        const onError = (error) => { server.removeListener('listening', onListening); reject(error); };
        const onListening = () => { server.removeListener('error', onError); resolve(); };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(0, '127.0.0.1');
    });
    return server.address().port;
}

async function start(params, options = {}) {
    const checkedTarget = target(params);
    if (!checkedTarget.success) return checkedTarget;
    const { projectRoot, creatorVersion, buildId } = checkedTarget;
    const sessionKey = keyFor(projectRoot, buildId);
    const existing = sessions.get(sessionKey);
    if (existing) return snapshot(existing);

    const buildTools = options.contentBuild || contentBuild;
    const releaseTools = options.contentRelease || contentRelease;
    const runtimeTools = options.contentRuntimeHost || contentRuntimeHost;
    let fetched;
    try { fetched = buildTools.get({ projectRoot, creatorVersion, buildId }); }
    catch (_) { return failure('BUILD_RECORD_INVALID', 'Build record could not be read safely.'); }
    if (!fetched.success) return fetched;
    const record = fetched.build;
    const expectedOutputRoot = path.resolve(projectRoot, 'build', 'cocos-agent', buildId);
    if (record.state !== 'completed') return failure('BUILD_NOT_COMPLETED', 'Only a completed and verified build can be previewed.');
    if (record.projectRoot !== projectRoot || record.creatorVersion !== creatorVersion || record.buildId !== buildId
        || record.outputRoot !== expectedOutputRoot || !record.releaseManifest
        || record.releaseManifest.releaseId !== record.releaseId || record.releaseManifest.fingerprint !== record.fingerprint
        || record.releaseManifest.creatorVersion !== creatorVersion)
        return failure('BUILD_RECORD_MISMATCH', 'Build record does not match this project, version, output, or release.');
    let realProject; let realOutput;
    try { realProject = fs.realpathSync(projectRoot); realOutput = fs.realpathSync(expectedOutputRoot); }
    catch (_) { return failure('BUILD_OUTPUT_MISSING', 'Verified Web-Mobile build output is missing.'); }
    if (!inside(realProject, realOutput)) return failure('UNSAFE_BUILD_PATH', 'Build output resolves outside the project.');
    let artifact;
    let dependencyContract = null;
    if (record.dependencyContractId) {
        const dependency = bundleDependencies.get({ projectRoot, creatorVersion, contractId: record.dependencyContractId });
        if (!dependency.success || dependency.fingerprint !== record.dependencyFingerprint
            || JSON.stringify(dependency.contract) !== JSON.stringify(record.dependencyContract))
            return failure('DEPENDENCY_CONTRACT_CHANGED', 'Staged cross-Bundle dependency contract no longer matches the completed build record.');
        dependencyContract = dependency.contract;
    }
    try { artifact = buildTools.verifyOutput(expectedOutputRoot, record.releaseManifest, dependencyContract); }
    catch (_) { return failure('BUILD_OUTPUT_CHANGED', 'Build package could not be revalidated safely.'); }
    if (!artifact.success || artifact.fingerprint !== record.fingerprint)
        return failure('BUILD_OUTPUT_CHANGED', 'Build package no longer matches its verified release record.');
    if (record.releaseManifest.delivery === 'asset-bundle') {
        const verified = record.artifact;
        if (!verified || verified.delivery !== 'asset-bundle' || artifact.delivery !== 'asset-bundle'
            || verified.bundleName !== record.releaseManifest.bundleName || artifact.bundleName !== verified.bundleName
            || verified.bundleConfigHash !== artifact.bundleConfigHash || verified.configPath !== artifact.configPath
            || JSON.stringify(verified.resources) !== JSON.stringify(artifact.resources))
            return failure('BUILD_OUTPUT_CHANGED', 'Asset Bundle package identity differs from the completed build record.');
    }
    if (dependencyContract) {
        const verified = record.artifact;
        if (!verified || verified.dependencyContractId !== dependencyContract.contractId
            || verified.dependencyFingerprint !== record.dependencyFingerprint
            || JSON.stringify(verified.dependencyVerification) !== JSON.stringify(artifact.dependencyVerification))
            return failure('BUILD_DEPENDENCY_OUTPUT_CHANGED', 'Cross-Bundle owner, consumer, UUID, or redirect evidence differs from the completed build record.');
    }
    const webRoot = findWebRoot(expectedOutputRoot, artifact.configPath);
    if (!webRoot) return failure('PREVIEW_ENTRY_NOT_FOUND', 'A safe Web-Mobile index.html matching the verified content bundle was not found.');
    let selected; let selectedRelease; let revalidated;
    try {
        selected = releaseTools.get({ projectRoot, creatorVersion });
        if (!selected.success || !selected.selected || selected.selected.releaseId !== record.releaseId
            || selected.selected.fingerprint !== record.fingerprint)
            return failure('BUILD_RELEASE_NOT_SELECTED', 'Select the exact release used by this build before starting its runtime session.');
        selectedRelease = releaseTools.get({ projectRoot, creatorVersion, releaseId: record.releaseId });
        if (!selectedRelease.success || selectedRelease.release.fingerprint !== record.fingerprint)
            return failure('BUILD_RELEASE_CHANGED', 'The selected build release is missing or has changed.');
        revalidated = releaseTools.validate({ projectRoot, creatorVersion, manifest: selectedRelease.release });
    } catch (_) { return failure('BUILD_RELEASE_CHANGED', 'The selected build release could not be revalidated safely.'); }
    if (!revalidated.success || revalidated.fingerprint !== record.fingerprint)
        return failure('BUILD_RELEASE_CHANGED', 'Current project content no longer matches the build release.');

    const server = http.createServer((request, response) => serve(webRoot, request, response));
    let runtime = null;
    try {
        const port = await listen(server);
        const baseUrl = `http://127.0.0.1:${port}/`;
        runtime = await runtimeTools.start({ projectRoot, creatorVersion, platform: 'web-preview', previewUrl: baseUrl,
            dependencyContract });
        const previousEffective = selected.effective && typeof selected.effective.releaseId === 'string'
            ? { releaseId: selected.effective.releaseId, fingerprint: selected.effective.fingerprint || null }
            : null;
        const session = { previewId: crypto.randomBytes(16).toString('hex'), projectRoot, creatorVersion,
            buildId, releaseId: record.releaseId, fingerprint: record.fingerprint, webRoot, baseUrl, dependencyContract,
            server, runtime, releaseTools, recentEvents: [], previousEffective, runtimeConfirmed: false,
            startedAt: new Date().toISOString() };
        session.drainTimer = setInterval(() => drainEvents(session), 100);
        sessions.set(sessionKey, session);
        return { ...snapshot(session), outcome: 'ready' };
    } catch (error) {
        if (runtime) await runtime.close().catch(() => {});
        if (server.listening) await new Promise((resolve) => server.close(resolve));
        return failure('PREVIEW_START_FAILED', error.code || error.message || 'Could not start the local Web-Mobile preview.');
    }
}

function get(params) {
    const checkedTarget = target(params);
    if (!checkedTarget.success) return checkedTarget;
    const session = sessions.get(keyFor(checkedTarget.projectRoot, checkedTarget.buildId));
    return session ? snapshot(session) : failure('PREVIEW_NOT_FOUND', 'No active preview exists for this build in the current Agent process.');
}

async function stop(params) {
    const checkedTarget = target(params);
    if (!checkedTarget.success) return checkedTarget;
    const sessionKey = keyFor(checkedTarget.projectRoot, checkedTarget.buildId);
    const session = sessions.get(sessionKey);
    if (!session) return { success: true, outcome: 'already-stopped', buildId: checkedTarget.buildId };
    sessions.delete(sessionKey);
    clearInterval(session.drainTimer);
    drainEvents(session);
    try { await session.runtime.close(); }
    finally { if (session.server.listening) await new Promise((resolve) => session.server.close(resolve)); }
    return { success: true, outcome: 'stopped', previewId: session.previewId, buildId: session.buildId };
}

async function handle(method, params, options) {
    if (method === 'content.preview.start') return start(params, options);
    if (method === 'content.preview.get') return get(params);
    if (method === 'content.preview.stop') return stop(params);
    return failure('UNKNOWN_METHOD', 'Unknown content preview method.');
}

async function closeAll() {
    const active = [...sessions.values()];
    await Promise.all(active.map((session) => stop({ projectRoot: session.projectRoot,
        creatorVersion: session.creatorVersion, buildId: session.buildId })));
}

module.exports = { handle, start, get, stop, closeAll, findWebRoot, serve, contentType };
