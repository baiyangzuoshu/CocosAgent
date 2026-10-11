import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assistantStateDirectory } from './assistant-state-store.mjs';

const MAX_MEMORY_BYTES = 8_000_000;
const STALE_LOCK_MS = 30_000;

export function projectMemoryKey(projectRoot) {
    const canonical = fs.realpathSync(projectRoot);
    return crypto.createHash('sha256').update(canonical).digest('hex');
}

export class AssistantMemoryFileStore {
    constructor(projectRoot, { stateRoot } = {}) {
        this.projectKey = projectMemoryKey(projectRoot);
        this.directory = assistantStateDirectory(projectRoot, stateRoot);
        this.file = path.join(this.directory, 'project-memory-v1.json');
        this.lockFile = path.join(this.directory, 'project-memory-v1.lock');
    }

    async load() {
        if (!fs.existsSync(this.file)) return null;
        const stat = fs.lstatSync(this.file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_MEMORY_BYTES) {
            throw new Error('PROJECT_MEMORY_STORE_INVALID');
        }
        const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (!parsed || parsed.projectKey !== this.projectKey || parsed.version !== 1) {
            throw new Error('PROJECT_MEMORY_WRONG_PROJECT_OR_VERSION');
        }
        return parsed;
    }

    async save(snapshot, expectedRevision) {
        if (!snapshot || snapshot.projectKey !== this.projectKey || snapshot.version !== 1
            || !Number.isInteger(expectedRevision) || snapshot.revision !== expectedRevision + 1) {
            throw storageError('PROJECT_MEMORY_SAVE_INVALID', 'none');
        }
        fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
        try { fs.chmodSync(this.directory, 0o700); } catch (_) {}
        const lock = await this.acquireLock();
        try {
            const current = await this.load();
            const currentRevision = current?.revision ?? 0;
            if (currentRevision !== expectedRevision) {
                throw storageError('PROJECT_MEMORY_CONCURRENT_UPDATE', 'none');
            }
            const encoded = `${JSON.stringify(snapshot)}\n`;
            if (Buffer.byteLength(encoded, 'utf8') > MAX_MEMORY_BYTES) {
                throw storageError('PROJECT_MEMORY_STORE_TOO_LARGE', 'none');
            }
            const temp = `${this.file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
            const fd = fs.openSync(temp, 'wx', 0o600);
            try {
                fs.writeFileSync(fd, encoded, 'utf8');
                fs.fsyncSync(fd);
                fs.closeSync(fd);
                fs.renameSync(temp, this.file);
            } catch (error) {
                try { fs.closeSync(fd); } catch (_) {}
                try { fs.unlinkSync(temp); } catch (_) {}
                throw storageError(String(error?.code || 'PROJECT_MEMORY_ATOMIC_WRITE_FAILED'), 'unknown');
            }
            try { fs.chmodSync(this.file, 0o600); } catch (_) {}
        } finally {
            await lock.release();
        }
    }

    async acquireLock() {
        const deadline = Date.now() + 2_000;
        while (Date.now() < deadline) {
            let handle;
            try {
                handle = await fs.promises.open(this.lockFile, 'wx', 0o600);
            } catch (error) {
                if (error?.code !== 'EEXIST') throw storageError(String(error?.code || 'PROJECT_MEMORY_LOCK_FAILED'), 'none');
                this.removeStaleLock();
                await new Promise((resolve) => setTimeout(resolve, 20));
                continue;
            }
            const token = crypto.randomUUID();
            try {
                await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: Date.now(), token }));
                await handle.sync();
            } catch (error) {
                await handle.close().catch(() => {});
                try { fs.unlinkSync(this.lockFile); } catch (_) {}
                throw storageError(String(error?.code || 'PROJECT_MEMORY_LOCK_FAILED'), 'none');
            }
            return { release: async () => {
                await handle.close().catch(() => {});
                try {
                    const current = JSON.parse(fs.readFileSync(this.lockFile, 'utf8'));
                    if (current.token === token) fs.unlinkSync(this.lockFile);
                } catch (_) {}
            } };
        }
        throw storageError('PROJECT_MEMORY_LOCK_TIMEOUT', 'none');
    }

    removeStaleLock() {
        try {
            const before = fs.lstatSync(this.lockFile);
            if (!before.isFile() || before.isSymbolicLink() || Date.now() - before.mtimeMs < STALE_LOCK_MS) return;
            let lock;
            try { lock = JSON.parse(fs.readFileSync(this.lockFile, 'utf8')); } catch (_) { lock = null; }
            if (Number.isInteger(lock?.pid)) {
                try { process.kill(lock.pid, 0); return; }
                catch (error) { if (error?.code === 'EPERM') return; }
            } else if (Date.now() - before.mtimeMs < STALE_LOCK_MS * 4) return;
            const current = fs.lstatSync(this.lockFile);
            if (current.dev === before.dev && current.ino === before.ino && current.isFile() && !current.isSymbolicLink()) {
                fs.unlinkSync(this.lockFile);
            }
        } catch (_) {}
    }
}

function storageError(code, sideEffect) {
    const error = new Error(code);
    error.code = code;
    error.sideEffect = sideEffect;
    return error;
}
