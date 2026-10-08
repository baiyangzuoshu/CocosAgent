'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const releaseTools = require('./content-release');
const buildTools = require('./content-build');
const { handle: agentHandle } = require('./agent-jsonl');

const sourcePng = path.resolve(__dirname, '../../2.4.15NewProject/assets/resources/cocos-agent-batch-red.png');
const textureUuid = '07fe9a99-7f87-4bd8-ace2-39ac085c3624';
const sceneUuid = '2d2f792f-a40c-49bb-a189-ed176a246e49';

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-content-build-'));
    const resourceDir = path.join(root, 'assets', 'resources');
    const sceneDir = path.join(root, 'assets', 'Scene');
    const settingsDir = path.join(root, 'settings');
    const appRoot = path.join(root, 'Creator.app');
    const executable = path.join(appRoot, 'Contents', 'MacOS', 'CocosCreator');
    fs.mkdirSync(resourceDir, { recursive: true });
    fs.mkdirSync(sceneDir, { recursive: true });
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(executable, 'test executable');
    fs.chmodSync(executable, 0o755);
    fs.writeFileSync(path.join(appRoot, 'Contents', 'Info.plist'), '<plist><dict><key>CFBundleShortVersionString</key><string>2.4.15</string></dict></plist>');
    fs.writeFileSync(path.join(sceneDir, 'helloworld.fire'), '{}');
    fs.writeFileSync(path.join(sceneDir, 'helloworld.fire.meta'), JSON.stringify({ uuid: sceneUuid }));
    fs.writeFileSync(path.join(settingsDir, 'builder.json'), JSON.stringify({ startScene: sceneUuid }));
    const bytes = fs.readFileSync(sourcePng);
    const name = 'GeneratedBlue.png';
    fs.writeFileSync(path.join(resourceDir, name), bytes);
    fs.writeFileSync(path.join(resourceDir, `${name}.meta`), JSON.stringify({ importer: 'texture', uuid: textureUuid }));
    const manifest = { contractVersion: '0.1', releaseId: 'release-a', creatorVersion: '2.4.15',
        delivery: 'built-in-resources', entryAssetId: 'blue', assets: [{ id: 'blue', source: `assets/resources/${name}`,
            sha256: crypto.createHash('sha256').update(bytes).digest('hex'), runtimePath: 'GeneratedBlue', dependsOn: [] }] };
    const staged = releaseTools.stage({ projectRoot: root, creatorVersion: '2.4.15', manifest });
    assert.equal(staged.success, true);
    releaseTools.select({ projectRoot: root, creatorVersion: '2.4.15', releaseId: manifest.releaseId, expectedCurrent: null });
    const params = { projectRoot: root, creatorVersion: '2.4.15', releaseId: 'release-a',
        expectedFingerprint: staged.fingerprint, buildId: 'web-smoke-01' };
    return { root, executable, params, manifest };
}

function writeWebBuild(outputRoot, release, options = {}) {
    const webRoot = path.join(outputRoot, 'web-mobile');
    const bundleRoot = path.join(webRoot, 'assets', 'resources');
    fs.mkdirSync(bundleRoot, { recursive: true });
    fs.writeFileSync(path.join(webRoot, 'index.html'), '<!doctype html>');
    const assets = release.assets.map((asset, index) => {
        const imported = path.join(bundleRoot, 'import', asset.resourceUuid.slice(0, 2));
        const native = path.join(bundleRoot, 'native', asset.resourceUuid.slice(0, 2));
        fs.mkdirSync(imported, { recursive: true });
        fs.mkdirSync(native, { recursive: true });
        fs.writeFileSync(path.join(imported, `${asset.resourceUuid}.imp123.json`), '{}');
        fs.writeFileSync(path.join(native, `${asset.resourceUuid}.nat123.png`), 'png');
        return { index, asset };
    });
    const config = { name: 'resources', paths: {}, types: ['cc.SpriteFrame', 'cc.Texture2D'], uuids: [],
        importBase: 'import', nativeBase: 'native', versions: { import: [], native: [] } };
    for (const { index, asset } of assets) {
        config.paths[index] = [asset.runtimePath, 1];
        config.uuids[index] = options.uuidMismatch ? '00/not-the-uuid' : buildTools.compactUuid(asset.resourceUuid);
        config.versions.import.push(index, 'imp123');
        config.versions.native.push(index, 'nat123');
    }
    fs.writeFileSync(path.join(bundleRoot, 'config.abc123.json'), JSON.stringify(config));
    return { webRoot, bundleRoot };
}

