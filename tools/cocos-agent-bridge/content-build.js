'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const contentRelease = require('./content-release');

const buildIdPattern = /^[a-z0-9][a-z0-9-]{2,31}$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail = (code, message) => ({ success: false, outcome: 'failed', error: { code, message } });
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const recordDir = (root) => path.join(root, '.cocos-agent', 'content-builds');
const recordFile = (root, id) => path.join(recordDir(root), `${id}.json`);

function project(params) {
    if (!params || params.creatorVersion !== '2.4.15' || typeof params.projectRoot !== 'string'
        || !path.isAbsolute(params.projectRoot)) return fail('INVALID_TARGET', 'This build slice requires an absolute Creator 2.4.15 project path.');
    const root = path.resolve(params.projectRoot);
    try { if (!fs.statSync(root).isDirectory()) throw Error('not directory'); }
    catch (_) { return fail('PROJECT_NOT_FOUND', 'Project directory does not exist.'); }
    return { success: true, root };
}

function selectedRelease(root, releaseId, expectedFingerprint) {
    let pointer; let release;
    try {
        pointer = JSON.parse(fs.readFileSync(path.join(root, '.cocos-agent', 'content-releases', 'selected.json'), 'utf8'));
        release = JSON.parse(fs.readFileSync(path.join(root, '.cocos-agent', 'content-releases', `${releaseId}.json`), 'utf8'));
    } catch (error) {
        return fail(error.code === 'ENOENT' ? 'RELEASE_NOT_SELECTED' : 'RELEASE_READ_FAILED', 'Selected content release or its record is missing.');
    }
    if (pointer.releaseId !== releaseId || pointer.fingerprint !== release.fingerprint
        || (expectedFingerprint !== undefined && expectedFingerprint !== pointer.fingerprint))
        return fail('RELEASE_CHANGED', 'The selected release or its expected fingerprint changed.');
    const checked = contentRelease.validate({ projectRoot: root, creatorVersion: '2.4.15', manifest: release });
    if (!checked.success || checked.fingerprint !== pointer.fingerprint)
        return fail('RELEASE_CHANGED', 'Revalidation of the selected release failed.');
    if (release.assets.some((asset) => !uuidPattern.test(asset.resourceUuid || '')))
        return fail('INVALID_RESOURCE_IDENTITY', 'A release asset has no valid Creator texture UUID.');
    return { success: true, release, fingerprint: checked.fingerprint };
}

function realPathWithin(root, candidate) {
    const realRoot = fs.realpathSync(root);
    let existing = path.resolve(candidate);
    while (!fs.existsSync(existing)) {
        const parent = path.dirname(existing);
        if (parent === existing) return false;
        existing = parent;
    }
    const realExisting = fs.realpathSync(existing);
    return realExisting === realRoot || realExisting.startsWith(`${realRoot}${path.sep}`);
}

function resolveCreatorExecutable(options = {}) {
    const configured = options.creatorExecutable || process.env.COCOS_CREATOR_2_4_15_EXECUTABLE
        || '/Applications/Cocos/Creator/2.4.15/CocosCreator.app/Contents/MacOS/CocosCreator';
    let executable;
    try {
        executable = fs.realpathSync(configured);
        if (!fs.statSync(executable).isFile()) throw Error('not executable');
        fs.accessSync(executable, fs.constants.X_OK);
    } catch (_) { return fail('CREATOR_NOT_FOUND', 'Creator 2.4.15 executable is not available.'); }
    const match = executable.match(/^(.*\.app)\/Contents\/MacOS\/[^/]+$/);
    if (!match) return fail('CREATOR_VERSION_UNVERIFIED', 'Creator executable must be inside a versioned macOS application bundle.');
    let plist;
    try { plist = fs.readFileSync(path.join(match[1], 'Contents', 'Info.plist'), 'utf8'); }
    catch (_) { return fail('CREATOR_VERSION_UNVERIFIED', 'Creator application version could not be read.'); }
    const version = plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
    if (version !== '2.4.15') return fail('CREATOR_VERSION_MISMATCH', 'The configured Creator application is not version 2.4.15.');
    return { success: true, executable, appBundle: match[1] };
}

