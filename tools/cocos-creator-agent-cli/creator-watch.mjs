import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MAX_FILES = 32;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const DEFAULT_INTERVAL_MS = 750;
const MIN_INTERVAL_MS = 250;
const MAX_INTERVAL_MS = 10000;

function coded(code) { return Object.assign(new Error(code), { code }); }

function safeRoot(projectRoot) {
  let stat;
  try { stat = fs.lstatSync(projectRoot); } catch (_) { throw coded('WATCH_PROJECT_ROOT_INVALID'); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw coded('WATCH_PROJECT_ROOT_INVALID');
  return fs.realpathSync(projectRoot);
}

function normalizePaths(projectRoot, requestedPaths) {
  if (!Array.isArray(requestedPaths) || requestedPaths.length < 1 || requestedPaths.length > MAX_FILES)
    throw coded('WATCH_PATHS_INVALID');
  const root = safeRoot(projectRoot);
  const seen = new Set();
  const files = requestedPaths.map((value) => {
    if (typeof value !== 'string' || !value.trim() || path.isAbsolute(value) || value.includes('\0'))
      throw coded('WATCH_PATH_INVALID');
    const normalized = path.normalize(value);
    if (normalized === '.' || normalized === '..' || normalized.startsWith(`..${path.sep}`))
      throw coded('WATCH_PATH_OUTSIDE_PROJECT');
    const absolutePath = path.resolve(root, normalized);
    if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`))
      throw coded('WATCH_PATH_OUTSIDE_PROJECT');
    if (seen.has(absolutePath)) throw coded('WATCH_PATH_DUPLICATE');
    seen.add(absolutePath);
    return { absolutePath, projectPath: path.relative(root, absolutePath).split(path.sep).join('/') };
  });
  return { root, files };
}

function readState(file, previous) {
  let namedStat;
  try {
    namedStat = fs.lstatSync(file.absolutePath);
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false };
    throw error;
  }
  if (!namedStat.isFile() || namedStat.isSymbolicLink()) throw coded('WATCH_PATH_UNSAFE');
  if (namedStat.size > MAX_FILE_BYTES) throw coded('WATCH_FILE_TOO_LARGE');
  const noFollow = fs.constants.O_NOFOLLOW || 0;
  const descriptor = fs.openSync(file.absolutePath, fs.constants.O_RDONLY | noFollow);
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.dev !== namedStat.dev || stat.ino !== namedStat.ino)
      throw coded('WATCH_PATH_UNSAFE');
    const realPath = fs.realpathSync(file.absolutePath);
    if (realPath !== file.absolutePath) throw coded('WATCH_PATH_UNSAFE');
    if (stat.size > MAX_FILE_BYTES) throw coded('WATCH_FILE_TOO_LARGE');
    if (previous?.exists && previous.size === stat.size && previous.mtimeMs === stat.mtimeMs
      && previous.ctimeMs === stat.ctimeMs && previous.ino === stat.ino && previous.dev === stat.dev) return previous;
    const bytes = fs.readFileSync(descriptor);
    if (bytes.length > MAX_FILE_BYTES) throw coded('WATCH_FILE_TOO_LARGE');
    return { exists: true, size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs,
      ino: stat.ino, dev: stat.dev, sha256: createHash('sha256').update(bytes).digest('hex') };
  } finally { fs.closeSync(descriptor); }
}

function readAll(files, previousStates = new Map()) {
  const states = new Map();
  let totalBytes = 0;
  for (const file of files) {
    const state = readState(file, previousStates.get(file.absolutePath));
    if (state.exists) totalBytes += state.size;
    if (totalBytes > MAX_TOTAL_BYTES) throw coded('WATCH_TOTAL_BYTES_EXCEEDED');
    states.set(file.absolutePath, state);
  }
  return states;
}

function stateChanged(before, after) {
  if (before?.exists !== after?.exists) return true;
  if (!before?.exists) return false;
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs
    || before.ino !== after.ino || before.dev !== after.dev) return true;
  return before.sha256 !== after.sha256;
}

function wait(ms, signal) {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(true); }, ms);
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); resolve(false); };
    signal.addEventListener('abort', abort, { once: true });
  });
}

export function startProjectFileWatch({ projectRoot, paths, intervalMs = DEFAULT_INTERVAL_MS, debounceMs = 300,
  onChange, onError = () => {}, signal } = {}) {
  if (typeof onChange !== 'function') throw coded('WATCH_CALLBACK_REQUIRED');
  if (!Number.isInteger(intervalMs) || intervalMs < MIN_INTERVAL_MS || intervalMs > MAX_INTERVAL_MS)
    throw coded('WATCH_INTERVAL_INVALID');
  if (!Number.isInteger(debounceMs) || debounceMs < 100 || debounceMs > 5000)
    throw coded('WATCH_DEBOUNCE_INVALID');
  const { root, files } = normalizePaths(projectRoot, paths);
  const controller = new AbortController();
  const stop = () => controller.abort();
  if (signal) {
    if (signal.aborted) stop();
    else signal.addEventListener('abort', stop, { once: true });
  }
  let initial;
  try { initial = readAll(files); }
  catch (error) { throw error; }

  const done = (async () => {
    let previous = initial;
    let callbackError = null;
    while (await wait(intervalMs, controller.signal)) {
      let current;
      try { current = readAll(files, previous); }
      catch (error) { callbackError = error; break; }
      const changed = files.filter((file) => stateChanged(previous.get(file.absolutePath), current.get(file.absolutePath)));
      if (!changed.length) { previous = current; continue; }

      const changedPaths = new Set(changed.map((file) => file.projectPath));
      let stable = current;
      while (await wait(debounceMs, controller.signal)) {
        let next;
        try { next = readAll(files, stable); }
        catch (error) { callbackError = error; break; }
        const more = files.filter((file) => stateChanged(stable.get(file.absolutePath), next.get(file.absolutePath)));
        if (!more.length) break;
        more.forEach((file) => changedPaths.add(file.projectPath));
        stable = next;
      }
      if (callbackError || controller.signal.aborted) break;
      previous = stable;
      try { await onChange([...changedPaths].sort()); }
      catch (error) { try { onError(error); } catch (_) {} }
    }
    signal?.removeEventListener('abort', stop);
    if (callbackError) throw callbackError;
    return { stopped: true, projectRoot: root };
  })();

  return { projectRoot: root, paths: files.map((file) => file.projectPath), stop, done };
}