test('plans an isolated 2.4 Web-Mobile build from the selected, revalidated release', () => {
    assert.equal(buildTools.compactUuid(textureUuid), '07/pqZf4dL2KziOawIXDYk');
    assert.equal(buildTools.compactUuid('a4ad45d8-6be7-45b6-b2c6-20d56baf4cf5'), 'a4rUXYa+dFtrLGINVrr0z1');
    const value = fixture();
    try {
        const plan = buildTools.plan(value.params, { creatorExecutable: value.executable });
        assert.equal(plan.success, true);
        assert.equal(plan.outcome, 'ready');
        assert.equal(plan.platform, 'web-mobile');
        assert.equal(plan.startScene, sceneUuid);
        assert.equal(fs.existsSync(plan.outputRoot), false);
        assert.deepEqual(plan.args.slice(0, 2), ['--path', value.root]);
        assert.match(plan.args[3], /^platform=web-mobile;buildPath=\.\/build\/cocos-agent\/web-smoke-01;startScene=2d2f792f-a40c-49bb-a189-ed176a246e49;/);
        assert.equal(plan.launcher, process.platform === 'darwin' ? '/usr/bin/open' : fs.realpathSync(value.executable));
        if (process.platform === 'darwin') {
            assert.deepEqual(plan.launchArgs.slice(0, 5), ['-n', '-W', '-a', path.dirname(path.dirname(path.dirname(fs.realpathSync(value.executable)))), '--args']);
            assert.deepEqual(plan.launchArgs.slice(5), plan.args);
        } else assert.deepEqual(plan.launchArgs, plan.args);
        assert.deepEqual(plan.includedResources.map((asset) => asset.resourceUuid), [textureUuid]);
        assert.equal(buildTools.plan({ ...value.params, creatorVersion: '3.8.7' }, { creatorExecutable: value.executable }).error.code,
            'INVALID_TARGET');
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('executes CLI without a shell and accepts only a package containing the selected resource UUID', () => {
    const value = fixture();
    try {
        let invocation;
        const result = buildTools.execute(value.params, { creatorExecutable: value.executable,
            spawnSync(launcher, args, options) {
                invocation = { launcher, args, options };
                const staged = releaseTools.get({ projectRoot: value.root, creatorVersion: '2.4.15', releaseId: 'release-a' }).release;
                const checked = releaseTools.validate({ projectRoot: value.root, creatorVersion: '2.4.15', manifest: staged });
                writeWebBuild(path.join(value.root, 'build', 'cocos-agent', value.params.buildId), checked.release);
                return { status: 0, stdout: '', stderr: '', signal: null };
            } });
        assert.equal(result.success, true);
        assert.equal(result.outcome, 'verified');
        assert.equal(result.resourceCount, 1);
        assert.equal(invocation.launcher, process.platform === 'darwin' ? '/usr/bin/open' : fs.realpathSync(value.executable));
        if (process.platform === 'darwin') assert.deepEqual(invocation.args.slice(0, 5), ['-n', '-W', '-a', path.dirname(path.dirname(path.dirname(fs.realpathSync(value.executable)))), '--args']);
        assert.equal(invocation.options.cwd, value.root);
        assert.equal(invocation.options.shell, undefined);
        assert.equal(invocation.options.timeout, 20 * 60 * 1000);
        assert.equal(buildTools.get(value.params).build.state, 'completed');
        assert.equal(agentHandle({ id: 12, method: 'content.build.get', params: value.params }).result.build.buildId, 'web-smoke-01');
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('persists a build timeout as uncertain so reconciliation can inspect output without relaunching Creator', () => {
    const value = fixture();
    try {
        const result = buildTools.execute(value.params, { creatorExecutable: value.executable,
            spawnSync() { return { error: { code: 'ETIMEDOUT' }, status: null, signal: null }; } });
        assert.equal(result.success, false);
        assert.equal(result.error.code, 'BUILD_TIMEOUT');
        assert.equal(buildTools.get(value.params).build.state, 'needs-review');
        const reconciled = buildTools.reconcile(value.params);
        assert.equal(reconciled.success, false);
        assert.equal(reconciled.reconciled, true);
        assert.equal(buildTools.get(value.params).build.state, 'needs-review');
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('verifies Creator 2.4 texture import data stored in a resources bundle pack', () => {
    const value = fixture();
    try {
        const staged = releaseTools.get({ projectRoot: value.root, creatorVersion: '2.4.15', releaseId: 'release-a' }).release;
        const checked = releaseTools.validate({ projectRoot: value.root, creatorVersion: '2.4.15', manifest: staged });
        const outputRoot = path.join(value.root, 'packed-build');
        const { bundleRoot } = writeWebBuild(outputRoot, checked.release);
        const configPath = path.join(bundleRoot, fs.readdirSync(bundleRoot).find((name) => /^config.*\.json$/.test(name)));
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const asset = checked.release.assets[0];
        const directImport = path.join(bundleRoot, 'import', asset.resourceUuid.slice(0, 2), `${asset.resourceUuid}.imp123.json`);
        fs.unlinkSync(directImport);

        const packUuid = '045d29faf';
        const packVersion = '8ff53';
        config.packs = { [packUuid]: [0] };
        config.versions.import = [packUuid, packVersion];
        fs.writeFileSync(configPath, JSON.stringify(config));
        const packedImport = path.join(bundleRoot, 'import', packUuid.slice(0, 2), `${packUuid}.${packVersion}.json`);
        fs.mkdirSync(path.dirname(packedImport), { recursive: true });
        fs.writeFileSync(packedImport, JSON.stringify({ type: 'cc.Texture2D', data: 'packed texture settings' }));

        const verified = buildTools.verifyOutput(outputRoot, checked.release);
        assert.equal(verified.success, true);
        assert.equal(verified.resources[0].importFile, path.relative(outputRoot, packedImport));

        fs.unlinkSync(packedImport);
        assert.equal(buildTools.verifyOutput(outputRoot, checked.release).error.code, 'BUILD_ASSET_MISSING');
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('reconciles an interrupted Host from a completed package without launching Creator again', () => {
    const value = fixture();
    try {
        const release = releaseTools.get({ projectRoot: value.root, creatorVersion: '2.4.15', releaseId: 'release-a' }).release;
        const checked = releaseTools.validate({ projectRoot: value.root, creatorVersion: '2.4.15', manifest: release });
        const outputRoot = path.join(value.root, 'build', 'cocos-agent', value.params.buildId);
        writeWebBuild(outputRoot, checked.release);
        const buildDirectory = path.join(value.root, '.cocos-agent', 'content-builds');
        fs.mkdirSync(buildDirectory, { recursive: true });
        fs.writeFileSync(path.join(buildDirectory, `${value.params.buildId}.json`), JSON.stringify({
            contractVersion: '0.1', buildId: value.params.buildId, creatorVersion: '2.4.15', platform: 'web-mobile',
            projectRoot: value.root, releaseId: 'release-a', fingerprint: checked.fingerprint,
            releaseManifest: checked.release, outputRoot, state: 'running', startedAt: new Date().toISOString(),
        }));
        const result = buildTools.handle('content.build.reconcile', {
            projectRoot: value.root, creatorVersion: '2.4.15', buildId: value.params.buildId,
        }, { spawnSync: () => { throw new Error('reconcile must not launch Creator'); } });
        assert.equal(result.success, true);
        assert.equal(result.reconciled, true);
        assert.equal(buildTools.get(value.params).build.state, 'completed');
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('rejects stale releases, occupied output paths, UUID mismatches and failed Creator processes', () => {
    const value = fixture();
    try {
        const occupied = buildTools.plan(value.params, { creatorExecutable: value.executable });
        fs.mkdirSync(occupied.outputRoot, { recursive: true });
        assert.equal(buildTools.plan(value.params, { creatorExecutable: value.executable }).error.code, 'BUILD_OUTPUT_EXISTS');
        fs.rmSync(occupied.outputRoot, { recursive: true, force: true });

        const builderConfig = path.join(value.root, 'settings', 'builder.json');
        fs.writeFileSync(builderConfig, JSON.stringify({ startScene: '00000000-0000-4000-8000-000000000000' }));
        assert.equal(buildTools.plan(value.params, { creatorExecutable: value.executable }).error.code, 'BUILD_SCENE_NOT_FOUND');
        fs.writeFileSync(builderConfig, JSON.stringify({ startScene: sceneUuid }));

        const staged = releaseTools.get({ projectRoot: value.root, creatorVersion: '2.4.15', releaseId: 'release-a' }).release;
        const checked = releaseTools.validate({ projectRoot: value.root, creatorVersion: '2.4.15', manifest: staged });
        const invalidOutput = path.join(value.root, 'candidate-output');
        const { bundleRoot } = writeWebBuild(invalidOutput, checked.release, { uuidMismatch: true });
        assert.equal(buildTools.verifyOutput(invalidOutput, checked.release).error.code, 'BUILD_ASSET_MISSING');
        fs.rmSync(bundleRoot, { recursive: true, force: true });

        const failure = buildTools.execute({ ...value.params, buildId: 'web-failure-01' }, { creatorExecutable: value.executable,
            spawnSync: () => ({ status: 1, stdout: '', stderr: 'failed', signal: null }) });
        assert.equal(failure.error.code, 'BUILD_FAILED');
        assert.equal(buildTools.get({ ...value.params, buildId: 'web-failure-01' }).build.state, 'failed');

        const incomplete = buildTools.execute({ ...value.params, buildId: 'web-review-01' }, { creatorExecutable: value.executable,
            spawnSync(_executable, _args, options) {
                const stagedRelease = releaseTools.get({ projectRoot: value.root, creatorVersion: '2.4.15', releaseId: 'release-a' }).release;
                const valid = releaseTools.validate({ projectRoot: value.root, creatorVersion: '2.4.15', manifest: stagedRelease });
                writeWebBuild(path.join(value.root, 'build', 'cocos-agent', 'web-review-01'), valid.release, { uuidMismatch: true });
                return { status: 0, stdout: '', stderr: '', signal: null };
            } });
        assert.equal(incomplete.error.code, 'BUILD_ASSET_MISSING');
        assert.equal(buildTools.get({ ...value.params, buildId: 'web-review-01' }).build.state, 'needs-review');

        fs.appendFileSync(path.join(value.root, 'assets', 'resources', 'GeneratedBlue.png'), 'changed');
        assert.equal(buildTools.plan(value.params, { creatorExecutable: value.executable }).error.code, 'RELEASE_CHANGED');
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});
