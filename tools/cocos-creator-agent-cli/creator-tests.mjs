import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listInstances, callCommand, getExtensionCommands, callExtensionCommand } from './bridge/client.mjs';
import { startProjectFileWatch } from './creator-watch.mjs';
import { PROVIDER_ID, COMMAND_ID } from './creator-extension/provider-contract.cjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = '.cocos-agent/tests.json';
const ID = /^[a-z][a-z0-9-]{0,63}$/;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const coded = (code) => Object.assign(new Error(code), { code });
const plain = (value) => value && typeof value === 'object' && !Array.isArray(value);
const inside = (root, target) => target !== root && target.startsWith(`${root}${path.sep}`);

function safeFile(root, relative, { maxBytes = 1024 * 1024 } = {}) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\0')) throw coded('TEST_PATH_INVALID');
  const target = path.resolve(root, relative);
  if (!inside(root, target)) throw coded('TEST_PATH_OUTSIDE_PROJECT');
  // Check every component, including directories, so watched/test code cannot
  // be redirected outside the selected project through a symlink.
  let current = root;
  for (const part of path.relative(root, target).split(path.sep)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw coded('TEST_PATH_SYMLINK');
  }
  const stat = fs.statSync(target);
  if (!stat.isFile() || stat.size > maxBytes) throw coded('TEST_FILE_INVALID');
  return { path: target, projectPath: path.relative(root, target).split(path.sep).join('/'), bytes: fs.readFileSync(target) };
}

function rejectUnknown(value, allowed) {
  if (!plain(value) || Object.keys(value).some((key) => !allowed.includes(key))) throw coded('TEST_MANIFEST_FIELD_INVALID');
}

export function loadTestPlan(projectRoot) {
  if (!path.isAbsolute(projectRoot || '')) throw coded('PROJECT_ROOT_ABSOLUTE_PATH_REQUIRED');
  const root = fs.realpathSync(projectRoot);
  const project = JSON.parse(safeFile(root, 'project.json').bytes);
  if (project.version !== '2.4.15') throw coded('PROJECT_CREATOR_VERSION_MISMATCH');
  const source = safeFile(root, MANIFEST, { maxBytes: 256 * 1024 });
  const manifest = JSON.parse(source.bytes);
  rejectUnknown(manifest, ['schemaVersion', 'suites']);
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.suites) || !manifest.suites.length || manifest.suites.length > 64)
    throw coded('TEST_MANIFEST_INVALID');
  const ids = new Set();
  const suites = manifest.suites.map((suite) => {
    rejectUnknown(suite, ['id', 'adapter', 'files', 'dependsOn', 'providerId', 'commandId', 'input', 'timeoutMs']);
    if (!ID.test(suite.id || '') || ids.has(suite.id)) throw coded('TEST_SUITE_ID_INVALID');
    ids.add(suite.id);
    if (!['node', 'creator', 'preview'].includes(suite.adapter)) throw coded('TEST_ADAPTER_UNSUPPORTED');
    if (suite.adapter !== 'node' && suite.timeoutMs !== undefined) throw coded('TEST_TIMEOUT_NODE_ONLY');
    if (suite.timeoutMs !== undefined && (!Number.isInteger(suite.timeoutMs) || suite.timeoutMs < 100 || suite.timeoutMs > 180000))
      throw coded('TEST_TIMEOUT_INVALID');
    if (suite.input !== undefined && !plain(suite.input)) throw coded('TEST_INPUT_INVALID');
    if (suite.adapter === 'node') {
      if (!Array.isArray(suite.files) || !suite.files.length || suite.files.length > 64
        || suite.files.some((item) => typeof item !== 'string' || !/\.(?:c|m)?js$/.test(item))) throw coded('TEST_FILES_INVALID');
      suite.files = suite.files.map((file) => safeFile(root, file).projectPath);
      if (suite.providerId !== undefined || suite.commandId !== undefined || suite.input !== undefined) throw coded('TEST_MANIFEST_FIELD_INVALID');
    } else if (suite.files !== undefined) throw coded('TEST_MANIFEST_FIELD_INVALID');
    if (suite.adapter === 'creator') {
      if (!PROVIDER_ID.test(suite.providerId || '') || !COMMAND_ID.test(suite.commandId || '')) throw coded('TEST_PROVIDER_INVALID');
    } else if (suite.providerId !== undefined || suite.commandId !== undefined) throw coded('TEST_MANIFEST_FIELD_INVALID');
    if (suite.adapter === 'preview' && (Object.hasOwn(suite.input || {}, 'previewSessionId')
      || !Array.isArray(suite.input?.assertions) || !suite.input.assertions.length)) throw coded('TEST_PREVIEW_ASSERTIONS_REQUIRED');
    if (suite.dependsOn !== undefined && (!Array.isArray(suite.dependsOn) || suite.dependsOn.length > 256
      || suite.dependsOn.some((item) => typeof item !== 'string' || !item || path.isAbsolute(item) || item.includes('\\')
        || item.includes('\0') || item.split('/').includes('..') || item.includes('*')))) throw coded('TEST_DEPENDENCIES_INVALID');
    return { ...suite, timeoutMs: suite.timeoutMs ?? 30000 };
  });
  return { projectRoot: root, projectName: project.name || path.basename(root), manifestPath: MANIFEST,
    manifestHash: hash(source.bytes), suites };
}

