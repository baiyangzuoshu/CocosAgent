'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const contentRelease = require('./content-release');
const assetSceneValidation = require('./asset-scene-validation');

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const releaseIdPattern = /^(?!selected$|effective$)[a-z0-9][a-z0-9._-]{0,63}$/;
const assetIdPattern = /^[a-z][a-z0-9_-]{0,63}$/;
const assetNamePattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i;
const fail = (code, message, details) => ({ success: false, outcome: 'failed', error: { code, message }, ...(details ? { details } : {}) });

function pipelineFile(projectRoot, pipelineId) {
    return path.join(projectRoot, '.cocos-agent', 'asset-scene-pipelines', `${pipelineId}.json`);
}

function readPipeline(projectRoot, pipelineId) {
    const filename = pipelineFile(projectRoot, pipelineId);
    for (const directory of [path.join(projectRoot, '.cocos-agent'), path.join(projectRoot, '.cocos-agent', 'asset-scene-pipelines')]) {
        const directoryStat = fs.lstatSync(directory);
        if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())
            throw Object.assign(new Error('Pipeline record directory is not a regular project directory.'), { code: 'INVALID_RECORD_DIRECTORY' });
    }
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Object.assign(new Error('Pipeline record is not a regular file.'), { code: 'INVALID_RECORD_FILE' });
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function validTarget(params) {
    return params && typeof params.projectRoot === 'string' && path.isAbsolute(params.projectRoot)
        && params.creatorVersion === '2.4.15' && Array.isArray(params.targets) && params.targets.length > 0
        && params.targets.every((target) => target && typeof target.projectRoot === 'string' && path.isAbsolute(target.projectRoot)
            && ['2.4.15', '3.8.7'].includes(target.creatorVersion))
        && params.targets.filter((target) => path.resolve(target.projectRoot) === path.resolve(params.projectRoot)
            && target.creatorVersion === '2.4.15').length === 1;
}

function validateInput(params) {
    if (!validTarget(params) || !idPattern.test(params.pipelineId || '') || !releaseIdPattern.test(params.releaseId || '')
        || !assetNamePattern.test(params.entryAssetName || '') || !Array.isArray(params.assets)
        || params.assets.length < 1 || params.assets.length > 16) {
        return fail('INVALID_ARGUMENT', 'Provide one exact Creator 2.4.15 project, pipeline/release IDs, an entry PNG, and 1–16 asset mappings.');
    }
    const names = new Set();
    const ids = new Set();
    for (const item of params.assets) {
        if (!item || Object.keys(item).some((key) => !['assetName', 'id', 'dependsOn'].includes(key))
            || !assetNamePattern.test(item.assetName || '') || names.has(item.assetName.toLowerCase())
            || !assetIdPattern.test(item.id || '') || ids.has(item.id)
            || (item.dependsOn !== undefined && (!Array.isArray(item.dependsOn)
                || item.dependsOn.some((dependency) => !assetIdPattern.test(dependency))
                || new Set(item.dependsOn).size !== item.dependsOn.length))) {
            return fail('INVALID_ASSET_MAPPING', 'Asset mappings need unique PNG names and IDs with valid dependency IDs.');
        }
        names.add(item.assetName.toLowerCase());
        ids.add(item.id);
    }
    if (!names.has(params.entryAssetName.toLowerCase())) return fail('MISSING_ENTRY_ASSET', 'Entry asset must be included in the asset mappings.');
    return null;
}

