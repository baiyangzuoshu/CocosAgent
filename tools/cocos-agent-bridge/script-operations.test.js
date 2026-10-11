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
        if (behavior !== 'compile') { callback(null); return; }
        setTimeout(() => {
            const src = path.join(root, 'temp/quick-scripts/src/assets/Script/Test.js'); const dst = path.join(root, 'temp/quick-scripts/dst/assets/Script/Test.js');
            fs.mkdirSync(path.dirname(src), { recursive: true }); fs.mkdirSync(path.dirname(dst), { recursive: true });
            const source = fs.readFileSync(path.join(root, 'assets/Script/Test.js'), 'utf8');
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
test('packaged Creator and Host script contracts use identical implementation', () => {
    assert.equal(fs.readFileSync(path.join(__dirname, 'script-contract.js'), 'utf8'), fs.readFileSync(path.resolve(__dirname, '../../2.4.15NewProject/packages/cocos-agent-bridge/script-operations.js'), 'utf8'));
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