export function selectTestSuites(plan, { suiteIds = [], changedPaths } = {}) {
  if (suiteIds.some((id) => !plan.suites.some((suite) => suite.id === id))) throw coded('TEST_SUITE_NOT_FOUND');
  return plan.suites.filter((suite) => (!suiteIds.length || suiteIds.includes(suite.id)) && (!changedPaths
    || changedPaths.includes(MANIFEST) || !suite.dependsOn?.length
    || changedPaths.some((changed) => [...(suite.files || []), ...suite.dependsOn].some((dependency) => changed === dependency
      || (dependency.endsWith('/') && changed.startsWith(dependency))))));
}

function runNodeSuite(plan, suite, signal) {
  const files = suite.files.map((file) => safeFile(plan.projectRoot, file));
  const sourceHashes = Object.fromEntries(files.map((file) => [file.projectPath, hash(file.bytes)]));
  const args = ['--test', `--test-reporter=${path.join(HERE, 'testing/node-reporter.mjs')}`, '--', ...files.map((file) => file.path)];
  return new Promise((resolve) => {
    const env = { ...process.env, NODE_OPTIONS: '' };
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, args, { cwd: plan.projectRoot, stdio: ['ignore', 'pipe', 'pipe'],
      // Prevent inherited Node preload flags from running unrelated code in tests.
      env, detached: process.platform !== 'win32' });
    let pending = '', logs = '', failure = null, bytes = 0, killTimer;
    const tests = [];
    const kill = () => {
      try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM'); else child.kill('SIGTERM'); } catch (_) {}
      killTimer ??= setTimeout(() => {
        try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch (_) {}
      }, 1000);
      killTimer.unref?.();
    };
    const abort = () => { failure = 'TEST_CANCELLED'; kill(); };
    const timer = setTimeout(() => { failure = 'TEST_TIMEOUT'; kill(); }, suite.timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const log = (text) => { logs = (logs + text).slice(-16384); };
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 4 * 1024 * 1024) { failure = 'TEST_OUTPUT_TOO_LARGE'; kill(); return; }
      pending += chunk.toString('utf8');
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        try {
          const event = JSON.parse(line);
          if (event.type === 'case' && plain(event.test) && tests.length < 1000) tests.push(event.test);
          else if (event.type === 'log') log(event.message);
          else throw new Error();
        } catch (_) { failure = 'TEST_REPORT_INVALID'; kill(); }
      }
    });
    child.stderr.on('data', (chunk) => log(chunk.toString('utf8')));
    child.once('error', (error) => { failure = `TEST_START_FAILED:${error.code || error.message}`; });
    child.once('close', (exitCode, exitSignal) => {
      clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', abort);
      if (pending.trim()) failure ||= 'TEST_REPORT_INVALID';
      if (exitCode !== 0 && !tests.some((item) => item.status === 'failed')) failure ||= `TEST_PROCESS_EXIT:${exitCode ?? exitSignal}`;
      if (failure) tests.push({ name: failure, status: 'failed', durationMs: 0, message: logs || failure });
      resolve({ tests, sourceHashes, exitCode, signal: exitSignal, logs });
    });
  });
}