function configuredStartScene(root) {
    const configurationFiles = [path.join(root, 'settings', 'builder.json'), path.join(root, 'settings', 'builder.panel.json')];
    let startScene = null;
    for (const filename of configurationFiles) {
        try {
            const config = JSON.parse(fs.readFileSync(filename, 'utf8'));
            if (uuidPattern.test(config.startScene || '')) { startScene = config.startScene.toLowerCase(); break; }
        } catch (_) { /* Try the other Creator build settings file. */ }
    }
    if (!startScene) return fail('BUILD_SCENE_NOT_CONFIGURED', 'Creator build settings do not identify a valid startScene UUID.');
    let sceneFound = false;
    const assetsRoot = path.join(root, 'assets');
    if (!fs.existsSync(assetsRoot)) return fail('BUILD_SCENE_NOT_FOUND', 'Project assets directory is missing.');
    const completeWalk = walk(assetsRoot, (filename) => {
        if (!/\.fire\.meta$/i.test(filename)) return;
        try {
            const meta = JSON.parse(fs.readFileSync(filename, 'utf8'));
            const sceneFile = filename.slice(0, -'.meta'.length);
            if (typeof meta.uuid === 'string' && meta.uuid.toLowerCase() === startScene
                && fs.statSync(sceneFile).isFile()) sceneFound = true;
        } catch (_) { /* Ignore unrelated invalid metadata; fail if the configured scene is absent. */ }
    });
    if (!completeWalk) return fail('BUILD_SCENE_SCAN_LIMIT', 'Project contains too many assets to validate its configured start scene.');
    if (!sceneFound) return fail('BUILD_SCENE_NOT_FOUND', 'Configured startScene UUID does not match a scene .meta file.');
    return { success: true, uuid: startScene };
}

function plan(params, options = {}) {
    const target = project(params);
    if (!target.success) return target;
    const { buildId, releaseId, expectedFingerprint } = params;
    if (!buildIdPattern.test(buildId || '') || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(releaseId || '')
        || ['selected', 'effective'].includes(releaseId))
        return fail('INVALID_ARGUMENT', 'Provide safe buildId and selected releaseId values.');
    const selected = selectedRelease(target.root, releaseId, expectedFingerprint);
    if (!selected.success) return selected;
    const startScene = configuredStartScene(target.root);
    if (!startScene.success) return startScene;
    const relativeBuildPath = `build/cocos-agent/${buildId}`;
    const outputRoot = path.resolve(target.root, relativeBuildPath);
    if (!realPathWithin(target.root, outputRoot)) return fail('UNSAFE_BUILD_PATH', 'Build output resolves outside the project.');
    if (fs.existsSync(outputRoot)) return fail('BUILD_OUTPUT_EXISTS', 'Build output must be a new, empty path; existing output is never overwritten.');
    const executable = resolveCreatorExecutable(options);
    if (!executable.success) return executable;
    const buildOptions = `platform=web-mobile;buildPath=./${relativeBuildPath};startScene=${startScene.uuid};debug=false;md5Cache=true`;
    const args = ['--path', target.root, '--build', buildOptions];
    const launcher = process.platform === 'darwin' ? '/usr/bin/open' : executable.executable;
    const launchArgs = process.platform === 'darwin'
        ? ['-n', '-W', '-a', executable.appBundle, '--args', ...args]
        : args;
    return { success: true, outcome: 'ready', creatorVersion: '2.4.15', platform: 'web-mobile',
        projectRoot: target.root, releaseId, fingerprint: selected.fingerprint, buildId,
        delivery: selected.release.delivery, ...(selected.release.delivery === 'asset-bundle' ? { bundleName: selected.release.bundleName } : {}),
        outputRoot, executable: executable.executable, appBundle: executable.appBundle,
        launcher, launchArgs, startScene: startScene.uuid, args,
        includedResources: selected.release.assets.map((asset) => ({ id: asset.id, runtimePath: asset.runtimePath,
            resourceUuid: asset.resourceUuid, ...(asset.spriteFrameUuid ? { spriteFrameUuid: asset.spriteFrameUuid } : {}) })) };
}

