import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_ARCHIVE_BYTES = 5 * 1024 * 1024;
const MAX_RUN_ARCHIVE_BYTES = 20 * 1024 * 1024;

/** Private, per-run evidence archive. It has no path/list API and never crosses run IDs. */
export class AssistantToolResultArchive {
    constructor(tracePath) {
        if (typeof tracePath !== 'string' || !path.isAbsolute(tracePath)) throw new TypeError('An absolute run trace path is required.');
        this.directory = `${tracePath}.tool-results`;
        fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
        fs.chmodSync(this.directory, 0o700);
    }

    async save({ runId, callId, toolName, payload }) {
        if (!runId || runId.length > 100 || !callId || callId.length > 200
            || !toolName || toolName.length > 160 || typeof payload !== 'string') throw new TypeError('Archive identity or payload is invalid.');
        const row = JSON.stringify({ version: 1, runId, callId, toolName, payload });
        const rowBytes = Buffer.byteLength(row, 'utf8');
        if (rowBytes > MAX_ARCHIVE_BYTES) throw new RangeError('Tool result exceeds the 5 MiB evidence archive limit.');
        const currentBytes = fs.readdirSync(this.directory).reduce((total, name) => {
            try { return total + fs.statSync(path.join(this.directory, name)).size; }
            catch { return total; }
        }, 0);
        if (currentBytes + rowBytes > MAX_RUN_ARCHIVE_BYTES) throw new RangeError('Run evidence archive exceeds the 20 MiB total limit.');
        const filename = path.join(this.directory, `${crypto.createHash('sha256').update(callId).digest('hex')}.json`);
        const descriptor = fs.openSync(filename, 'wx', 0o600);
        try { fs.writeFileSync(descriptor, row, 'utf8'); fs.fsyncSync(descriptor); }
        finally { fs.closeSync(descriptor); }
    }

    async read({ runId, callId, offset, limit }) {
        if (!runId || runId.length > 100 || !callId || callId.length > 200
            || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 8_000) {
            throw new TypeError('Archive read request is invalid.');
        }
        const filename = path.join(this.directory, `${crypto.createHash('sha256').update(callId).digest('hex')}.json`);
        let row;
        try {
            const stat = fs.statSync(filename);
            if (!stat.isFile() || stat.size > MAX_ARCHIVE_BYTES) return null;
            row = JSON.parse(fs.readFileSync(filename, 'utf8'));
        } catch { return null; }
        if (!row || row.version !== 1 || row.runId !== runId || row.callId !== callId || typeof row.payload !== 'string') return null;
        if (offset > row.payload.length) return null;
        const payload = row.payload.slice(offset, offset + limit);
        const next = offset + payload.length;
        return { payload, totalChars: row.payload.length, nextOffset: next < row.payload.length ? next : null };
    }
}
