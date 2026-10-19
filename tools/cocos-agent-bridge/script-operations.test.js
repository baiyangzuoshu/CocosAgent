'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const crypto = require('node:crypto');
const scripts = require('./script-contract');
const uuid = '12345678-1234-4123-8123-123456789012';
function setup(t, behavior = 'compile') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-script-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'assets/Script'), { recursive: true });
    fs.writeFileSync(path.join(root, 'assets/Script/Test.js'), 'var count = 0;\n');
    fs.writeFileSync(path.join(root, 'assets/Script/Test.js.meta'), JSON.stringify({ importer: 'javascript', uuid }));
    const editor = { assetdb: { urlToUuid: () => uuid, refresh(url, callback) {
        if (behavior === 'error') { callback(new Error('Injected import error')); return; }
        if (behavior !== 'compile' && !behavior.startsWith('inline')) { callback(null); return; }
        setTimeout(() => {
            const src = path.join(root, 'temp/quick-scripts/src/assets/Script/Test.js'); const dst = path.join(root, 'temp/quick-scripts/dst/assets/Script/Test.js');
            fs.mkdirSync(path.dirname(src), { recursive: true }); fs.mkdirSync(path.dirname(dst), { recursive: true });
            const source = fs.readFileSync(path.join(root, 'assets/Script/Test.js'), 'utf8');
            if (behavior.startsWith('inline')) {
                fs.writeFileSync(src, source);
                const map = { version: 3, sources: [behavior === 'inline-wrong-path' ? 'assets/Other.js' : 'assets/Script/Test.js'],
                    sourcesContent: [behavior === 'inline-wrong-source' ? 'var count = 0;\n' : source] };
                const output = `${behavior === 'inline-invalid-code' ? 'var count = ;' : source}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}\n`;
                fs.writeFileSync(dst, output);
                // Stale side files reproduce the real incremental import path.
                fs.writeFileSync(`${src}.map`, JSON.stringify({ sources: ['assets/Script/Test.js'], sourcesContent: ['var count = 0;\n'] }));
                fs.writeFileSync(path.join(root, 'temp/quick-scripts/dst/__file_stats__.json'), JSON.stringify({ version: 'old', stats: {} }));
                if (behavior === 'inline-stale') fs.utimesSync(dst, new Date(0), new Date(0));
                callback(null); return;
            }
            fs.writeFileSync(src, source); fs.writeFileSync(`${src}.map`, JSON.stringify({ sources: ['assets/Script/Test.js'], sourcesContent: [source] }));
            fs.writeFileSync(dst, source);
            fs.writeFileSync(path.join(root, 'temp/quick-scripts/dst/__file_stats__.json'), JSON.stringify({ version: 'fixture', stats: { [src]: fs.statSync(src).mtime.toISOString() } }));
            callback(null);
        }, 15);
    } } };
    const service = scripts.createScriptService(root, editor, { timeoutMs: 350 });
    const before = scripts.readScript(root, 'Script/Test.js');
    const identity = { scriptPath: 'Script/Test.js', scriptUuid: uuid, expectedSha256: before.sourceSha256, edits: [{ before: 'count = 0', after: 'count = 1' }] };
    return { root, service, identity, before, editor };
}
function setupCreate(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-script-create-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const assets = path.join(root, 'assets'); fs.mkdirSync(assets, { recursive: true });
    const uuids = ['12345678-1234-4123-8123-123456789012', '22345678-1234-4123-8123-123456789012'];
    let uuidIndex = 0; let activeUuid = null;
    const assetdb = {
        exists(url) { return fs.existsSync(path.join(assets, url.slice('db://assets/'.length))); },
        urlToUuid(url) { return url === 'db://assets/Player.js' ? activeUuid : null; },
        create(url, source, callback) {
            const filename = path.join(assets, url.slice('db://assets/'.length));
            fs.writeFileSync(filename, source);
            activeUuid = uuids[uuidIndex++];
            fs.writeFileSync(`${filename}.meta`, JSON.stringify({ importer: 'javascript', uuid: activeUuid }));
            callback(null, { uuid: activeUuid, url });
        },
        refresh(url, callback) {
            const source = fs.readFileSync(path.join(assets, url.slice('db://assets/'.length)), 'utf8');
            const scriptPath = url.slice('db://assets/'.length);
            const src = path.join(root, 'temp/quick-scripts/src/assets', scriptPath);
            const dst = path.join(root, 'temp/quick-scripts/dst/assets', scriptPath);
            fs.mkdirSync(path.dirname(src), { recursive: true }); fs.mkdirSync(path.dirname(dst), { recursive: true });
            fs.writeFileSync(src, source);
            fs.writeFileSync(`${src}.map`, JSON.stringify({ sources: [`assets/${scriptPath}`], sourcesContent: [source] }));
            fs.writeFileSync(dst, source);
            fs.writeFileSync(path.join(root, 'temp/quick-scripts/dst/__file_stats__.json'), JSON.stringify({ version: 'fixture', stats: { [src]: fs.statSync(src).mtime.toISOString() } }));
            callback(null);
        },
        delete(urls, callback) {
            for (const url of urls) {
                const filename = path.join(assets, url.slice('db://assets/'.length));
                fs.rmSync(filename, { force: true }); fs.rmSync(`${filename}.meta`, { force: true });
                activeUuid = null;
            }
            callback(null, []);
        },
    };
    const editor = { assetdb, Utils: { UuidUtils: { compressUuid: () => '0123456789012345678901' } } };
    const service = scripts.createScriptService(root, editor, { timeoutMs: 350 });
    return { root, service, assetdb };
}
test('packaged Creator and Host script contracts use identical implementation', () => {
    assert.equal(fs.readFileSync(path.join(__dirname, 'script-contract.js'), 'utf8'), fs.readFileSync(path.resolve(__dirname, '../../2.4.15NewProject/packages/cocos-agent-bridge/script-operations.js'), 'utf8'));
});
test('bounded project search finds TypeScript by content and returns asset identity', async (t) => {
    const { root, service } = setup(t);
    const scriptPath = path.join(root, 'assets/Scripts/UI/UIRootUICtrl.ts');
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    const source = 'class UIRootUICtrl { loginFailure() { return "retry"; } }\n';
    const meta = JSON.stringify({ importer: 'typescript', uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    fs.writeFileSync(scriptPath, source);
    fs.writeFileSync(`${scriptPath}.meta`, meta);

    const result = await service.execute('project.search', { query: 'loginFailure', scope: 'code' });
    assert.equal(result.total, 1);
    assert.equal(result.items[0].path, 'Scripts/UI/UIRootUICtrl.ts');
    assert.equal(result.items[0].uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.equal(result.items[0].importer, 'typescript');
    assert.equal(result.items[0].matches[0].line, 1);
    assert.equal(scripts.readScript(root, 'Scripts/UI/UIRootUICtrl.ts').source, source);
});
test('read/plan reject traversal, symlinks, stale identity, ambiguous edits and syntax errors before a write', (t) => {
    const { root, identity } = setup(t);
    assert.throws(() => scripts.readScript(root, '../Test.js'), /INVALID_INPUT/);
    fs.symlinkSync(path.join(root, 'assets/Script/Test.js'), path.join(root, 'assets/Script/Link.js'));
    assert.throws(() => scripts.readScript(root, 'Script/Link.js'), /UNSAFE_PATH/);
    assert.throws(() => scripts.plan(root, { ...identity, expectedSha256: '0'.repeat(64) }), /SCRIPT_STALE/);
    assert.throws(() => scripts.plan(root, { ...identity, edits: [{ before: 'count = 0', after: 'count = ;' }] }), (e) => e.code === 'SCRIPT_SYNTAX_ERROR');
    assert.throws(() => scripts.plan(root, { ...identity, edits: [{ before: ' ', after: 'b' }] }), /EDIT_NOT_UNIQUE/);
    assert.equal(fs.readFileSync(path.join(root, 'assets/Script/Test.js'), 'utf8'), 'var count = 0;\n');
});
test('exact compile evidence, source readback, duplicate refusal, compensation conflict and fresh-ID replay', async (t) => {
    const { root, service, identity, before } = setup(t); const operationId = crypto.randomUUID();
    const applied = await service.execute('script.patch', { ...identity, operationId, action: 'apply' });
    assert.equal(applied.outcome, 'needs-runtime'); assert.equal(applied.record.compilation.status, 'compiled');
    assert.equal(applied.current.matchesAfter, true); assert.equal(applied.current.metaSha256, before.metaSha256);
    await assert.rejects(service.execute('script.patch', { ...identity, operationId, action: 'apply' }), /OPERATION_ID_EXISTS/);
    fs.appendFileSync(path.join(root, 'assets/Script/Test.js'), '// human edit\n');
    await assert.rejects(service.execute('script.patch', { operationId, action: 'compensate' }), /SCRIPT_COMPENSATION_CONFLICT/);
    fs.writeFileSync(path.join(root, 'assets/Script/Test.js'), 'var count = 1;\n');
    assert.equal((await service.execute('script.patch', { operationId, action: 'compensate' })).record.state, 'compensated');
    const replayId = crypto.randomUUID();
    assert.equal((await service.execute('script.patch', { operationId: replayId, sourceOperationId: operationId, action: 'replay' })).record.sourceOperationId, operationId);
    assert.equal((await service.execute('script.patch', { operationId: replayId, action: 'compensate' })).current.matchesBefore, true);
});
test('compiler timeout persists needs-review and exact backup; get cannot retry, reconciliation preserves later edits', async (t) => {
    const { root, service, identity } = setup(t, 'timeout'); const operationId = crypto.randomUUID();
    const result = await service.execute('script.patch', { ...identity, action: 'apply', operationId });
    assert.equal(result.outcome, 'needs-review'); assert.equal(result.error.code, 'SCRIPT_COMPILE_TIMEOUT');
    const get = await service.execute('script.operation.get', { operationId }); assert.equal(get.outcome, 'needs-review');
    const record = JSON.parse(fs.readFileSync(path.join(root, '.cocos-agent/script-operations', `${operationId}.json`)));
    assert.equal(record.beforeSource, 'var count = 0;\n');
    fs.writeFileSync(path.join(root, 'assets/Script/Test.js'), '// later edit\n');
    await assert.rejects(service.execute('script.patch', { action: 'reconcile', operationId }), /SCRIPT_RECONCILE_CONFLICT/);
    assert.equal(fs.readFileSync(path.join(root, 'assets/Script/Test.js'), 'utf8'), '// later edit\n');
});
test('known import error reports confirmed source side effect and a recoverable original ID', async (t) => {
    const { service, identity } = setup(t, 'error'); const operationId = crypto.randomUUID();
    const result = await service.execute('script.patch', { ...identity, action: 'apply', operationId });
    assert.equal(result.record.state, 'compile-failed'); assert.equal(result.error.code, 'SCRIPT_IMPORT_FAILED');
    assert.equal(result.error.sideEffect, 'confirmed'); assert.equal(result.current.matchesAfter, true);
});
test('script.create uses Creator AssetDB, verifies compiled source/UUID, and recovers by compensation and replay', async (t) => {
    const { root, service, assetdb } = setupCreate(t);
    const operationId = '32345678-1234-4123-8123-123456789012';
    const replayId = '42345678-1234-4123-8123-123456789012';
    const source = 'var Player = cc.Class({ extends: cc.Component });\n';
    const created = await service.execute('script.create', { action: 'apply', operationId, scriptPath: 'Player.js', source });
    assert.equal(created.success, true);
    assert.equal(created.outcome, 'needs-runtime');
    assert.equal(created.script.scriptUuid, '12345678-1234-4123-8123-123456789012');
    assert.equal(created.script.scriptClassId, '0123456789012345678901');
    assert.equal(fs.readFileSync(path.join(root, 'assets/Player.js'), 'utf8'), source);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'assets/Player.js.meta'))).uuid, created.script.scriptUuid);
    const read = await service.execute('script.read', { scriptPath: 'Player.js' });
    assert.equal(read.scriptClassId, created.script.scriptClassId);
    assert.equal((await service.execute('script.create', { action: 'compensate', operationId })).record.state, 'compensated');
    assert.equal(assetdb.urlToUuid('db://assets/Player.js'), null);
    assert.equal(fs.existsSync(path.join(root, 'assets/Player.js')), false);
    const replay = await service.execute('script.create', { action: 'replay', operationId: replayId, sourceOperationId: operationId });
    assert.equal(replay.success, true);
    assert.equal(replay.script.scriptUuid, '22345678-1234-4123-8123-123456789012');
    assert.equal(replay.record.sourceOperationId, operationId);
});

