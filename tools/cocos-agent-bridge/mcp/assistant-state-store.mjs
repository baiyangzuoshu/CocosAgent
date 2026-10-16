import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STATE_VERSION = 1;
const MAX_CONVERSATIONS = 24;
const MAX_PLANS = 32;
const MAX_RUNS = 24;
const MAX_MESSAGES = 24;
const MAX_STRING = 8000;
const MAX_SUMMARY = 32_000;
const MAX_STATE_BYTES = 2_500_000;
const SECRET_KEY = /(?:api.?key|authorization|secret|password|credential|token|imageDataUrl|dataBase64|screenshot)/i;
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})\b/g;

function safeString(value, limit = MAX_STRING) {
    return typeof value === 'string' ? value.replace(SECRET_VALUE, '[redacted]').slice(0, limit) : '';
}

function safeValue(value, depth = 0) {
    if (depth > 12) return null;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return safeString(value);
    if (Array.isArray(value)) return value.slice(0, 64).map((item) => safeValue(item, depth + 1));
    if (typeof value !== 'object') return null;
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 128)) {
        if (SECRET_KEY.test(key)) continue;
        output[safeString(key, 100)] = safeValue(item, depth + 1);
    }
    return output;
}

function normalizedState(input) {
    const conversations = Array.isArray(input?.conversations) ? input.conversations.slice(-MAX_CONVERSATIONS) : [];
    const plans = Array.isArray(input?.plans) ? input.plans.slice(-MAX_PLANS) : [];
    const runs = Array.isArray(input?.runs) ? input.runs.slice(-MAX_RUNS) : [];
    return {
        version: STATE_VERSION,
        conversations: conversations.map((item) => ({
            id: safeString(item?.id, 80),
            messages: (Array.isArray(item?.messages) ? item.messages : []).slice(-MAX_MESSAGES).map((message) => ({
                role: message?.role === 'assistant' ? 'assistant' : 'user',
                content: safeString(message?.content),
            })),
            ...(item?.summary && typeof item.summary === 'object' && !Array.isArray(item.summary)
                && Number.isSafeInteger(item.summary.revision) && item.summary.revision > 0
                && Number.isSafeInteger(item.summary.coveredMessages) && item.summary.coveredMessages > 0
                && /^[0-9a-f]{64}$/i.test(item.summary.sourceHash || '')
                && ['provider', 'deterministic'].includes(item.summary.source)
                && typeof item.summary.content === 'string' && item.summary.content.trim()
                ? { summary: {
                    version: 1,
                    revision: item.summary.revision,
                    coveredMessages: item.summary.coveredMessages,
                    sourceHash: item.summary.sourceHash.toLowerCase(),
                    source: item.summary.source,
                    content: safeString(item.summary.content, MAX_SUMMARY),
                    preservedUserMessages: (Array.isArray(item.summary.preservedUserMessages)
                        ? item.summary.preservedUserMessages : []).filter((message) => typeof message === 'string')
                        .slice(-24).map((message) => safeString(message, 1_200)).filter(Boolean),
                    updatedAt: safeString(item.summary.updatedAt, 40),
                } }
                : {}),
        })).filter((item) => item.id),
        plans: plans.map((item) => safeValue(item)).filter((item) => item && typeof item.id === 'string' && item.id),
        runs: runs.map((item) => safeValue(item)).filter((item) => item && typeof item.id === 'string' && item.id),
    };
}

export function assistantStateDirectory(projectRoot, stateRoot = process.env.LOCALAPPDATA || process.env.XDG_STATE_HOME
    || path.join(os.homedir(), '.local', 'state')) {
    const canonical = fs.realpathSync(projectRoot);
    const projectKey = crypto.createHash('sha256').update(canonical).digest('hex');
    return path.join(stateRoot, 'CocosAgent', 'assistant-sessions', projectKey);
}

export class AssistantStateStore {
    constructor(projectRoot, { stateRoot } = {}) {
        this.directory = assistantStateDirectory(projectRoot, stateRoot);
        this.file = path.join(this.directory, 'state-v1.json');
    }

    load() {
        if (!fs.existsSync(this.file)) return { version: STATE_VERSION, conversations: [], plans: [], runs: [] };
        if (fs.statSync(this.file).size > MAX_STATE_BYTES) throw new Error('ASSISTANT_STATE_TOO_LARGE');
        const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (!parsed || parsed.version !== STATE_VERSION || !Array.isArray(parsed.conversations)
            || !Array.isArray(parsed.plans) || !Array.isArray(parsed.runs)) {
            throw new Error('ASSISTANT_STATE_INVALID');
        }
        const state = normalizedState(parsed);
        for (const run of state.runs) {
            if (run.status !== 'running') continue;
            const uncertain = Boolean(run.activeTool && run.activeTool.access !== 'read')
                || (run.receipts || []).some((receipt) => receipt.access !== 'read' && receipt.access !== 'recovery');
            run.status = uncertain ? 'needs-review' : 'interrupted';
            run.reason = uncertain ? 'host_restarted_during_or_after_write' : 'host_restarted';
            run.updatedAt = new Date().toISOString();
        }
        for (const plan of state.plans) {
            if (plan.status !== 'running') continue;
            const run = state.runs.find((item) => item.planId === plan.id && ['needs-review', 'interrupted'].includes(item.status));
            plan.status = run?.status === 'needs-review' ? 'needs-review' : 'paused';
        }
        return state;
    }

    save(input) {
        const state = normalizedState(input);
        fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
        try { fs.chmodSync(this.directory, 0o700); } catch (_) {}
        const temp = `${this.file}.${process.pid}.${crypto.randomBytes(5).toString('hex')}.tmp`;
        const fd = fs.openSync(temp, 'wx', 0o600);
        try {
            fs.writeFileSync(fd, `${JSON.stringify(state)}\n`, 'utf8');
            fs.fsyncSync(fd);
            fs.closeSync(fd);
            fs.renameSync(temp, this.file);
        } catch (error) {
            try { fs.closeSync(fd); } catch (_) {}
            try { fs.unlinkSync(temp); } catch (_) {}
            throw error;
        }
        try { fs.chmodSync(this.file, 0o600); } catch (_) {}
        return state;
    }
}

export { normalizedState };
