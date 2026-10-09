'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const preview = require('./content-preview');

function fixture() {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-content-preview-'));
    const buildId = 'preview-smoke-01';
    const outputRoot = path.join(projectRoot, 'build', 'cocos-agent', buildId);
    const webRoot = path.join(outputRoot, 'web-mobile');
    const configPath = 'web-mobile/assets/resources/config.123abc.json';
    fs.mkdirSync(path.dirname(path.join(outputRoot, configPath)), { recursive: true });
    fs.writeFileSync(path.join(webRoot, 'index.html'), '<!doctype html><title>CocosAgent Preview</title>');
    fs.writeFileSync(path.join(outputRoot, configPath), '{}');
    fs.writeFileSync(path.join(webRoot, 'probe.js'), 'window.previewProbe = true;');
    const outsideFile = path.join(projectRoot, 'private-outside-package.txt');
    fs.writeFileSync(outsideFile, 'do not serve');
    try { fs.symlinkSync(outsideFile, path.join(webRoot, 'leak.txt')); } catch (_) { /* Symlinks may be unavailable on some test hosts. */ }
    const fingerprint = 'a'.repeat(64);
    const releaseManifest = { contractVersion: '0.1', creatorVersion: '2.4.15', releaseId: 'release-a', fingerprint };
    const record = { contractVersion: '0.1', buildId, creatorVersion: '2.4.15', projectRoot,
        releaseId: 'release-a', fingerprint, outputRoot, state: 'completed', releaseManifest };
    const events = [];
    let selectedReleaseId = 'release-a';
    let effective = null;
    const fake = {
        contentBuild: {
            get: () => ({ success: true, build: record }),
            verifyOutput: () => ({ success: true, fingerprint, configPath }),
        },
        contentRelease: {
            get: (params) => params.releaseId
                ? { success: true, release: releaseManifest, selected: { releaseId: selectedReleaseId, fingerprint }, effective }
                : { success: true, selected: { releaseId: selectedReleaseId, fingerprint }, effective },
            validate: () => ({ success: true, fingerprint }),
        },
        contentRuntimeHost: {
            async start({ previewUrl }) {
                events.length = 0;
                const url = new URL(previewUrl);
                url.searchParams.set('cocosAgentPort', '50321');
                url.searchParams.set('cocosAgentToken', 'b'.repeat(64));
                return { previewUrl: url.toString(), events, close: async () => { fake.runtimeClosed = true; } };
            },
        },
    };
    return { projectRoot, buildId, outputRoot, webRoot, fingerprint, releaseManifest, record, events, fake,
        setSelectedReleaseId: (value) => { selectedReleaseId = value; },
        setEffective: (value) => { effective = value; },
        params: { projectRoot, creatorVersion: '2.4.15', buildId } };
}

test('serves only the verified package on loopback and exposes runtime session status', async () => {
    const value = fixture();
    let current;
    try {
        current = await preview.start(value.params, value.fake);
        assert.equal(current.success, true, JSON.stringify(current));
        assert.equal(current.outcome, 'ready');
        assert.equal(current.status, 'waiting-for-runtime');
        assert.equal(current.buildReleaseId, 'release-a');
        assert.equal(current.selectedReleaseId, 'release-a');
        assert.deepEqual(current.recovery, { state: 'not-required', previousAcceptedReleaseId: null,
            selectedReleaseId: 'release-a', confirmedInSession: false });
        assert.match(current.previewUrl, /^http:\/\/127\.0\.0\.1:\d+\/\?cocosAgentPort=50321&cocosAgentToken=/);
        const page = await fetch(current.previewUrl);
        assert.equal(page.status, 200);
        assert.match(page.headers.get('content-type'), /^text\/html/);
        assert.match(await page.text(), /CocosAgent Preview/);
        const script = await fetch(new URL('probe.js', current.baseUrl));
        assert.equal(await script.text(), 'window.previewProbe = true;');
        assert.equal((await fetch(new URL('leak.txt', current.baseUrl))).status, 404);
        assert.equal((await fetch(`${current.baseUrl}../secret`)).status, 404);
        assert.equal((await fetch(current.baseUrl, { method: 'POST' })).status, 405);

        value.events.push({ type: 'connected', creatorVersion: '2.4.15', scene: 'helloworld' });
        assert.equal(preview.get(value.params).status, 'connected');
        assert.equal(preview.get(value.params).connected, true);
        value.setEffective({ releaseId: 'release-a', fingerprint: value.fingerprint });
        value.events.push({ type: 'receipt', receipt: { outcome: 'applied', releaseId: 'release-a' },
            acceptance: { success: true, outcome: 'runtime-observed' } });
        const accepted = preview.get(value.params);
        assert.equal(accepted.status, 'runtime-observed');
        assert.equal(accepted.connected, true);
        assert.equal(accepted.lastReceipt.acceptance.outcome, 'runtime-observed');
        assert.equal(accepted.effectiveReleaseId, 'release-a');
        assert.equal(accepted.recovery.state, 'not-required');
        assert.equal(accepted.recovery.confirmedInSession, true);
        value.setSelectedReleaseId('release-b');
        assert.equal(preview.get(value.params).selectedReleaseId, 'release-b');
        assert.equal(preview.get(value.params).buildReleaseId, 'release-a');
        value.events.push({ type: 'disconnected' });
        assert.equal(preview.get(value.params).connected, false);
        const stopped = await preview.stop(value.params);
        assert.equal(stopped.outcome, 'stopped');
        assert.equal(value.fake.runtimeClosed, true);
        assert.equal(preview.get(value.params).error.code, 'PREVIEW_NOT_FOUND');
    } finally {
        if (preview.get(value.params).success) await preview.stop(value.params);
        fs.rmSync(value.projectRoot, { recursive: true, force: true });
    }
});