test('script.create compensation refuses to delete while a bounded reference scan is incomplete', async (t) => {
    const { root, service } = setupCreate(t);
    const operationId = '52345678-1234-4123-8123-123456789012';
    const source = 'var Player = cc.Class({ extends: cc.Component });\n';
    const created = await service.execute('script.create', { action: 'apply', operationId, scriptPath: 'Player.js', source });
    assert.equal(created.success, true);
    fs.writeFileSync(path.join(root, 'assets/large-scene.fire'), `[${' '.repeat(2 * 1024 * 1024 + 1)}]`);
    await assert.rejects(service.execute('script.create', { action: 'compensate', operationId }),
        (error) => error.code === 'SCRIPT_REFERENCE_CHECK_INCOMPLETE');
    assert.equal(fs.existsSync(path.join(root, 'assets/Player.js')), true, 'unknown reference state must preserve the asset');
});

test('incremental destination inline map verifies exact source despite stale side map/stats, including restore', async (t) => {
    const { service, identity } = setup(t, 'inline'); const operationId = crypto.randomUUID();
    const result = await service.execute('script.patch', { ...identity, action: 'apply', operationId });
    assert.equal(result.outcome, 'needs-runtime');
    assert.equal(result.record.compilation.evidenceKind, 'destination-inline-source-map');
    const restored = await service.execute('script.patch', { action: 'compensate', operationId });
    assert.equal(restored.record.state, 'compensated'); assert.equal(restored.current.matchesBefore, true);
});

for (const behavior of ['inline-wrong-source', 'inline-wrong-path', 'inline-stale', 'inline-invalid-code']) {
    test(`${behavior} cannot satisfy compilation or fall back to stale side files`, async (t) => {
        const { service, identity } = setup(t, behavior);
        const result = await service.execute('script.patch', { ...identity, action: 'apply', operationId: crypto.randomUUID() });
        assert.equal(result.outcome, 'needs-review'); assert.equal(result.error.code, 'SCRIPT_COMPILE_TIMEOUT');
        assert.equal(result.current.matchesAfter, true);
    });
}
