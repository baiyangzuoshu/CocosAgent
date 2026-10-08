'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const content = require('./content-release');
const fromScene = require('./content-scene-release');
const { handle } = require('./agent-jsonl');

const samplePng = path.resolve(__dirname, '../../2.4.15NewProject/assets/resources/cocos-agent-batch-red.png');
const uuidRedTexture = '25ee77bd-0be8-4a2e-92c8-a9df97455f41';
const uuidRedFrame = 'c4b25d20-1754-40d2-a1b3-39a3dd0f6f7b';
const uuidBlueTexture = '3796f8b4-6374-4a80-9b48-c7de222db6c3';
const uuidBlueFrame = '093f2b9b-3be6-4a83-9046-e0bb301f6f6c';

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-content-from-scene-'));
    const resourceDir = path.join(root, 'assets', 'resources');
    const recordDir = path.join(root, '.cocos-agent', 'asset-scene-pipelines');
    fs.mkdirSync(resourceDir, { recursive: true });
    fs.mkdirSync(recordDir, { recursive: true });
    const bytes = fs.readFileSync(samplePng);
    const items = [
        { assetName: 'GeneratedRed.png', nodeName: 'Red', textureUuid: uuidRedTexture, spriteFrameUuid: uuidRedFrame, id: 'red', dependsOn: [] },
        { assetName: 'GeneratedBlue.png', nodeName: 'Blue', textureUuid: uuidBlueTexture, spriteFrameUuid: uuidBlueFrame, id: 'blue', dependsOn: ['red'] },
    ];
    for (const item of items) {
        fs.writeFileSync(path.join(resourceDir, item.assetName), bytes);
        fs.writeFileSync(path.join(resourceDir, `${item.assetName}.meta`), JSON.stringify({ importer: 'texture', uuid: item.textureUuid,
            subMetas: { frame: { importer: 'sprite-frame', uuid: item.spriteFrameUuid, rawTextureUuid: item.textureUuid } } }));
        item.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
        item.importStatus = 'imported'; item.sceneStatus = 'applied'; item.previewStatus = 'passed'; item.removalStatus = 'pending';
    }
    const pipelineId = 'd5a5060c-6d5e-45bb-bdb4-9168bca56eef';
    const params = { targets: [{ projectRoot: root, creatorVersion: '2.4.15' }], projectRoot: root,
        creatorVersion: '2.4.15', pipelineId, releaseId: 'generated-release-1', entryAssetName: 'GeneratedBlue.png',
        assets: items.map(({ assetName, id, dependsOn }) => ({ assetName, id, dependsOn })) };
    const pipeline = { contractVersion: '0.1', pipelineId, projectRoot: root, creatorVersion: '2.4.15',
        instanceId: '7238f49b-33ce-41a3-9ab8-c4b4249898ef', sceneName: 'helloworld', state: 'completed', items };
    fs.writeFileSync(path.join(recordDir, `${pipelineId}.json`), JSON.stringify(pipeline));
    const validatePipeline = (request) => ({ success: true, outcome: 'valid', pipelineId,
        projectRoot: root, creatorVersion: '2.4.15', instanceId: pipeline.instanceId, sceneName: pipeline.sceneName,
        items: request.pipelineId === pipelineId ? items.map((item) => ({ assetName: item.assetName, status: 'valid' })) : [] });
    return { root, params, items, validatePipeline };
}