test('a fresh preview session rebuilds recovery state from the persisted effective pointer', async () => {
    const value = fixture();
    let restartedPreview;
    let current;
    try {
        value.setEffective({ releaseId: 'release-a', fingerprint: value.fingerprint });
        current = await preview.start(value.params, value.fake);
        assert.equal(current.success, true, JSON.stringify(current));
        assert.equal(current.recovery.state, 'awaiting-runtime');
        assert.equal(current.recovery.previousAcceptedReleaseId, 'release-a');
        assert.equal(current.effectiveReleaseId, null);

        value.events.push({ type: 'connected', creatorVersion: '2.4.15', scene: 'helloworld' });
        assert.equal(preview.get(value.params).recovery.state, 'awaiting-receipt');
        value.events.push({ type: 'receipt', receipt: { outcome: 'applied', releaseId: 'release-a' },
            acceptance: { success: true, outcome: 'runtime-observed', effective: { releaseId: 'release-a' } } });
        assert.equal(preview.get(value.params).recovery.state, 'confirmed');
        await preview.stop(value.params);

        delete require.cache[require.resolve('./content-preview')];
        restartedPreview = require('./content-preview');
        current = await restartedPreview.start(value.params, value.fake);
        assert.equal(current.success, true, JSON.stringify(current));
        assert.equal(current.status, 'waiting-for-runtime');
        assert.equal(current.effectiveReleaseId, null);
        assert.deepEqual(current.recovery, { state: 'awaiting-runtime', previousAcceptedReleaseId: 'release-a',
            selectedReleaseId: 'release-a', confirmedInSession: false });
    } finally {
        if (restartedPreview?.get(value.params).success) await restartedPreview.stop(value.params);
        else if (preview.get(value.params).success) await preview.stop(value.params);
        fs.rmSync(value.projectRoot, { recursive: true, force: true });
    }
});

test('rejects unverified builds, release drift, and unsafe package roots before listening', async () => {
    const value = fixture();
    try {
        value.fake.contentBuild.get = () => ({ success: true, build: { ...value.record, state: 'needs-review' } });
        assert.equal((await preview.start(value.params, value.fake)).error.code, 'BUILD_NOT_COMPLETED');
        value.fake.contentBuild.get = () => ({ success: true, build: value.record });
        value.fake.contentRelease.get = () => ({ success: true, selected: { releaseId: 'another-release', fingerprint: 'c'.repeat(64) } });
        assert.equal((await preview.start(value.params, value.fake)).error.code, 'BUILD_RELEASE_NOT_SELECTED');
        value.fake.contentRelease.get = (params) => params.releaseId
            ? { success: true, release: value.releaseManifest, selected: { releaseId: 'release-a', fingerprint: value.fingerprint } }
            : { success: true, selected: { releaseId: 'release-a', fingerprint: value.fingerprint } };
        value.fake.contentBuild.get = () => ({ success: true, build: { ...value.record,
            outputRoot: path.join(os.tmpdir(), 'outside-build') } });
        assert.equal((await preview.start(value.params, value.fake)).error.code, 'BUILD_RECORD_MISMATCH');
    } finally {
        await preview.stop(value.params);
        fs.rmSync(value.projectRoot, { recursive: true, force: true });
    }
});

test('rejects a changed Creator 2.4 Asset Bundle config after a completed build', async () => {
    const value = fixture();
    const bundleName = 'bundle-a';
    value.record.releaseManifest = { ...value.releaseManifest, delivery: 'asset-bundle', bundleName };
    value.record.artifact = { delivery: 'asset-bundle', bundleName, bundleConfigHash: 'a'.repeat(64),
        configPath: 'web-mobile/assets/bundle-a/config.123abc.json', resources: [] };
    value.fake.contentBuild.get = () => ({ success: true, build: value.record });
    value.fake.contentBuild.verifyOutput = () => ({ success: true, fingerprint: value.fingerprint,
        delivery: 'asset-bundle', bundleName, bundleConfigHash: 'b'.repeat(64),
        configPath: 'web-mobile/assets/bundle-a/config.123abc.json', resources: [] });
    try {
        const result = await preview.start(value.params, value.fake);
        assert.equal(result.error.code, 'BUILD_OUTPUT_CHANGED');
        assert.equal(value.fake.runtimeClosed, undefined);
    } finally {
        await preview.stop(value.params);
        fs.rmSync(value.projectRoot, { recursive: true, force: true });
    }
});