function compactUuid(uuid) {
    const hex = uuid.replace(/-/g, '').toLowerCase();
    const encoded = Buffer.from(hex.slice(2), 'hex').toString('base64').replace(/=/g, '');
    return encoded.startsWith('/') ? `${hex.slice(0, 2)}/${encoded.slice(1)}` : `${hex.slice(0, 2)}${encoded}`;
}

function fileVersion(entries, index) {
    if (!Array.isArray(entries)) return null;
    for (let cursor = 0; cursor + 1 < entries.length; cursor += 2) {
        if (entries[cursor] === index && typeof entries[cursor + 1] === 'string') return entries[cursor + 1];
    }
    return null;
}

function findImportFile(outputRoot, bundleRoot, config, index, resourceUuid) {
    const importBase = typeof config.importBase === 'string' ? config.importBase : 'import';
    const directVersion = fileVersion(config.versions?.import, index);
    if (directVersion) {
        const directFile = path.resolve(bundleRoot, importBase, resourceUuid.slice(0, 2), `${resourceUuid}.${directVersion}.json`);
        if (realPathWithin(outputRoot, directFile) && fs.existsSync(directFile)) return directFile;
    }
    for (const [packUuid, indices] of Object.entries(config.packs || {})) {
        if (!Array.isArray(indices) || !indices.includes(index)) continue;
        const packVersion = fileVersion(config.versions?.import, packUuid);
        if (!packVersion || !/^[a-f0-9]+$/i.test(packUuid)) continue;
        const packFile = path.resolve(bundleRoot, importBase, packUuid.slice(0, 2), `${packUuid}.${packVersion}.json`);
        if (realPathWithin(outputRoot, packFile) && fs.existsSync(packFile)) return packFile;
    }
    return null;
}

function spriteFrameImportsTexture(filename, textureUuid) {
    if (!filename) return false;
    try {
        const imported = JSON.parse(fs.readFileSync(filename, 'utf8'));
        const dependencies = Array.isArray(imported) && Array.isArray(imported[1]) ? imported[1] : [];
        return dependencies.includes(compactUuid(textureUuid)) || dependencies.includes(textureUuid);
    } catch (_) { return false; }
}

function walk(root, visit, maxEntries = 50000) {
    const stack = [{ directory: root, depth: 0 }];
    let visited = 0;
    while (stack.length) {
        const current = stack.pop();
        if (current.depth > 14) continue;
        let entries;
        try { entries = fs.readdirSync(current.directory, { withFileTypes: true }); }
        catch (_) { continue; }
        for (const entry of entries) {
            visited += 1;
            if (visited > maxEntries) return false;
            const filename = path.join(current.directory, entry.name);
            if (entry.isDirectory()) stack.push({ directory: filename, depth: current.depth + 1 });
            else if (entry.isFile() && visit(filename) === false) return true;
        }
    }
    return true;
}

