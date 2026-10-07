'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function directory(projectRoot) { return path.join(projectRoot, '.cocos-agent', 'operations'); }
function file(projectRoot, operationId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) {
        throw new Error('INVALID_OPERATION_ID');
    }
    return path.join(directory(projectRoot), `${operationId}.json`);
}
function read(projectRoot, operationId) {
    return JSON.parse(fs.readFileSync(file(projectRoot, operationId), 'utf8'));
}
function write(projectRoot, record, create = false) {
    const destination = file(projectRoot, record.operationId);
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    if (create) {
        fs.writeFileSync(destination, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 });
        sync(destination);
        syncDirectory(path.dirname(destination));
        return;
    }
    const temporary = `${destination}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 });
        sync(temporary);
        fs.renameSync(temporary, destination);
        syncDirectory(path.dirname(destination));
    } finally {
        try { fs.unlinkSync(temporary); } catch (_) { /* rename already consumed the file */ }
    }
}
function sync(filename) {
    const descriptor = fs.openSync(filename, 'r');
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}
function syncDirectory(dirname) {
    try { sync(dirname); } catch (_) { /* Some filesystems cannot fsync directories. */ }
}

module.exports = { read, write };