function normalizeTests(items) {
  if (!Array.isArray(items) || items.length > 1000) throw coded('TEST_REPORT_INVALID');
  const ids = new Set();
  return items.map((item, index) => {
    if (!plain(item) || !['passed', 'failed', 'skipped'].includes(item.status)
      || typeof item.name !== 'string' || !item.name || (item.durationMs !== undefined
        && (!Number.isFinite(item.durationMs) || item.durationMs < 0))) throw coded('TEST_REPORT_INVALID');
    const id = typeof item.id === 'string' ? item.id.slice(0, 512) : String(index + 1);
    if (!id || ids.has(id)) throw coded('TEST_REPORT_DUPLICATE_CASE');
    ids.add(id);
    return { id, name: item.name.slice(0, 512),
      status: item.status, durationMs: item.durationMs || 0, message: String(item.message || '').slice(0, 8192),
      ...(typeof item.file === 'string' ? { file: item.file.slice(0, 1024), line: item.line } : {}) };
  });
}

export function junitReport(report) {
  const xml = (value) => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  const suites = report.suites.map((suite) => `<testsuite name="${xml(suite.id)}" tests="${suite.tests.length}" failures="${suite.counts.failed}" skipped="${suite.counts.skipped}" time="${suite.durationMs / 1000}">` +
    suite.tests.map((item) => `<testcase classname="${xml(suite.id)}" name="${xml(item.name)}" time="${item.durationMs / 1000}">` +
      (item.status === 'failed' ? `<failure message="${xml(item.message)}">${xml(item.message)}</failure>`
        : item.status === 'skipped' ? `<skipped message="${xml(item.message)}"/>` : '') + '</testcase>').join('') + '</testsuite>').join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites tests="${report.counts.total}" failures="${report.counts.failed}" skipped="${report.counts.skipped}">${suites}</testsuites>\n`;
}

const counts = (tests) => ({ total: tests.length, passed: tests.filter((test) => test.status === 'passed').length,
  failed: tests.filter((test) => test.status === 'failed').length, skipped: tests.filter((test) => test.status === 'skipped').length });

function prepareReportDirectory(projectRoot, reportDir, runId) {
  const requested = reportDir || path.join(os.homedir(), '.cocos-creator-agent', 'test-results', runId);
  if (!path.isAbsolute(requested)) throw coded('TEST_REPORT_DIRECTORY_ABSOLUTE_REQUIRED');
  if (requested === projectRoot || inside(projectRoot, path.resolve(requested))) throw coded('TEST_REPORT_MUST_BE_OUTSIDE_PROJECT');
  const parent = path.dirname(requested);
  let ancestor = parent;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const canonicalAncestor = fs.realpathSync(ancestor);
  const resolvedParent = path.resolve(canonicalAncestor, path.relative(ancestor, parent));
  if (resolvedParent === projectRoot || inside(projectRoot, resolvedParent)) throw coded('TEST_REPORT_MUST_BE_OUTSIDE_PROJECT');
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const target = path.join(fs.realpathSync(parent), path.basename(requested));
  if (target === projectRoot || inside(projectRoot, target)) throw coded('TEST_REPORT_MUST_BE_OUTSIDE_PROJECT');
  fs.mkdirSync(target, { mode: 0o700 }); // Never replace an earlier run.
  return target;
}

function saveReports(report, target) {
  report.artifacts = { json: path.join(target, 'results.json'), junit: path.join(target, 'results.xml') };
  const xml = junitReport(report);
  report.artifacts.junitSha256 = hash(xml);
  fs.writeFileSync(report.artifacts.junit, xml, { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(report.artifacts.json, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  return report;
}

export async function runTestPlan({ projectRoot, suiteIds = [], changedPaths, instanceId, previewSessionId, reportDir,
  signal, refreshPreview = false, onEvent = () => {} }, dependencies = {}) {
  const plan = loadTestPlan(projectRoot);
  const selected = selectTestSuites(plan, { suiteIds, changedPaths });
  if (!selected.length) throw coded('TEST_NO_AFFECTED_SUITES');
  const liveInstances = dependencies.listInstances || listInstances;
  const call = dependencies.callCommand || callCommand;
  const discover = dependencies.getExtensionCommands || getExtensionCommands;
  const invoke = dependencies.callExtensionCommand || callExtensionCommand;
  if (selected.some((suite) => suite.adapter !== 'node')) {
    const live = await liveInstances({ start: false });
    const instance = live.instances?.find((item) => item.instanceId === instanceId);
    if (!instance || instance.projectRoot !== plan.projectRoot || instance.creatorVersion !== '2.4.15')
      throw coded('TEST_CREATOR_IDENTITY_MISMATCH');
  }
  const started = Date.now();
  const report = { schemaVersion: 1, runId: randomUUID(), projectRoot: plan.projectRoot, projectName: plan.projectName,
    creatorVersion: '2.4.15', manifestHash: plan.manifestHash, selectedSuiteIds: selected.map((suite) => suite.id),
    startedAt: new Date(started).toISOString(), suites: [] };
  const reportTarget = prepareReportDirectory(plan.projectRoot, reportDir, report.runId);
  let previewRefreshed = false;
  for (const suite of selected) {
    const suiteStart = Date.now();
    onEvent({ type: 'test-suite-started', runId: report.runId, suiteId: suite.id, adapter: suite.adapter });
    let result;
    let providerDispatched = false;
    try {
      if (signal?.aborted) throw coded('TEST_CANCELLED');
      if (hash(safeFile(plan.projectRoot, MANIFEST).bytes) !== plan.manifestHash) throw coded('TEST_MANIFEST_CHANGED');
      if (suite.adapter === 'node') result = await runNodeSuite(plan, suite, signal);
      else if (suite.adapter === 'creator') {
        const catalog = await discover(instanceId);
        const command = catalog.commands?.find((item) => item.providerId === suite.providerId && item.id === suite.commandId);
        if (command?.status !== 'available' || command.access !== 'control' || command.approval !== true)
          throw coded('TEST_PROVIDER_APPROVAL_REQUIRED');
        providerDispatched = true;
        const receipt = await invoke(instanceId, suite.providerId, suite.commandId, suite.input || {},
          { expectedFingerprint: command.providerFingerprint });
        const returned = receipt.result?.result;
        if (returned?.schemaVersion !== 1) throw coded('TEST_PROVIDER_REPORT_INVALID');
        result = { tests: returned.tests, receipt, requiresManualReview: returned.requiresManualReview === true };
      } else {
        if (typeof previewSessionId !== 'string' || !previewSessionId) throw coded('PREVIEW_SESSION_REQUIRED');
        if (refreshPreview && !previewRefreshed) {
          await call(instanceId, 'creator.preview.refresh', { previewSessionId });
          previewRefreshed = true;
        }
        const receipt = await call(instanceId, 'creator.preview.interact', { ...suite.input, previewSessionId });
        const assertions = receipt.result?.assertions;
        if (!Array.isArray(assertions) || !assertions.length) throw coded('TEST_PREVIEW_REPORT_INVALID');
        result = { tests: assertions.map((item, index) => ({ name: `assertion-${index + 1}:${item.type || 'preview'}`,
          status: item.pass === true ? 'passed' : 'failed', message: JSON.stringify(item).slice(0, 8192) })), receipt };
        if (receipt.result?.passed !== true && !result.tests.some((item) => item.status === 'failed'))
          result.tests.push({ name: 'preview-result', status: 'failed', message: 'Preview did not confirm success.' });
      }
      result.tests = normalizeTests(result.tests);
      if (!result.tests.some((item) => item.status !== 'skipped')) throw coded('TEST_NO_EXECUTED_CASES');
      if (result.requiresManualReview && !result.tests.some((item) => item.status === 'failed'))
        throw coded('TEST_REQUIRES_MANUAL_REVIEW');
    } catch (error) {
      result = { ...result, tests: [{ id: 'runner-error', name: suite.id, status: 'failed', durationMs: 0,
        message: error.code || error.message || String(error) }], error: error.code || error.message || String(error),
      requiresManualReview: providerDispatched };
    }
    const output = { id: suite.id, adapter: suite.adapter, ...result,
      durationMs: Date.now() - suiteStart, counts: counts(result.tests) };
    report.suites.push(output);
    onEvent({ type: 'test-suite-finished', runId: report.runId, suiteId: suite.id, counts: output.counts });
    // Provider calls cannot be safely cancelled/retried after interruption.
    if (output.requiresManualReview || signal?.aborted) break;
  }
  report.cancelled = signal?.aborted === true;
  report.notRunSuiteIds = selected.filter((suite) => !report.suites.some((item) => item.id === suite.id)).map((suite) => suite.id);
  if (report.cancelled && !report.suites.some((suite) => suite.tests.some((item) => item.status === 'failed'))) {
    const tests = [{ id: 'cancelled', name: 'TEST_CANCELLED', status: 'failed', durationMs: 0, message: 'Run cancelled before completion.' }];
    report.suites.push({ id: '$runner', adapter: 'runner', tests, counts: counts(tests), durationMs: 0 });
  }
  report.counts = counts(report.suites.flatMap((suite) => suite.tests));
  report.requiresManualReview = report.suites.some((suite) => suite.requiresManualReview);
  report.passed = !report.cancelled && !report.requiresManualReview && report.counts.failed === 0
    && report.counts.passed > 0 && report.notRunSuiteIds.length === 0;
  report.durationMs = Date.now() - started;
  report.completedAt = new Date().toISOString();
  return saveReports(report, reportTarget);
}

export async function watchTestPlan(options, { onEvent = () => {}, signal, ...dependencies } = {}) {
  if (!Array.isArray(options.paths) || !options.paths.length) throw coded('WATCH_PATHS_INVALID');
  const plan = loadTestPlan(options.projectRoot);
  const paths = [...new Set([MANIFEST, ...options.paths])];
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop, { once: true });
  if (signal?.aborted) stop();
  let queue = Promise.resolve();
  let lastReport = null;
  let runs = 0;
  const run = (changedPaths) => {
    queue = queue.then(async () => {
      if (controller.signal.aborted) return;
      try {
        lastReport = await runTestPlan({ ...options, projectRoot: plan.projectRoot,
          changedPaths: options.affected ? changedPaths : undefined, refreshPreview: Boolean(changedPaths), signal: controller.signal,
          reportDir: options.reportDir ? path.join(options.reportDir, randomUUID()) : undefined, onEvent }, dependencies);
        runs += 1;
        onEvent({ type: 'test-run-finished', trigger: changedPaths ? 'file-change' : 'initial', changedPaths,
          report: lastReport });
        if (lastReport.requiresManualReview) stop();
      } catch (error) {
        if (error.code === 'TEST_NO_AFFECTED_SUITES') onEvent({ type: 'test-run-skipped', changedPaths, reason: error.code });
        else { lastReport = { passed: false }; onEvent({ type: 'test-run-error', error: error.code || error.message }); }
      }
    });
    return queue;
  };
  const watcher = startProjectFileWatch({ projectRoot: plan.projectRoot, paths, intervalMs: options.intervalMs,
    recursive: true, signal: controller.signal, onChange: run });
  try {
    onEvent({ type: 'test-watch-started', projectRoot: plan.projectRoot, paths, affected: Boolean(options.affected) });
    await run();
    await watcher.done;
    await queue;
  } finally { watcher.stop(); signal?.removeEventListener('abort', stop); }
  const result = { type: 'test-watch-stopped', runs, lastTestPassed: lastReport?.passed === true,
    requiresManualReview: lastReport?.requiresManualReview === true, cancelled: signal?.aborted === true };
  onEvent(result);
  return result;
}