test('plans and stages a runtime release from only completed, live-validated scene assets', () => {
    const value = fixture();
    try {
        const planned = fromScene.plan(value.params, value.validatePipeline);
        assert.equal(planned.success, true);
        assert.equal(planned.outcome, 'ready');
        assert.equal(planned.manifest.entryAssetId, 'blue');
        assert.equal(planned.manifest.assets[1].dependsOn[0], 'red');
        assert.equal(planned.manifest.assets[0].source, 'assets/resources/GeneratedRed.png');
        assert.equal(planned.resources.every((item) => item.status === 'valid'), true);
        assert.equal(fs.existsSync(path.join(value.root, '.cocos-agent', 'content-releases')), false);

        const stagedResponse = handle({ id: 2, method: 'content.fromScene.stage', params: value.params }, {
            assetSceneValidate: value.validatePipeline,
        });
        const staged = stagedResponse.result;
        assert.equal(staged.success, true);
        assert.equal(staged.outcome, 'staged');
        assert.equal(staged.pipelineId, value.params.pipelineId);
        assert.equal(content.get({ projectRoot: value.root, creatorVersion: '2.4.15', releaseId: value.params.releaseId })
            .release.fingerprint, planned.fingerprint);
        assert.equal(fromScene.stage(value.params, value.validatePipeline).idempotent, true);
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('refuses incomplete, changed, or non-valid pipeline assets before staging', () => {
    const value = fixture();
    try {
        const filename = path.join(value.root, '.cocos-agent', 'asset-scene-pipelines', `${value.params.pipelineId}.json`);
        let record = JSON.parse(fs.readFileSync(filename, 'utf8'));
        record.state = 'needs-preview';
        fs.writeFileSync(filename, JSON.stringify(record));
        assert.equal(fromScene.stage(value.params, value.validatePipeline).error.code, 'PIPELINE_NOT_PREVIEWED');
        record.state = 'completed';
        fs.writeFileSync(filename, JSON.stringify(record));
        assert.equal(fromScene.stage(value.params, () => ({ success: true, outcome: 'needs-review', items: [] })).error.code,
            'PIPELINE_VALIDATION_FAILED');
        const png = path.join(value.root, 'assets', 'resources', 'GeneratedRed.png');
        fs.appendFileSync(png, 'changed');
        assert.equal(fromScene.stage(value.params, value.validatePipeline).error.code, 'CONTENT_RELEASE_INVALID');
        assert.equal(fs.existsSync(path.join(value.root, '.cocos-agent', 'content-releases')), false);
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('rejects bad asset mappings and unknown pipeline files', () => {
    const value = fixture();
    try {
        assert.equal(fromScene.plan({ ...value.params, entryAssetName: 'missing.png' }, value.validatePipeline).error.code,
            'MISSING_ENTRY_ASSET');
        assert.equal(fromScene.plan({ ...value.params, assets: [value.params.assets[0], value.params.assets[0]] }, value.validatePipeline)
            .error.code, 'INVALID_ASSET_MAPPING');
        assert.equal(fromScene.plan({ ...value.params, assets: [{ ...value.params.assets[0], assetName: 'outside.png' }] }, value.validatePipeline)
            .error.code, 'MISSING_ENTRY_ASSET');
        assert.equal(fromScene.plan({ ...value.params, entryAssetName: 'GeneratedRed.png', assets: [
            value.params.assets[0], { assetName: 'Ghost.png', id: 'ghost' },
        ] }, value.validatePipeline).error.code, 'ASSET_NOT_IN_PIPELINE');
        assert.equal(handle({ id: 9, method: 'content.fromScene.plan', params: value.params }, {
            assetSceneValidate: value.validatePipeline,
        }).result.outcome, 'ready');
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('derives an extensionless runtime path for case-insensitive PNG extensions', () => {
    const value = fixture();
    try {
        const filename = path.join(value.root, '.cocos-agent', 'asset-scene-pipelines', `${value.params.pipelineId}.json`);
        const record = JSON.parse(fs.readFileSync(filename, 'utf8'));
        const oldName = 'GeneratedBlue.png'; const newName = 'GeneratedBlue.PNG';
        fs.renameSync(path.join(value.root, 'assets', 'resources', oldName), path.join(value.root, 'assets', 'resources', newName));
        fs.renameSync(path.join(value.root, 'assets', 'resources', `${oldName}.meta`), path.join(value.root, 'assets', 'resources', `${newName}.meta`));
        const item = record.items.find((candidate) => candidate.assetName === oldName);
        item.assetName = newName;
        value.items.find((candidate) => candidate.assetName === oldName).assetName = newName;
        fs.writeFileSync(filename, JSON.stringify(record));
        const params = { ...value.params, entryAssetName: newName,
            assets: value.params.assets.map((asset) => asset.assetName === oldName ? { ...asset, assetName: newName } : asset) };
        const planned = fromScene.plan(params, value.validatePipeline);
        assert.equal(planned.success, true);
        assert.equal(planned.manifest.assets.find((asset) => asset.id === 'blue').runtimePath, 'GeneratedBlue');
        assert.equal(fromScene.stage(params, value.validatePipeline).success, true);
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});
