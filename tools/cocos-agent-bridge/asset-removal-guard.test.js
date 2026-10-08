'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlXjQAAAABJRU5ErkJggg==', 'base64');
test('asset removal fails closed when a serialized resource still references either UUID', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-asset-removal-guard-'));
    const project = path.join(root, 'project');
    const resources = path.join(project, 'assets', 'resources');
    const scenes = path.join(project, 'assets', 'Scene');
    const assetName = 'generated.png';
    const textureUuid = '11111111-1111-4111-8111-111111111111';
    const spriteFrameUuid = '22222222-2222-4222-8222-222222222222';
    const assetPath = path.join(resources, assetName);
    try {
        fs.mkdirSync(resources, { recursive: true }); fs.mkdirSync(scenes, { recursive: true });
        fs.writeFileSync(assetPath, png);
        fs.writeFileSync(`${assetPath}.meta`, JSON.stringify({ importer: 'texture', uuid: textureUuid,
            subMetas: { generated: { importer: 'sprite-frame', uuid: spriteFrameUuid, rawTextureUuid: textureUuid } } }));
        fs.writeFileSync(path.join(scenes, 'scene.fire'), `{"spriteFrame":"${spriteFrameUuid}"}`);
        const sha256 = crypto.createHash('sha256').update(png).digest('hex');
        const result = spawnSync(process.execPath, [path.join(__dirname, 'bridge-host.js'), '--project', project,
            '--creator-version', '2.4.15', '--asset-remove', assetName, '--texture-uuid', textureUuid,
            '--sprite-frame-uuid', spriteFrameUuid, '--source-sha256', sha256], { encoding: 'utf8' });
        assert.equal(result.status, 2);
        assert.match(result.stderr, /ASSET_STILL_REFERENCED:assets\/Scene\/scene\.fire/);
        assert.equal(fs.existsSync(assetPath), true);
        assert.equal(fs.existsSync(`${assetPath}.meta`), true);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
