import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assistantStateDirectory } from './assistant-state-store.mjs';

const MAX_TASKS = 100;
const MAX_FILE_BYTES = 750_000;

export class AssistantTaskStore {
    constructor(projectRoot, { stateRoot } = {}) {
        this.directory = assistantStateDirectory(projectRoot, stateRoot);
        this.file = path.join(this.directory, 'tasks-v1.json');
    }

    load() {
        if (!fs.existsSync(this.file)) return [];
        if (fs.statSync(this.file).size > MAX_FILE_BYTES) throw new Error('ASSISTANT_TASK_STATE_TOO_LARGE');
        const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.tasks) || parsed.tasks.length > MAX_TASKS) {
            throw new Error('ASSISTANT_TASK_STATE_INVALID');
        }
        return parsed.tasks;
    }

    save(tasks) {
        if (!Array.isArray(tasks) || tasks.length > MAX_TASKS) throw new Error('ASSISTANT_TASK_STATE_INVALID');
        fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
        try { fs.chmodSync(this.directory, 0o700); } catch (_) {}
        const temp = `${this.file}.${process.pid}.${crypto.randomBytes(5).toString('hex')}.tmp`;
        const fd = fs.openSync(temp, 'wx', 0o600);
        try {
            fs.writeFileSync(fd, `${JSON.stringify({ version: 1, tasks })}\n`, 'utf8');
            fs.fsyncSync(fd);
            fs.closeSync(fd);
            fs.renameSync(temp, this.file);
        } catch (error) {
            try { fs.closeSync(fd); } catch (_) {}
            try { fs.unlinkSync(temp); } catch (_) {}
            throw error;
        }
        try { fs.chmodSync(this.file, 0o600); } catch (_) {}
    }
}