function verifyOutput(outputRoot, release) {
    if (!fs.existsSync(outputRoot) || !fs.statSync(outputRoot).isDirectory())
        return fail('BUILD_OUTPUT_MISSING', 'Creator did not produce the planned output directory.');
    let hasIndex = false;
    const configs = [];
    const completeWalk = walk(outputRoot, (filename) => {
        if (path.basename(filename).toLowerCase() === 'index.html') hasIndex = true;
        if (/^config(?:\.[a-f0-9]+)?\.json$/i.test(path.basename(filename))) {
            try {
                const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
                if (value && typeof value.name === 'string' && value.paths && value.uuids && value.types) configs.push({ filename, value });
            } catch (_) { /* Ignore unrelated or non-JSON config files. */ }
        }
    });
    if (!completeWalk) return fail('BUILD_OUTPUT_TOO_LARGE', 'Build output exceeds the bounded inspection limit.');
    if (!hasIndex) return fail('BUILD_OUTPUT_INCOMPLETE', 'No Web-Mobile index.html was found in the output.');
    const expectedBundleName = release.delivery === 'asset-bundle' ? release.bundleName : 'resources';
    for (const candidate of configs) {
        const { filename, value } = candidate;
        if (value.name !== expectedBundleName) continue;
        const bundleRoot = path.dirname(filename);
        if (release.delivery === 'asset-bundle'
            && path.relative(outputRoot, bundleRoot).split(path.sep).join('/') !== `web-mobile/assets/${release.bundleName}`) continue;
        const verified = [];
        let allAssetsPresent = true;
        for (const asset of release.assets) {
            const textureIndex = Object.keys(value.paths).find((key) => {
                const entry = value.paths[key];
                return Array.isArray(entry) && entry[0] === asset.runtimePath
                    && value.types[entry[1]] === 'cc.Texture2D';
            });
            const textureUuid = textureIndex === undefined ? null : value.uuids[Number(textureIndex)];
            const spriteFrameIndex = release.delivery === 'asset-bundle' ? Object.keys(value.paths).find((key) => {
                const entry = value.paths[key];
                return Array.isArray(entry) && entry[0] === asset.runtimePath
                    && value.types[entry[1]] === 'cc.SpriteFrame';
            }) : undefined;
            const spriteFrameUuid = spriteFrameIndex === undefined ? null : value.uuids[Number(spriteFrameIndex)];
            const nativeHash = textureIndex === undefined ? null : fileVersion(value.versions?.native, Number(textureIndex));
            const nativeBase = typeof value.nativeBase === 'string' ? value.nativeBase : 'native';
            const importFile = textureIndex === undefined ? null : findImportFile(outputRoot, bundleRoot, value, Number(textureIndex), asset.resourceUuid);
            const spriteFrameImport = spriteFrameIndex === undefined ? null
                : findImportFile(outputRoot, bundleRoot, value, Number(spriteFrameIndex), asset.spriteFrameUuid);
            const nativeFile = nativeHash && path.resolve(bundleRoot, nativeBase, asset.resourceUuid.slice(0, 2), `${asset.resourceUuid}.${nativeHash}.png`);
            const matches = textureIndex !== undefined && textureUuid === compactUuid(asset.resourceUuid) && importFile
                && nativeFile && realPathWithin(outputRoot, nativeFile) && fs.existsSync(nativeFile);
            const bundleMatches = release.delivery !== 'asset-bundle'
                || (spriteFrameIndex !== undefined && spriteFrameUuid === compactUuid(asset.spriteFrameUuid)
                    && spriteFrameImport && fs.existsSync(spriteFrameImport)
                    && spriteFrameImportsTexture(spriteFrameImport, asset.resourceUuid));
            if (!matches || !bundleMatches) { allAssetsPresent = false; break; }
            verified.push({ id: asset.id, runtimePath: asset.runtimePath, resourceUuid: asset.resourceUuid,
                importFile: path.relative(outputRoot, importFile), nativeFile: path.relative(outputRoot, nativeFile),
                ...(release.delivery === 'asset-bundle' ? { spriteFrameUuid: asset.spriteFrameUuid,
                    spriteFrameImport: path.relative(outputRoot, spriteFrameImport) } : {}) });
        }
        if (allAssetsPresent) {
            const configHash = sha256(fs.readFileSync(filename));
            return { success: true, outcome: 'verified', platform: 'web-mobile', delivery: release.delivery,
                outputRoot, configPath: path.relative(outputRoot, filename), fingerprint: release.fingerprint,
                ...(release.delivery === 'asset-bundle' ? { bundleName: release.bundleName, bundleConfigHash: configHash } : {}),
                resourceCount: verified.length, resources: verified };
        }
    }
    return fail(configs.length ? 'BUILD_ASSET_MISSING' : 'BUILD_RESOURCE_CONFIG_MISSING',
        configs.length ? 'Expected content Bundle does not contain every release texture/SpriteFrame identity and file.'
            : 'No matching content bundle configuration was found in the Web-Mobile output.');
}

