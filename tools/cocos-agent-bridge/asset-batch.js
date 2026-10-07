'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { dispatch } = require('./agent-dispatch');

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const name = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i;
const fail = (code, message) => ({ success: false, outcome: 'failed', error: { code, message } });
function file(projectRoot, batchId) { return path.join(projectRoot, '.cocos-agent', 'asset-batches', `${batchId}.json`); }
function save(record, create = false) {
    const filename = file(record.projectRoot, record.batchId);
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    record.updatedAt = new Date().toISOString();
    if (create) return fs.writeFileSync(filename, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 });
    const temporary = `${filename}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try { fs.writeFileSync(temporary, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 }); fs.renameSync(temporary, filename); }
    finally { try { fs.unlinkSync(temporary); } catch (_) { /* consumed by rename */ } }
}
function read(projectRoot, batchId) { return JSON.parse(fs.readFileSync(file(projectRoot, batchId), 'utf8')); }
function publicRecord(record) { return { success: record.state === 'completed', outcome: record.state,
    batchId: record.batchId, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion,
    items: record.items.map(({ sourcePath, assetName, sha256, status, result }) => ({ sourcePath, assetName, sha256, status, result })),
    error: record.error || null }; }
function validate(params) {
    if (!params || !path.isAbsolute(params.projectRoot || '') || !['2.4.15', '3.8.7'].includes(params.creatorVersion)
        || !Array.isArray(params.targets) || !params.targets.length || !Array.isArray(params.sources)
        || params.sources.length < 2 || params.sources.length > 16) return fail('INVALID_BATCH', 'Provide one target and 2–16 absolute PNG paths.');
    const projectRoot = path.resolve(params.projectRoot);
    if (!fs.statSync(projectRoot, { throwIfNoEntry: false })?.isDirectory()) return fail('PROJECT_NOT_FOUND', 'Project directory does not exist.');
    const items = [];
    const names = new Set();
    for (const source of params.sources) {
        if (typeof source !== 'string' || !path.isAbsolute(source) || !name.test(path.basename(source)))
            return fail('INVALID_SOURCE', 'Each source must be an absolute PNG path with an allowed filename.');
        const assetName = path.basename(source);
        if (names.has(assetName.toLowerCase())) return fail('DUPLICATE_ASSET_NAME', `Repeated destination name: ${assetName}`);
        names.add(assetName.toLowerCase());
        let data;
        try {
            if (!fs.lstatSync(source).isFile()) return fail('INVALID_SOURCE', `Source is not a regular file: ${source}`);
            data = fs.readFileSync(source);
        } catch (_) { return fail('SOURCE_NOT_FOUND', `Cannot read: ${source}`); }
        if (data.length < 24 || data.length > 16 * 1024 * 1024 || !data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
            return fail('INVALID_PNG', `Invalid PNG signature or size: ${source}`);
        if (fs.existsSync(path.join(projectRoot, 'assets', 'resources', assetName))
            || fs.existsSync(path.join(projectRoot, 'assets', 'resources', `${assetName}.meta`)))
            return fail('ASSET_CONFLICT', `Destination already exists: ${assetName}`);
        items.push({ sourcePath: path.resolve(source), assetName, sha256: crypto.createHash('sha256').update(data).digest('hex'), status: 'pending', result: null });
    }
    return { success: true, outcome: 'ready', projectRoot, creatorVersion: params.creatorVersion, items };
}
function plan(params) { return validate(params); }
function execute(params, run = dispatch) {
    if (!params || !path.isAbsolute(params.projectRoot || '') || !Array.isArray(params.sources)
        || params.sources.some((source) => typeof source !== 'string' || !path.isAbsolute(source)))
        return fail('INVALID_ARGUMENT', 'Absolute project and source paths required.');
    const batchId = params && params.batchId || crypto.randomUUID();
    if (!uuid.test(batchId)) return fail('INVALID_BATCH_ID', 'Batch ID must be a UUID.');
    const checked = validate(params);
    let record;
    try { record = read(checked.projectRoot || params.projectRoot, batchId); } catch (error) {
        if (error.code !== 'ENOENT') return fail('BATCH_READ_FAILED', error.message);
    }
    if (!record) {
        if (!checked.success) return checked;
        record = { contractVersion: '0.1', batchId, projectRoot: checked.projectRoot,
            creatorVersion: checked.creatorVersion, targets: params.targets, items: checked.items,
            state: 'executing', error: null, createdAt: new Date().toISOString() };
        try { save(record, true); } catch (error) { return fail('BATCH_RECORD_FAILED', error.message); }
    } else {
        if (record.projectRoot !== path.resolve(params.projectRoot) || record.creatorVersion !== params.creatorVersion
            || JSON.stringify(record.items.map((item) => item.sourcePath)) !== JSON.stringify(params.sources.map((source) => path.resolve(source))))
            return fail('BATCH_CONFLICT', 'Batch ID belongs to another project or source list.');
        if (record.state !== 'executing') return publicRecord(record);
        if (record.items.some((item) => item.status === 'importing')) {
            record.state = 'needs-review'; record.error = { code: 'IMPORT_OUTCOME_UNCERTAIN' }; save(record); return publicRecord(record);
        }
    }
    for (const item of record.items) {
        if (item.status === 'imported') continue;
        let data;
        try { data = fs.readFileSync(item.sourcePath); } catch (_) { data = null; }
        if (!data || crypto.createHash('sha256').update(data).digest('hex') !== item.sha256) {
            record.state = 'failed'; record.error = { code: 'SOURCE_CHANGED', assetName: item.assetName }; save(record); return publicRecord(record);
        }
        if (fs.existsSync(path.join(record.projectRoot, 'assets', 'resources', item.assetName))) {
            record.state = 'failed'; record.error = { code: 'ASSET_CONFLICT', assetName: item.assetName }; save(record); return publicRecord(record);
        }
        item.status = 'importing'; save(record);
        const result = run({ targets: record.targets, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion,
            command: 'asset.importPng', input: { sourcePath: item.sourcePath } });
        if (!result.success || result.outcome !== 'completed' || !result.result || result.result.assetName !== item.assetName) {
            if (result.outcome === 'failed' && result.error && result.error.sideEffect === 'none') {
                item.status = 'rejected'; record.state = 'failed';
                record.error = { code: result.error.code || 'IMPORT_REJECTED', assetName: item.assetName,
                    detail: result.error }; save(record); return publicRecord(record);
            }
            record.state = 'needs-review'; record.error = { code: 'IMPORT_OUTCOME_UNCERTAIN', assetName: item.assetName,
                detail: result.error || null }; save(record); return publicRecord(record);
        }
        const destination = path.join(record.projectRoot, 'assets', 'resources', item.assetName);
        try { data = fs.readFileSync(destination); } catch (_) { data = null; }
        if (!data || crypto.createHash('sha256').update(data).digest('hex') !== item.sha256
            || !fs.existsSync(`${destination}.meta`)) {
            record.state = 'needs-review'; record.error = { code: 'DISK_READBACK_FAILED', assetName: item.assetName };
            save(record); return publicRecord(record);
        }
        item.status = 'imported'; item.result = result.result; save(record);
    }
    record.state = 'completed'; save(record); return publicRecord(record);
}
function get(params) {
    if (!params || !path.isAbsolute(params.projectRoot || '') || !uuid.test(params.batchId || '')) return fail('INVALID_ARGUMENT', 'Project and batch ID required.');
    try { const record = read(path.resolve(params.projectRoot), params.batchId);
        if (record.creatorVersion !== params.creatorVersion) return fail('BATCH_TARGET_MISMATCH', 'Creator version differs.');
        return publicRecord(record);
    } catch (error) { return fail(error.code === 'ENOENT' ? 'BATCH_NOT_FOUND' : 'BATCH_READ_FAILED', error.message); }
}
function handle(method, params, run = dispatch) {
    if (method === 'assets.batch.plan') return plan(params);
    if (method === 'assets.batch.execute') return execute(params, run);
    if (method === 'assets.batch.get') return get(params);
    return fail('METHOD_NOT_FOUND', 'Unknown batch method.');
}
if (require.main === module) {
    const argv = process.argv.slice(2);
    const value = (flag) => { const index = argv.indexOf(flag); return index < 0 ? undefined : argv[index + 1]; };
    let params;
    try { params = JSON.parse(value('--params') || '{}'); } catch (_) { params = null; }
    const result = handle(value('--method'), params);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.success ? 0 : 1;
}
module.exports = { handle, plan, execute, get };
