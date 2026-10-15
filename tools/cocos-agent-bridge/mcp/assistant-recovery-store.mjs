import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assistantStateDirectory } from './assistant-state-store.mjs';
import { creatorRecoveryResolved } from '../../cocos-agent-runtime/dist/creator-recovery.js';

// Independent of the bounded conversation/recent-run cache. Corruption fails closed.
export class AssistantRecoveryStore {
    constructor(projectRoot, { stateRoot } = {}) {
        this.projectKey = crypto.createHash('sha256').update(fs.realpathSync(projectRoot)).digest('hex');
        this.directory = assistantStateDirectory(projectRoot, stateRoot);
        this.file = path.join(this.directory, 'write-recovery-v1.json');
        this.lock = `${this.file}.lock`;
    }
    async load() {
        if (!fs.existsSync(this.file)) return { revision: 0, pending: null, queued: [] };
        const stat = fs.lstatSync(this.file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2_000_000) throw new Error('RECOVERY_STORE_INVALID');
        const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        const pending = data.pending;
        const validPending = (pending) => pending && ['operationId', 'pipelineId', 'workflowId', 'buildId', 'batchId', 'releaseId', 'callId'].includes(pending.field)
            && typeof pending.value === 'string' && pending.value.length > 0 && pending.value.length <= 200
            && typeof pending.toolName === 'string' && /^cocos_2x_[a-z0-9_]+$/.test(pending.toolName);
        if (data.version !== 1 || data.projectKey !== this.projectKey || !Number.isSafeInteger(data.revision) || data.revision < 1
            || pending !== null && !validPending(pending)
            || !Array.isArray(data.queued) || data.queued.length > 768 || !data.queued.every(validPending)
            || pending === null && data.queued.length) throw new Error('RECOVERY_STORE_INVALID');
        return { revision: data.revision, pending, queued: data.queued };
    }
    async save(pending, expectedRevision, initialQueue) {
        fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
        let lock;
        try { lock = fs.openSync(this.lock, 'wx', 0o600); }
        catch (error) {
            if (error.code !== 'EEXIST') throw error;
            const pid = Number(fs.readFileSync(this.lock, 'utf8'));
            if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('RECOVERY_STORE_LOCKED');
            try { process.kill(pid, 0); throw new Error('RECOVERY_STORE_LOCKED'); }
            catch (check) { if (check.code !== 'ESRCH') throw check; }
            fs.unlinkSync(this.lock);
            lock = fs.openSync(this.lock, 'wx', 0o600);
        }
        const temporary = `${this.file}.${crypto.randomUUID()}.tmp`;
        try {
            fs.writeFileSync(lock, String(process.pid));
            fs.fsyncSync(lock);
            const current = await this.load();
            if (current.revision !== expectedRevision) throw new Error('RECOVERY_REVISION_CONFLICT');
            const queued = initialQueue || current.queued;
            const nextPending = pending === null && queued.length ? queued[0] : pending;
            const nextQueue = pending === null && queued.length ? queued.slice(1) : queued;
            const fd = fs.openSync(temporary, 'wx', 0o600);
            try {
                fs.writeFileSync(fd, JSON.stringify({ version: 1, projectKey: this.projectKey, revision: expectedRevision + 1, pending: nextPending, queued: nextQueue }));
                fs.fsyncSync(fd);
            } finally { fs.closeSync(fd); }
            fs.renameSync(temporary, this.file);
        } finally {
            try { fs.unlinkSync(temporary); } catch (_) {}
            fs.closeSync(lock);
            fs.unlinkSync(this.lock);
        }
    }
    async migrateRuns(runs) {
        const state = await this.load();
        if (state.revision !== 0) return;
        const uncertain = runs.filter((run) => run.status === 'needs-review'
            && (run.activeTool?.access !== undefined && run.activeTool.access !== 'read'
                || run.receipts?.some((receipt) => ['possible', 'unknown'].includes(receipt.sideEffect) || receipt.outcome === 'needs-review')));
        const pending = new Map();
        for (const run of uncertain) {
            const receipts = [...(run.activeTool && run.activeTool.access !== 'read' ? [run.activeTool] : []),
                ...(run.receipts || []).filter((item) => ['possible', 'unknown'].includes(item.sideEffect) || item.outcome === 'needs-review')];
            for (const receipt of receipts) {
                if (run.recovery?.operationId === receipt.operationId && creatorRecoveryResolved({ structuredContent: run.recovery.receipt })) continue;
                const identity = { field: receipt.operationId ? 'operationId' : 'callId',
                    value: receipt.operationId || receipt.callId || run.id, toolName: receipt.toolName };
                pending.set(`${identity.field}:${identity.value}`, identity);
            }
        }
        const values = [...pending.values()];
        if (values.length) await this.save(values[0], 0, values.slice(1));
    }
}