function writeRecord(filename, value, exclusive = false) {
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    if (exclusive) return fs.writeFileSync(filename, `${JSON.stringify(value)}\n`, { flag: 'wx', mode: 0o600 });
    const temporary = `${filename}.${process.pid}.tmp`;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { flag: 'wx', mode: 0o600 });
        fs.renameSync(temporary, filename);
    } finally { try { fs.unlinkSync(temporary); } catch (_) { /* renamed */ } }
}

function execute(params, options = {}) {
    const planned = plan(params, options);
    if (!planned.success) return planned;
    const filename = recordFile(planned.projectRoot, planned.buildId);
    if (fs.existsSync(filename)) return fail('BUILD_ID_CONFLICT', 'Build ID already has a persisted operation record.');
    const releaseResult = selectedRelease(planned.projectRoot, planned.releaseId, planned.fingerprint);
    if (!releaseResult.success) return releaseResult;
    const record = { contractVersion: '0.1', buildId: planned.buildId, creatorVersion: planned.creatorVersion,
        platform: planned.platform, projectRoot: planned.projectRoot, releaseId: planned.releaseId,
        fingerprint: planned.fingerprint, outputRoot: planned.outputRoot, state: 'running',
        releaseManifest: releaseResult.release,
        invocation: { launcher: planned.launcher, args: planned.launchArgs,
            creatorExecutable: planned.executable, creatorArgs: planned.args }, startedAt: new Date().toISOString() };
    try { writeRecord(filename, record, true); }
    catch (error) {
        if (error.code === 'EEXIST') return fail('BUILD_ID_CONFLICT', 'Another Host already reserved this buildId.');
        return fail('BUILD_RECORD_WRITE_FAILED', 'Could not reserve the build operation record.');
    }
    try { fs.mkdirSync(path.dirname(planned.outputRoot), { recursive: true }); }
    catch (_) {
        const failed = { ...record, state: 'failed', finishedAt: new Date().toISOString(), error: { code: 'BUILD_PATH_CREATE_FAILED' } };
        writeRecord(filename, failed);
        return fail('BUILD_PATH_CREATE_FAILED', 'Could not create the isolated build parent directory.');
    }
    if (!realPathWithin(planned.projectRoot, planned.outputRoot) || fs.existsSync(planned.outputRoot)) {
        const failed = { ...record, state: 'failed', finishedAt: new Date().toISOString(), error: { code: 'BUILD_OUTPUT_CHANGED', message: 'Output path changed after planning.' } };
        writeRecord(filename, failed);
        return fail('BUILD_OUTPUT_CHANGED', 'Build output path changed or appeared after planning; no build was started.');
    }
    const run = options.spawnSync || spawnSync;
    const timeout = Number.isSafeInteger(options.timeoutMs) && options.timeoutMs > 0
        ? Math.min(options.timeoutMs, 20 * 60 * 1000) : 20 * 60 * 1000;
    let child;
    try { child = run(planned.launcher, planned.launchArgs,
        { cwd: planned.projectRoot, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 }); }
    catch (_) { child = { error: { code: 'SPAWN_FAILED' }, status: null, signal: null }; }
    let result;
    if (child.error || child.status !== 0) {
        const timedOut = child.error?.code === 'ETIMEDOUT';
        const code = timedOut ? 'BUILD_TIMEOUT'
            : child.error?.code === 'ENOENT' ? 'CREATOR_NOT_FOUND' : 'BUILD_FAILED';
        const failed = { ...record, state: timedOut ? 'needs-review' : 'failed', finishedAt: new Date().toISOString(),
            error: { code, signal: child.signal || null, exitCode: Number.isInteger(child.status) ? child.status : null } };
        writeRecord(filename, failed);
        return fail(code, 'Creator Web-Mobile build did not exit successfully.');
    }
    result = verifyOutput(planned.outputRoot, releaseResult.release);
    const completed = result.success
        ? { ...record, state: 'completed', finishedAt: new Date().toISOString(), artifact: result }
        : { ...record, state: 'needs-review', finishedAt: new Date().toISOString(), error: result.error };
    writeRecord(filename, completed);
    return result.success ? { ...result, buildId: planned.buildId, releaseId: planned.releaseId }
        : { ...result, buildId: planned.buildId, releaseId: planned.releaseId };
}