function plan(params, validatePipeline = assetSceneValidation.validate) {
    const invalid = validateInput(params);
    if (invalid) return invalid;
    const projectRoot = path.resolve(params.projectRoot);
    let pipeline;
    try { pipeline = readPipeline(projectRoot, params.pipelineId); }
    catch (error) { return fail(error.code === 'ENOENT' ? 'PIPELINE_NOT_FOUND' : 'PIPELINE_READ_FAILED', error.message); }
    if (pipeline.contractVersion !== '0.1' || pipeline.projectRoot !== projectRoot
        || pipeline.creatorVersion !== '2.4.15' || pipeline.pipelineId !== params.pipelineId)
        return fail('PIPELINE_TARGET_MISMATCH', 'Asset-scene pipeline belongs to another project or Creator version.');
    if (pipeline.state !== 'completed') return fail('PIPELINE_NOT_PREVIEWED', 'Only a completed and preview-accepted asset-scene pipeline can become a content release.');
    if (!Array.isArray(pipeline.items) || pipeline.items.length < 1
        || pipeline.items.some((item) => !item || typeof item !== 'object' || item.importStatus !== 'imported' || item.sceneStatus !== 'applied'
            || item.previewStatus !== 'passed' || item.removalStatus === 'removed'
            || !/^[a-f0-9]{64}$/.test(item.sha256 || '') || !idPattern.test(item.textureUuid || '')
            || !idPattern.test(item.spriteFrameUuid || '') || !assetNamePattern.test(item.assetName || ''))
        || new Set(pipeline.items.map((item) => item.assetName.toLowerCase())).size !== pipeline.items.length) {
        return fail('PIPELINE_ITEMS_UNVERIFIED', 'Pipeline items must have imported identities, applied scene references, and accepted previews.');
    }
    const pipelineItems = new Map(pipeline.items.map((item) => [item.assetName.toLowerCase(), item]));
    const mappings = [];
    for (const mapping of params.assets) {
        const item = pipelineItems.get(mapping.assetName.toLowerCase());
        if (!item || item.removalStatus === 'removed') return fail('ASSET_NOT_IN_PIPELINE', `Asset is not retained by this pipeline: ${mapping.assetName}`);
        const baseName = path.basename(item.assetName).replace(/\.png$/i, '');
        mappings.push({ id: mapping.id, source: `assets/resources/${item.assetName}`, sha256: item.sha256,
            runtimePath: baseName, dependsOn: mapping.dependsOn || [] });
    }
    const validation = validatePipeline({ targets: params.targets, projectRoot, creatorVersion: '2.4.15', pipelineId: params.pipelineId });
    if (!validation.success || validation.outcome !== 'valid' || !Array.isArray(validation.items)
        || validation.pipelineId !== pipeline.pipelineId || path.resolve(validation.projectRoot || '') !== projectRoot
        || validation.creatorVersion !== '2.4.15' || validation.instanceId !== pipeline.instanceId
        || validation.sceneName !== pipeline.sceneName || validation.items.length !== pipeline.items.length) {
        return fail('PIPELINE_VALIDATION_FAILED', 'Revalidate all imported resources and scene references before staging a content release.', validation);
    }
    const validationByName = new Map(validation.items.map((item) => [item.assetName.toLowerCase(), item]));
    if (validationByName.size !== pipeline.items.length
        || pipeline.items.some((item) => validationByName.get(item.assetName.toLowerCase())?.status !== 'valid')
        || mappings.some((item) => validationByName.get(path.basename(item.source).toLowerCase())?.status !== 'valid'))
        return fail('ASSET_VALIDATION_MISMATCH', 'A mapped PNG did not pass the current Creator validation.');
    const manifest = { contractVersion: '0.1', releaseId: params.releaseId, creatorVersion: '2.4.15',
        delivery: 'built-in-resources', entryAssetId: params.assets.find((item) => item.assetName.toLowerCase() === params.entryAssetName.toLowerCase()).id,
        assets: mappings };
    const checked = contentRelease.validate({ projectRoot, creatorVersion: '2.4.15', manifest });
    if (!checked.success) return fail('CONTENT_RELEASE_INVALID', 'The generated runtime release manifest failed validation.', checked.error);
    const resources = params.assets.map((mapping) => {
        const source = pipelineItems.get(mapping.assetName.toLowerCase());
        const verified = validationByName.get(mapping.assetName.toLowerCase());
        return { assetName: source.assetName, assetId: mapping.id, textureUuid: source.textureUuid,
            spriteFrameUuid: source.spriteFrameUuid, status: verified.status };
    });
    return { success: true, outcome: 'ready', pipelineId: params.pipelineId, projectRoot, creatorVersion: '2.4.15',
        manifest: checked.release, fingerprint: checked.fingerprint, resources };
}

function stage(params, validatePipeline = assetSceneValidation.validate, stageRelease = contentRelease.stage) {
    const planned = plan(params, validatePipeline);
    if (!planned.success) return planned;
    const staged = stageRelease({ projectRoot: planned.projectRoot, creatorVersion: planned.creatorVersion, manifest: planned.manifest });
    if (!staged.success) return staged;
    return { ...staged, pipelineId: planned.pipelineId, manifest: planned.manifest, resources: planned.resources };
}

function handle(method, params, adapters = {}) {
    if (method === 'content.fromScene.plan') return plan(params, adapters.validatePipeline || assetSceneValidation.validate);
    if (method === 'content.fromScene.stage') return stage(params,
        adapters.validatePipeline || assetSceneValidation.validate, adapters.stageRelease || contentRelease.stage);
    return fail('UNKNOWN_METHOD', 'Unknown content-from-scene method.');
}

module.exports = { handle, plan, stage };
