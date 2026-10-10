'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-prefab-inspect-'));
const prefabUuid = '24b2ed3b-11ce-4e40-9fc5-8428a6bc9233';
const rootUuid = 'AgentRoot_01';
const childUuid = 'AgentBadge_01';
const prefabPath = path.join(root, 'assets', 'fixtures', 'Agent.prefab');
const metaPath = `${prefabPath}.meta`;
const serialized = [
    { __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'AgentPrefab', _id: rootUuid, _children: [{ __id__: 2 }], _components: [{ __id__: 3 }],
        _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] } },
    { __type__: 'cc.Node', _name: 'Badge', _id: childUuid, _parent: { __id__: 1 }, _children: [], _components: [],
        _trs: { array: [4, 5, 0, 0, 0, 0, 1, 1, 1, 1] } },
    { __type__: 'cc.Label', _node: { __id__: 1 }, _enabled: true, _string: 'fixture' },
];

try {
    fs.mkdirSync(path.dirname(prefabPath), { recursive: true });
    const bytes = Buffer.from(JSON.stringify(serialized));
    fs.writeFileSync(prefabPath, bytes);
    fs.writeFileSync(metaPath, JSON.stringify({ importer: 'prefab', uuid: prefabUuid }));
    const result = spawnSync(process.execPath, [path.join(__dirname, 'prefab-source-inspect-host.js'),
        '--project', root, '--creator-version', '2.4.15', '--prefab-uuid', prefabUuid], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr);
    const line = result.stdout.trim().replace(/^command\.result /, '');
    const output = JSON.parse(line);
    assert.strictEqual(output.command, 'prefab.source.inspect');
    assert.strictEqual(output.prefabUuid, prefabUuid);
    assert.strictEqual(output.prefabPath, 'assets/fixtures/Agent.prefab');
    assert.strictEqual(output.sourceSha256, crypto.createHash('sha256').update(bytes).digest('hex'));
    assert.deepStrictEqual(output.nodes.map((node) => [node.path, node.uuid]), [
        ['AgentPrefab', rootUuid], ['AgentPrefab/Badge', childUuid],
    ]);
    assert.deepStrictEqual(output.nodes[0].components, [{ classId: 'cc.Label', enabled: true }]);
    assert.deepStrictEqual(output.nodes[1].transform.position, { x: 4, y: 5 });

    fs.writeFileSync(metaPath, JSON.stringify({ importer: 'prefab', uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }));
    const mismatch = spawnSync(process.execPath, [path.join(__dirname, 'prefab-source-inspect-host.js'),
        '--project', root, '--creator-version', '2.4.15', '--prefab-uuid', prefabUuid], { encoding: 'utf8' });
    assert.notStrictEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /PREFAB_UUID_NOT_FOUND/);
    process.stdout.write('Prefab source inspection verifies unique metadata identity, hierarchy, fields, and source digest\n');
} finally {
    fs.rmSync(root, { recursive: true, force: true });
}