function get(params) {
    const target = project(params);
    if (!target.success) return target;
    if (!buildIdPattern.test(params.buildId || '')) return fail('INVALID_ARGUMENT', 'Provide a valid buildId.');
    try {
        const record = JSON.parse(fs.readFileSync(recordFile(target.root, params.buildId), 'utf8'));
        if (record.projectRoot !== target.root || record.creatorVersion !== '2.4.15') return fail('BUILD_RECORD_MISMATCH', 'Build record belongs to another target.');
        return { success: true, outcome: 'read', build: record };
    } catch (error) { return fail(error.code === 'ENOENT' ? 'BUILD_NOT_FOUND' : 'BUILD_RECORD_INVALID', 'Build operation record is missing or invalid.'); }
}

function reconcile(params) {
    const current = get(params);
    if (!current.success) return current;
    const record = current.build;
    if (record.state === 'completed' || record.state === 'failed') return { ...current, outcome: 'already-terminal' };
    if (!['running', 'needs-review'].includes(record.state) || !record.releaseManifest
        || !path.isAbsolute(record.outputRoot) || !realPathWithin(record.projectRoot, record.outputRoot))
        return fail('BUILD_RECORD_INVALID', 'Build record cannot be reconciled safely.');
    const checked = contentRelease.validate({ projectRoot: record.projectRoot,
        creatorVersion: '2.4.15', manifest: record.releaseManifest });
    if (!checked.success || checked.fingerprint !== record.fingerprint) {
        const needsReview = { ...record, state: 'needs-review', finishedAt: new Date().toISOString(),
            error: { code: 'RELEASE_CHANGED' } };
        writeRecord(recordFile(record.projectRoot, record.buildId), needsReview);
        return fail('RELEASE_CHANGED', 'Current project assets no longer match the build record.');
    }
    const verified = verifyOutput(record.outputRoot, checked.release);
    const reconciled = verified.success
        ? { ...record, state: 'completed', finishedAt: new Date().toISOString(), artifact: verified, error: undefined }
        : { ...record, state: 'needs-review', finishedAt: new Date().toISOString(), error: verified.error };
    writeRecord(recordFile(record.projectRoot, record.buildId), reconciled);
    return verified.success ? { ...verified, buildId: record.buildId, releaseId: record.releaseId, reconciled: true }
        : { ...verified, buildId: record.buildId, releaseId: record.releaseId, reconciled: true };
}

function handle(method, params, options = {}) {
    if (method === 'content.build.plan') return plan(params, options);
    if (method === 'content.build.execute') return execute(params, options);
    if (method === 'content.build.get') return get(params);
    if (method === 'content.build.reconcile') return reconcile(params);
    return fail('UNKNOWN_METHOD', 'Unknown content build method.');
}

module.exports = { handle, plan, execute, get, reconcile, verifyOutput, compactUuid, configuredStartScene };
