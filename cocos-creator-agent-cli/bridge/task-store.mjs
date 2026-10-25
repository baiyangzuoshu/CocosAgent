import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const TASK_DIRECTORY = path.join(os.homedir(), '.cocos-creator-agent', 'tasks');
const MAX_TASK_RECORD_BYTES = 2 * 1024 * 1024;

function ensureDirectory() {
  fs.mkdirSync(TASK_DIRECTORY, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(TASK_DIRECTORY);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw coded('TASK_DIRECTORY_UNSAFE');
  try { fs.chmodSync(TASK_DIRECTORY, 0o700); } catch (_) {}
}

function filePath(taskId) {
  if (typeof taskId !== 'string' || !/^[0-9a-f-]{36}$/i.test(taskId)) throw coded('TASK_ID_INVALID');
  return path.join(TASK_DIRECTORY, `${taskId}.json`);
}

export function loadTaskRecords() {
  ensureDirectory();
  const records = new Map();
  for (const name of fs.readdirSync(TASK_DIRECTORY).slice(0, 1000)) {
    if (!/^[0-9a-f-]{36}\.json$/i.test(name)) continue;
    const filename = path.join(TASK_DIRECTORY, name);
    try {
      const stat = fs.lstatSync(filename);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_TASK_RECORD_BYTES) continue;
      const record = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (record?.schemaVersion !== 1 || record.taskId !== name.slice(0, -5)
        || typeof record.command !== 'string' || typeof record.projectRoot !== 'string'
        || typeof record.instanceId !== 'string' || !['queued', 'running', 'cancel-requested', 'interrupted',
          'needs-reconciliation', 'completed', 'failed', 'cancelled'].includes(record.status)) continue;
      records.set(record.taskId, record);
    } catch (_) {}
  }
  return records;
}

export function writeTaskRecord(record) {
  ensureDirectory();
  const filename = filePath(record.taskId);
  const data = Buffer.from(JSON.stringify(record));
  if (data.length > MAX_TASK_RECORD_BYTES) throw coded('TASK_RECORD_TOO_LARGE');
  const temp = `${filename}.${randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temp, data, { flag: 'wx', mode: 0o600 });
  try {
    fs.renameSync(temp, filename);
    try { fs.chmodSync(filename, 0o600); } catch (_) {}
  } catch (error) {
    try { fs.unlinkSync(temp); } catch (_) {}
    throw error;
  }
}

export function removeTaskRecord(taskId) {
  try { fs.unlinkSync(filePath(taskId)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function coded(code) { return Object.assign(new Error(code), { code }); }
