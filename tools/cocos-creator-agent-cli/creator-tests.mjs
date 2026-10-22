import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listInstances, callCommand, getExtensionCommands, callExtensionCommand } from './bridge/client.mjs';
import { validateCommand } from './bridge/contracts.mjs';
import { mergePreviewCoverageReports } from './bridge/preview-coverage.mjs';
import { startProjectFileWatch } from './creator-watch.mjs';
import { PROVIDER_ID, COMMAND_ID } from './creator-extension/provider-contract.cjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = '.cocos-agent/tests.json';
const ID = /^[a-z][a-z0-9-]{0,63}$/;
const CASE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_ENGINE_CASES_PER_RUN = 64;
const MAX_PROVIDER_COVERAGE_FILES = 512;
const MAX_PROVIDER_COVERAGE_BYTES = 256 * 1024;
const MAX_TEST_MERGE_REPORTS = 64;
const MAX_TEST_MERGE_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_TEST_MERGE_OUTPUT_BYTES = 16 * 1024 * 1024;
const COVERAGE_METRICS = ['lines', 'statements', 'branches', 'functions'];
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

function normalizeCreatorCoverage(root, raw, { kind, maxBytes, errorPrefix }) {
  const fail = (suffix) => { throw coded(`${errorPrefix}_${suffix}`); };
  let encoded;
  try { encoded = JSON.stringify(raw); } catch (_) { fail('INVALID'); }
  if (!plain(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.files)
    || raw.files.length > MAX_PROVIDER_COVERAGE_FILES || Buffer.byteLength(encoded || '', 'utf8') > maxBytes)
    fail('INVALID');
  const seen = new Set();
  const totals = Object.fromEntries(COVERAGE_METRICS.map((name) => [name, { covered: 0, total: 0 }]));
  const files = raw.files.map((file) => {
    if (!plain(file) || typeof file.path !== 'string' || file.path.length > 512 || file.path.includes('\\')
      || file.path.includes('\0') || path.posix.isAbsolute(file.path)
      || file.path.split('/').some((part) => !part || part === '.' || part === '..')
      || path.posix.normalize(file.path) !== file.path || seen.has(file.path)
      || !/\.(?:[cm]?js|tsx?)$/.test(file.path) || !/^[0-9a-f]{64}$/.test(file.sha256 || '')
      || !plain(file.metrics) || Object.keys(file.metrics).some((key) => !COVERAGE_METRICS.includes(key)))
      fail('INVALID');
    seen.add(file.path);
    let source;
    try { source = safeFile(root, file.path); }
    catch (_) { fail('SOURCE_INVALID'); }
    if (source.projectPath !== file.path) fail('INVALID');
    if (hash(source.bytes) !== file.sha256) fail('SOURCE_CHANGED');
    const metrics = {};
    for (const [name, counts] of Object.entries(file.metrics)) {
      if (!plain(counts) || Object.keys(counts).some((key) => !['covered', 'total'].includes(key))
        || !Number.isSafeInteger(counts.covered) || !Number.isSafeInteger(counts.total)
        || counts.covered < 0 || counts.total < counts.covered || counts.total > 100_000_000)
        fail('INVALID');
      metrics[name] = { covered: counts.covered, total: counts.total };
      totals[name].covered += counts.covered;
      totals[name].total += counts.total;
      if (!Number.isSafeInteger(totals[name].covered) || !Number.isSafeInteger(totals[name].total))
        fail('INVALID');
    }
    if (!Object.values(metrics).some((counts) => counts.total > 0)) fail('INVALID');
    return { path: file.path, sha256: file.sha256, metrics };
  });
  if (!files.length) fail('INVALID');
  for (const metric of Object.values(totals)) metric.percent = metric.total ? metric.covered / metric.total * 100 : 0;
  return { kind, schemaVersion: 1, files, totals };
}

function safeEditorTestFile(root, relative) {
  if (typeof relative !== 'string' || relative.length > 512 || relative.includes('\\')
    || relative.startsWith('/') || relative.includes('\0')) throw coded('TEST_EDITOR_SCRIPT_PATH_INVALID');
  const parts = relative.split('/');
  const editorScriptsIndex = parts.indexOf('editor-scripts');
  if (parts[0] !== 'packages' || parts.length < 4 || editorScriptsIndex < 2
    || editorScriptsIndex === parts.length - 1 || !/\.js$/.test(relative)
    || parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.')))
    throw coded('TEST_EDITOR_SCRIPT_PATH_INVALID');
  return safeFile(root, relative, { maxBytes: 16 * 1024 }).projectPath;
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
    rejectUnknown(suite, ['id', 'adapter', 'files', 'dependsOn', 'providerId', 'commandId', 'scriptPath', 'input', 'testIds', 'testCases', 'timeoutMs']);
    if (!ID.test(suite.id || '') || ids.has(suite.id)) throw coded('TEST_SUITE_ID_INVALID');
    ids.add(suite.id);
    if (!['node', 'creator', 'editor', 'preview'].includes(suite.adapter)) throw coded('TEST_ADAPTER_UNSUPPORTED');
    if (suite.adapter !== 'node' && suite.timeoutMs !== undefined) throw coded('TEST_TIMEOUT_NODE_ONLY');
    if (suite.timeoutMs !== undefined && (!Number.isInteger(suite.timeoutMs) || suite.timeoutMs < 100 || suite.timeoutMs > 180000))
      throw coded('TEST_TIMEOUT_INVALID');
    if (suite.input !== undefined && !plain(suite.input)) throw coded('TEST_INPUT_INVALID');
    if (suite.adapter === 'node') {
      if (!Array.isArray(suite.files) || !suite.files.length || suite.files.length > 64
        || suite.files.some((item) => typeof item !== 'string' || !/\.(?:c|m)?js$/.test(item))) throw coded('TEST_FILES_INVALID');
      suite.files = suite.files.map((file) => safeFile(root, file).projectPath);
      if (suite.providerId !== undefined || suite.commandId !== undefined || suite.scriptPath !== undefined
        || suite.input !== undefined) throw coded('TEST_MANIFEST_FIELD_INVALID');
    } else if (suite.files !== undefined) throw coded('TEST_MANIFEST_FIELD_INVALID');
    if (suite.adapter === 'creator') {
      if (!PROVIDER_ID.test(suite.providerId || '') || !COMMAND_ID.test(suite.commandId || '')
        || suite.scriptPath !== undefined) throw coded('TEST_PROVIDER_INVALID');
      if (suite.testIds !== undefined && (!Array.isArray(suite.testIds) || !suite.testIds.length || suite.testIds.length > 64
        || suite.testIds.some((id) => typeof id !== 'string' || !CASE_ID.test(id))
        || new Set(suite.testIds).size !== suite.testIds.length)) throw coded('TEST_CREATOR_CASE_IDS_INVALID');
      if (suite.testIds && Object.hasOwn(suite.input || {}, 'testIds'))
        throw coded('TEST_CREATOR_RUNNER_INPUT_RESERVED');
      if (Object.hasOwn(suite.input || {}, 'coverage')) throw coded('TEST_CREATOR_RUNNER_INPUT_RESERVED');
    } else if (suite.adapter === 'editor') {
      if (suite.providerId !== undefined || suite.commandId !== undefined) throw coded('TEST_MANIFEST_FIELD_INVALID');
      suite.scriptPath = safeEditorTestFile(root, suite.scriptPath);
      if (suite.input !== undefined && Buffer.byteLength(JSON.stringify(suite.input), 'utf8') > 16 * 1024)
        throw coded('TEST_EDITOR_SCRIPT_INPUT_TOO_LARGE');
      if (suite.testIds !== undefined && (!Array.isArray(suite.testIds) || !suite.testIds.length || suite.testIds.length > 1000
        || suite.testIds.some((id) => typeof id !== 'string' || !CASE_ID.test(id))
        || new Set(suite.testIds).size !== suite.testIds.length)) throw coded('TEST_EDITOR_CASE_IDS_INVALID');
    } else if (suite.providerId !== undefined || suite.commandId !== undefined || suite.scriptPath !== undefined)
      throw coded('TEST_MANIFEST_FIELD_INVALID');
    if (!['creator', 'editor'].includes(suite.adapter) && suite.testIds !== undefined) throw coded('TEST_MANIFEST_FIELD_INVALID');
    if (suite.adapter === 'editor' && Object.hasOwn(suite.input || {}, '__cocosAgentTest'))
      throw coded('TEST_EDITOR_RUNNER_INPUT_RESERVED');
    if (suite.adapter === 'preview') {
      if (suite.testCases !== undefined) {
        if (suite.input !== undefined) throw coded('TEST_PREVIEW_CASES_INPUT_EXCLUSIVE');
        if (!Array.isArray(suite.testCases) || !suite.testCases.length || suite.testCases.length > MAX_ENGINE_CASES_PER_RUN)
          throw coded('TEST_PREVIEW_CASES_INVALID');
        const caseIds = new Set();
        suite.testCases = suite.testCases.map((testCase) => {
          rejectUnknown(testCase, ['id', 'name', 'actions', 'assertions', 'settleMs']);
          if (typeof testCase.id !== 'string' || !CASE_ID.test(testCase.id) || caseIds.has(testCase.id))
            throw coded('TEST_PREVIEW_CASE_ID_INVALID');
          caseIds.add(testCase.id);
          if (testCase.name !== undefined && (typeof testCase.name !== 'string' || !testCase.name || testCase.name.length > 512))
            throw coded('TEST_PREVIEW_CASE_NAME_INVALID');
          if (!Array.isArray(testCase.assertions) || !testCase.assertions.length || testCase.assertions.length > 12)
            throw coded('TEST_PREVIEW_CASE_ASSERTIONS_REQUIRED');
          const checked = validateCommand('creator.preview.interact', {
            previewSessionId: '00000000-0000-0000-0000-000000000000', actions: testCase.actions,
            assertions: testCase.assertions, ...(testCase.settleMs === undefined ? {} : { settleMs: testCase.settleMs }),
          });
          if (!checked.ok) throw coded(`TEST_PREVIEW_CASE_${checked.code}`);
          return { ...testCase };
        });
      } else {
        if (Object.hasOwn(suite.input || {}, 'previewSessionId') || Object.hasOwn(suite.input || {}, 'coverage'))
          throw coded('TEST_PREVIEW_RUNNER_FIELD_RESERVED');
        if (!Array.isArray(suite.input?.actions) || !suite.input.actions.length || suite.input.actions.length > 12)
          throw coded('TEST_PREVIEW_ACTIONS_REQUIRED');
        if (!Array.isArray(suite.input?.assertions) || !suite.input.assertions.length || suite.input.assertions.length > 12)
          throw coded('TEST_PREVIEW_ASSERTIONS_REQUIRED');
      }
    }
    if (suite.adapter !== 'preview' && suite.testCases !== undefined) throw coded('TEST_MANIFEST_FIELD_INVALID');
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

export function loadFailedSuiteIds(projectRoot, reportPath) {
  if (typeof reportPath !== 'string' || !path.isAbsolute(reportPath)) throw coded('TEST_REPORT_PATH_ABSOLUTE_REQUIRED');
  const plan = loadTestPlan(projectRoot);
  let stat;
  try { stat = fs.lstatSync(reportPath); }
  catch (error) { if (error?.code === 'ENOENT') throw coded('TEST_REPORT_NOT_FOUND'); throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw coded('TEST_REPORT_FILE_INVALID');
  let report;
  try { report = JSON.parse(fs.readFileSync(reportPath, 'utf8')); }
  catch (_) { throw coded('TEST_REPORT_INVALID'); }
  let previousRoot;
  try { previousRoot = fs.realpathSync(report.projectRoot); }
  catch (_) { throw coded('TEST_REPORT_PROJECT_INVALID'); }
  if (report.schemaVersion !== 1 || previousRoot !== plan.projectRoot || report.manifestHash !== plan.manifestHash
    || !Array.isArray(report.suites)) throw coded('TEST_REPORT_STALE_OR_MISMATCHED');
  const known = new Set(plan.suites.map((suite) => suite.id));
  const failed = [...new Set(report.suites.filter((suite) => suite && typeof suite.id === 'string'
    && (suite.counts?.failed > 0 || suite.tests?.some((item) => item?.status === 'failed'))).map((suite) => suite.id))];
  if (!failed.length) throw coded('TEST_REPORT_NO_FAILED_SUITES');
  if (failed.some((id) => !known.has(id))) throw coded('TEST_REPORT_SUITE_NOT_FOUND');
  return failed;
}

export function parseTestShard(value) {
  if (value === undefined) return undefined;
  const match = typeof value === 'string' && value.match(/^([1-9][0-9]{0,2})\/([1-9][0-9]{0,2})$/);
  if (!match) throw coded('TEST_SHARD_INVALID');
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (index > total || total > 64) throw coded('TEST_SHARD_INVALID');
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 20 || (major === 20 && minor < 5)) throw coded('TEST_SHARD_NODE_VERSION_UNSUPPORTED');
  return { index, total };
}

export function testShardForSuite(suiteId, total) {
  if (typeof suiteId !== 'string' || !suiteId || !Number.isInteger(total) || total < 1 || total > 64)
    throw coded('TEST_SHARD_INVALID');
  return createHash('sha256').update(suiteId).digest().readUInt32BE(0) % total + 1;
}

export function testShardForCase(suiteId, caseId, total) {
  if (typeof suiteId !== 'string' || !suiteId || typeof caseId !== 'string' || !CASE_ID.test(caseId)
    || !Number.isInteger(total) || total < 1 || total > 64) throw coded('TEST_SHARD_INVALID');
  return testShardForSuite(`${suiteId}:${caseId}`, total);
}

function requireCoverageSupport() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 20 || (major === 20 && minor < 1)) throw coded('TEST_COVERAGE_NODE_VERSION_UNSUPPORTED');
}

function runNodeSuite(plan, suite, signal, { shard, coverage = false } = {}) {
  const files = suite.files.map((file) => safeFile(plan.projectRoot, file));
  const sourceHashes = Object.fromEntries(files.map((file) => [file.projectPath, hash(file.bytes)]));
  const args = ['--test', `--test-reporter=${path.join(HERE, 'testing/node-reporter.mjs')}`,
    ...(shard ? [`--test-shard=${shard.index}/${shard.total}`] : []),
    ...(coverage ? ['--experimental-test-coverage'] : []), '--', ...files.map((file) => file.path)];
  return new Promise((resolve) => {
    const env = { ...process.env, NODE_OPTIONS: '' };
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, args, { cwd: plan.projectRoot, stdio: ['ignore', 'pipe', 'pipe'],
      // Prevent inherited Node preload flags from running unrelated code in tests.
      env, detached: process.platform !== 'win32' });
    let pending = '', logs = '', failure = null, bytes = 0, killTimer;
    const tests = [];
    let coverageSummary = null;
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
          else if (event.type === 'coverage' && plain(event.summary)) coverageSummary = event.summary;
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
      if (coverage && !coverageSummary) failure ||= 'TEST_COVERAGE_REPORT_MISSING';
      if (exitCode !== 0 && !tests.some((item) => item.status === 'failed')) failure ||= `TEST_PROCESS_EXIT:${exitCode ?? exitSignal}`;
      if (failure) tests.push({ name: failure, status: 'failed', durationMs: 0, message: logs || failure });
      resolve({ tests, sourceHashes, exitCode, signal: exitSignal, logs,
        ...(coverageSummary ? { coverage: coverageSummary } : {}) });
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
      ...(typeof item.file === 'string' ? { file: item.file.slice(0, 1024), line: item.line,
        ...(Number.isInteger(item.column) ? { column: item.column } : {}),
        ...(Number.isInteger(item.nesting) ? { nesting: item.nesting } : {}) } : {}) };
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

function readMergeReport(reportPath, seenPaths, byteBudget) {
  if (typeof reportPath !== 'string' || !path.isAbsolute(reportPath)) throw coded('TEST_MERGE_REPORT_PATH_ABSOLUTE_REQUIRED');
  let stat;
  try { stat = fs.lstatSync(reportPath); }
  catch (error) { if (error?.code === 'ENOENT') throw coded('TEST_MERGE_REPORT_NOT_FOUND'); throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024)
    throw coded('TEST_MERGE_REPORT_FILE_INVALID');
  const realPath = fs.realpathSync(reportPath);
  if (seenPaths.has(realPath)) throw coded('TEST_MERGE_DUPLICATE_REPORT');
  seenPaths.add(realPath);
  byteBudget.total += stat.size;
  if (byteBudget.total > MAX_TEST_MERGE_INPUT_BYTES) throw coded('TEST_MERGE_INPUT_TOO_LARGE');
  let report;
  try { report = JSON.parse(fs.readFileSync(realPath, 'utf8')); }
  catch (_) { throw coded('TEST_MERGE_REPORT_INVALID'); }
  return { report, realPath };
}

function sameList(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && actual.every((item, index) => item === expected[index]);
}

function validateMergeReport(report, plan, selectedSuiteIds, expectedCoverage) {
  if (!plain(report) || report.schemaVersion !== 1 || typeof report.runId !== 'string'
    || report.creatorVersion !== '2.4.15' || report.projectName !== plan.projectName
    || report.manifestHash !== plan.manifestHash || report.projectRoot !== plan.projectRoot
    || report.coverageEnabled !== expectedCoverage || report.cancelled === true || report.requiresManualReview === true
    || report.passed !== (report.counts?.failed === 0 && report.counts?.passed > 0 || report.emptyShard === true)
    || !Array.isArray(report.selectedSuiteIds) || !sameList(report.selectedSuiteIds, selectedSuiteIds)
    || !Array.isArray(report.notRunSuiteIds) || report.notRunSuiteIds.length !== 0
    || !Array.isArray(report.suites) || !plain(report.shard)) throw coded('TEST_MERGE_REPORT_MISMATCH');

  const shard = parseTestShard(`${report.shard.index}/${report.shard.total}`);
  if (!plain(report.shard.strategies)) throw coded('TEST_MERGE_REPORT_MISMATCH');
  const selected = selectedSuiteIds.map((id) => plan.suites.find((suite) => suite.id === id));
  const expectedCaseIds = {};
  const expectedSelectedSuites = [];
  const expectedSkippedSuites = [];
  for (const suite of selected) {
    if (suite.adapter === 'node') {
      expectedSelectedSuites.push(suite.id);
    } else if (suite.testIds || suite.testCases) {
      const ids = suite.testIds || suite.testCases.map((item) => item.id);
      const assigned = ids.filter((id) => testShardForCase(suite.id, id, shard.total) === shard.index);
      expectedCaseIds[suite.id] = assigned;
      (assigned.length ? expectedSelectedSuites : expectedSkippedSuites).push(suite.id);
    } else if (testShardForSuite(suite.id, shard.total) === shard.index) {
      expectedSelectedSuites.push(suite.id);
    } else {
      expectedSkippedSuites.push(suite.id);
    }
  }
  if (!sameList(report.shardSelectedSuiteIds, expectedSelectedSuites)
    || !sameList(report.shardSkippedSuiteIds, expectedSkippedSuites)
    || JSON.stringify(report.selectedCaseIdsBySuite || {}) !== JSON.stringify(expectedCaseIds))
    throw coded('TEST_MERGE_SHARD_ASSIGNMENT_INVALID');

  const suiteById = new Map(selected.map((suite) => [suite.id, suite]));
  const seenSuiteIds = new Set();
  const tests = [];
  for (const output of report.suites) {
    if (!plain(output) || !suiteById.has(output.id) || seenSuiteIds.has(output.id)
      || output.adapter !== suiteById.get(output.id).adapter || !Array.isArray(output.tests)
      || output.tests.length > 1000 || !Number.isFinite(output.durationMs) || output.durationMs < 0)
      throw coded('TEST_MERGE_SUITE_REPORT_INVALID');
    seenSuiteIds.add(output.id);
    const suiteTests = output.tests;
    for (const item of suiteTests) {
      if (!plain(item) || typeof item.id !== 'string' || !item.id || item.id.length > 512
        || typeof item.name !== 'string' || !item.name || item.name.length > 512
        || !['passed', 'failed', 'skipped'].includes(item.status)
        || !Number.isFinite(item.durationMs) || item.durationMs < 0
        || typeof item.message !== 'string' || item.message.length > 8192
        || (item.file !== undefined && typeof item.file !== 'string')) throw coded('TEST_MERGE_CASE_REPORT_INVALID');
      tests.push(item);
    }
    const actualCounts = counts(suiteTests);
    if (!plain(output.counts) || Object.keys(actualCounts).some((key) => output.counts[key] !== actualCounts[key]))
      throw coded('TEST_MERGE_SUITE_COUNTS_MISMATCH');
  }
  if (!sameList(report.suites.map((suite) => suite.id), expectedSelectedSuites))
    throw coded('TEST_MERGE_SUITE_REPORT_INCOMPLETE');
  const actualCounts = counts(tests);
  if (!plain(report.counts) || Object.keys(actualCounts).some((key) => report.counts[key] !== actualCounts[key]))
    throw coded('TEST_MERGE_COUNTS_MISMATCH');

  for (const suite of selected) {
    const output = report.suites.find((item) => item.id === suite.id);
    const assigned = expectedCaseIds[suite.id];
    if (assigned) {
      const received = output.tests.map((item) => item.id);
      if (received.length !== assigned.length || new Set(received).size !== received.length
        || assigned.some((id) => !received.includes(id))) throw coded('TEST_MERGE_CASE_ASSIGNMENT_INVALID');
    }
  }
  return { shard, selected, expectedCaseIds };
}

function mergeTestCaseKey(item, suite, shard) {
  if (suite.adapter === 'node') {
    if (typeof item.file === 'string' && Number.isInteger(item.line))
      return `node:${JSON.stringify([item.file, item.line, item.column ?? null, item.nesting ?? null, item.name])}`;
    return `node-shard:${shard.index}:${item.id}`;
  }
  return `case:${item.id}`;
}

export function mergeTestReports({ reportPaths, reportDir } = {}) {
  if (!Array.isArray(reportPaths) || reportPaths.length < 1 || reportPaths.length > MAX_TEST_MERGE_REPORTS
    || reportPaths.some((item) => typeof item !== 'string')) throw coded('TEST_MERGE_REPORTS_INVALID');
  const seenPaths = new Set();
  const byteBudget = { total: 0 };
  const loaded = reportPaths.map((reportPath) => readMergeReport(reportPath, seenPaths, byteBudget));
  const first = loaded[0].report;
  if (!plain(first) || typeof first.projectRoot !== 'string' || !path.isAbsolute(first.projectRoot))
    throw coded('TEST_MERGE_PROJECT_INVALID');
  let plan;
  try { plan = loadTestPlan(first.projectRoot); }
  catch (_) { throw coded('TEST_MERGE_PROJECT_INVALID'); }
  let root;
  try { root = fs.realpathSync(first.projectRoot); }
  catch (_) { throw coded('TEST_MERGE_PROJECT_INVALID'); }
  if (root !== plan.projectRoot || typeof first.manifestHash !== 'string') throw coded('TEST_MERGE_PROJECT_INVALID');
  const selectedSuiteIds = first.selectedSuiteIds;
  if (!Array.isArray(selectedSuiteIds) || !selectedSuiteIds.length || selectedSuiteIds.length > 64
    || new Set(selectedSuiteIds).size !== selectedSuiteIds.length
    || selectedSuiteIds.some((id) => !plan.suites.some((suite) => suite.id === id)))
    throw coded('TEST_MERGE_REPORT_MISMATCH');
  const selectedOrder = plan.suites.filter((suite) => selectedSuiteIds.includes(suite.id)).map((suite) => suite.id);
  if (!sameList(selectedSuiteIds, selectedOrder)) throw coded('TEST_MERGE_REPORT_MISMATCH');
  if (loaded.length !== first.shard?.total) throw coded('TEST_MERGE_SHARD_SET_INCOMPLETE');

  const coverageEnabled = first.coverageEnabled;
  if (typeof coverageEnabled !== 'boolean') throw coded('TEST_MERGE_REPORT_MISMATCH');
  const entries = loaded.map(({ report, realPath }) => ({ report, realPath,
    validation: validateMergeReport(report, plan, selectedSuiteIds, coverageEnabled) }));
  const total = entries[0].validation.shard.total;
  if (entries.some((entry) => entry.validation.shard.total !== total)) throw coded('TEST_MERGE_REPORT_MISMATCH');
  entries.sort((left, right) => left.validation.shard.index - right.validation.shard.index);
  if (entries.some((entry, index) => entry.validation.shard.index !== index + 1))
    throw coded('TEST_MERGE_SHARD_SET_INCOMPLETE');
  const strategies = JSON.stringify(entries[0].report.shard.strategies);
  if (entries.some((entry) => JSON.stringify(entry.report.shard.strategies) !== strategies))
    throw coded('TEST_MERGE_REPORT_MISMATCH');

  const sourceHashesBySuite = {};
  for (const { report } of entries) {
    for (const suite of report.suites) {
      const planSuite = plan.suites.find((item) => item.id === suite.id);
      if (planSuite.adapter === 'node') {
        if (!plain(suite.sourceHashes)) throw coded('TEST_MERGE_SOURCE_MISMATCH');
        const expectedFiles = planSuite.files.slice().sort();
        if (!sameList(Object.keys(suite.sourceHashes).sort(), expectedFiles)) throw coded('TEST_MERGE_SOURCE_MISMATCH');
        sourceHashesBySuite[suite.id] ||= {};
        for (const [relative, digest] of Object.entries(suite.sourceHashes)) {
          let source;
          try { source = safeFile(plan.projectRoot, relative); }
          catch (_) { throw coded('TEST_MERGE_SOURCE_MISMATCH'); }
          if (!/^[0-9a-f]{64}$/.test(digest) || hash(source.bytes) !== digest
            || (sourceHashesBySuite[suite.id][relative] && sourceHashesBySuite[suite.id][relative] !== digest))
            throw coded('TEST_MERGE_SOURCE_MISMATCH');
          sourceHashesBySuite[suite.id][relative] = digest;
        }
      } else if (suite.sourceHashes !== undefined) throw coded('TEST_MERGE_SOURCE_MISMATCH');
    }
  }

  const mergedSuites = [];
  for (const suite of plan.suites.filter((item) => selectedSuiteIds.includes(item.id))) {
    const shardOutputs = entries.flatMap(({ report, validation }) => report.suites
      .filter((item) => item.id === suite.id).map((item) => ({ shard: validation.shard, output: item })));
    const tests = [];
    const keys = new Set();
    for (const { shard, output } of shardOutputs) {
      for (const item of output.tests) {
        const key = mergeTestCaseKey(item, suite, shard);
        if (keys.has(key)) throw coded('TEST_MERGE_DUPLICATE_CASE');
        keys.add(key);
        tests.push({ ...item, id: suite.adapter === 'node' ? `node-${hash(key).slice(0, 24)}` : item.id });
      }
    }
    if (suite.adapter !== 'node' && (suite.testIds || suite.testCases)) {
      const expected = suite.testIds || suite.testCases.map((item) => item.id);
      const actual = tests.map((item) => item.id);
      if (actual.length !== expected.length || new Set(actual).size !== actual.length
        || expected.some((id) => !actual.includes(id))) throw coded('TEST_MERGE_CASE_SET_INCOMPLETE');
    }
    const suiteCoverage = shardOutputs.flatMap(({ shard, output }) => output.coverage === undefined
      ? [] : [{ index: shard.index, coverage: output.coverage }]);
    const receipts = shardOutputs.flatMap(({ shard, output }) => output.receipt === undefined
      ? [] : [{ index: shard.index, receipt: output.receipt }]);
    const merged = { id: suite.id, adapter: suite.adapter, tests, counts: counts(tests),
      durationMs: shardOutputs.reduce((sum, item) => sum + item.output.durationMs, 0),
      shardIndexes: shardOutputs.map((item) => item.shard.index) };
    if (suiteCoverage.length) merged.coverageByShard = suiteCoverage;
    if (receipts.length) merged.receiptsByShard = receipts;
    if (sourceHashesBySuite[suite.id]) merged.sourceHashes = sourceHashesBySuite[suite.id];
    mergedSuites.push(merged);
  }
  const allTests = mergedSuites.flatMap((suite) => suite.tests);
  const mergedCounts = counts(allTests);
  const startedAt = entries.map(({ report }) => report.startedAt).filter((value) => typeof value === 'string').sort()[0];
  const completedAt = entries.map(({ report }) => report.completedAt).filter((value) => typeof value === 'string').sort().at(-1);
  const report = { schemaVersion: 1, runId: randomUUID(), projectRoot: plan.projectRoot, projectName: plan.projectName,
    creatorVersion: '2.4.15', manifestHash: plan.manifestHash, selectedSuiteIds,
    mergedFrom: entries.map(({ report: source, realPath, validation }) => ({ runId: source.runId,
      reportPath: realPath, shard: validation.shard })),
    shard: { total, indexes: entries.map((entry) => entry.validation.shard.index), strategies: entries[0].report.shard.strategies },
    coverageEnabled, suites: mergedSuites, counts: mergedCounts, emptyShard: mergedCounts.total === 0,
    requiresManualReview: false, cancelled: false, notRunSuiteIds: [],
    passed: mergedCounts.failed === 0 && (mergedCounts.passed > 0 || mergedCounts.total === 0),
    durationMs: Math.max(...entries.map((entry) => Number(entry.report.durationMs) || 0)),
    ...(startedAt ? { startedAt } : {}), ...(completedAt ? { completedAt } : {}) };
  const jsonBytes = Buffer.byteLength(JSON.stringify(report, null, 2) + '\n', 'utf8');
  const junitBytes = Buffer.byteLength(junitReport(report), 'utf8');
  if (jsonBytes > MAX_TEST_MERGE_OUTPUT_BYTES || junitBytes > MAX_TEST_MERGE_OUTPUT_BYTES)
    throw coded('TEST_MERGE_OUTPUT_TOO_LARGE');
  const target = prepareReportDirectory(plan.projectRoot, reportDir, report.runId);
  return saveReports(report, target);
}

export async function runTestPlan({ projectRoot, suiteIds = [], changedPaths, instanceId, previewSessionId, reportDir,
  signal, refreshPreview = false, onEvent = () => {}, shard, coverage = false }, dependencies = {}) {
  const plan = loadTestPlan(projectRoot);
  const selected = selectTestSuites(plan, { suiteIds, changedPaths });
  if (!selected.length) throw coded('TEST_NO_AFFECTED_SUITES');
  let normalizedShard;
  if (shard !== undefined) {
    if (!plain(shard) || !Number.isInteger(shard.index) || !Number.isInteger(shard.total)) throw coded('TEST_SHARD_INVALID');
    normalizedShard = parseTestShard(`${shard.index}/${shard.total}`);
  }
  if (typeof coverage !== 'boolean') throw coded('TEST_COVERAGE_INVALID');
  if (coverage && selected.some((suite) => suite.adapter === 'node')) requireCoverageSupport();
  const selectedCaseIdsBySuite = {};
  const shardSkipped = normalizedShard ? selected.filter((suite) => suite.adapter !== 'node'
    && !(['creator', 'editor'].includes(suite.adapter) && suite.testIds)
    && !(suite.adapter === 'preview' && suite.testCases)
    && testShardForSuite(suite.id, normalizedShard.total) !== normalizedShard.index) : [];
  for (const suite of selected.filter((item) => ['creator', 'editor'].includes(item.adapter) && item.testIds)) {
    const selectedCaseIds = normalizedShard ? suite.testIds.filter((id) =>
      testShardForCase(suite.id, id, normalizedShard.total) === normalizedShard.index) : suite.testIds;
    selectedCaseIdsBySuite[suite.id] = selectedCaseIds;
    if (normalizedShard && !selectedCaseIds.length) shardSkipped.push(suite);
  }
  for (const suite of selected.filter((item) => item.adapter === 'preview' && item.testCases)) {
    const selectedCaseIds = normalizedShard ? suite.testCases.filter((item) =>
      testShardForCase(suite.id, item.id, normalizedShard.total) === normalizedShard.index).map((item) => item.id)
      : suite.testCases.map((item) => item.id);
    selectedCaseIdsBySuite[suite.id] = selectedCaseIds;
    if (normalizedShard && !selectedCaseIds.length) shardSkipped.push(suite);
  }
  const runnable = selected.filter((suite) => !shardSkipped.includes(suite));
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
    ...(normalizedShard ? { shard: { ...normalizedShard,
      strategies: { node: 'test-case', creator: 'test-case-when-manifested-otherwise-suite',
        editor: 'test-case-when-manifested-otherwise-suite', preview: 'test-case-when-manifested-otherwise-suite' } } } : {}),
    shardSelectedSuiteIds: runnable.map((suite) => suite.id), shardSkippedSuiteIds: shardSkipped.map((suite) => suite.id),
    ...(Object.keys(selectedCaseIdsBySuite).length ? { selectedCaseIdsBySuite } : {}),
    coverageEnabled: coverage,
    startedAt: new Date(started).toISOString(), suites: [] };
  const reportTarget = prepareReportDirectory(plan.projectRoot, reportDir, report.runId);
  let previewRefreshed = false;
  for (const suite of runnable) {
    const suiteStart = Date.now();
    onEvent({ type: 'test-suite-started', runId: report.runId, suiteId: suite.id, adapter: suite.adapter });
    let result;
    let executionDispatched = false;
    try {
      if (signal?.aborted) throw coded('TEST_CANCELLED');
      if (hash(safeFile(plan.projectRoot, MANIFEST).bytes) !== plan.manifestHash) throw coded('TEST_MANIFEST_CHANGED');
      if (suite.adapter === 'node') result = await runNodeSuite(plan, suite, signal, { shard: normalizedShard, coverage });
      else if (suite.adapter === 'editor') {
        const before = safeFile(plan.projectRoot, suite.scriptPath, { maxBytes: 16 * 1024 });
        const selectedCaseIds = suite.testIds ? selectedCaseIdsBySuite[suite.id] : undefined;
        if (selectedCaseIds && selectedCaseIds.length > MAX_ENGINE_CASES_PER_RUN)
          throw coded('TEST_EDITOR_CASE_BATCH_LIMIT');
        const editorRunnerInput = {
          ...(suite.testIds ? { selectedCaseIds } : {}),
          ...(normalizedShard && suite.testIds ? { shard: normalizedShard } : {}),
          ...(coverage ? { coverage: true } : {}),
        };
        const editorInput = Object.keys(editorRunnerInput).length
          ? { ...(suite.input || {}), __cocosAgentTest: editorRunnerInput } : suite.input || {};
        if (Buffer.byteLength(JSON.stringify(editorInput), 'utf8') > 16 * 1024)
          throw coded('TEST_EDITOR_SCRIPT_INPUT_TOO_LARGE');
        const planReceipt = await call(instanceId, 'creator.editor.eval-file.plan', {
          scriptPath: suite.scriptPath, input: editorInput,
        });
        const planned = planReceipt.result;
        const expectedInput = JSON.stringify(editorInput);
        if (planned?.status !== 'planned' || planned.mode !== 'file' || planned.projectRoot !== plan.projectRoot
          || planned.creatorVersion !== '2.4.15' || planned.creatorInstanceId !== instanceId
          || planned.scriptPath !== suite.scriptPath
          || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planned.operationId || '')
          || !/^[0-9a-f]{64}$/.test(planned.planHash || '') || !/^[0-9a-f]{64}$/.test(planned.sourceSha256 || '')
          || planned.inputSha256 !== hash(Buffer.from(expectedInput, 'utf8'))
          || JSON.stringify(planned.input) !== expectedInput)
          throw coded('TEST_EDITOR_PLAN_INVALID');
        const checkedPlan = safeFile(plan.projectRoot, suite.scriptPath, { maxBytes: 16 * 1024 });
        if (hash(before.bytes) !== hash(checkedPlan.bytes) || hash(checkedPlan.bytes) !== planned.sourceSha256)
          throw coded('TEST_EDITOR_SOURCE_CHANGED');
        executionDispatched = true;
        const runReceipt = await call(instanceId, 'creator.editor.eval-file.commit', {
          operationId: planned.operationId, planHash: planned.planHash,
        });
        const execution = runReceipt.result;
        if (execution?.status !== 'completed' || execution.manualReviewRequired !== false
          || execution.projectRoot !== plan.projectRoot || execution.creatorVersion !== '2.4.15'
          || execution.creatorInstanceId !== instanceId || execution.operationId !== planned.operationId
          || execution.mode !== 'file' || execution.scriptPath !== suite.scriptPath
          || execution.sourceSha256 !== planned.sourceSha256 || execution.inputSha256 !== planned.inputSha256)
          throw coded('TEST_EDITOR_EXECUTION_UNCONFIRMED');
        const returned = execution.result;
        if (returned?.schemaVersion !== 1 || !Array.isArray(returned.tests)) throw coded('TEST_EDITOR_REPORT_INVALID');
        if (suite.testIds && (returned.tests.length !== selectedCaseIds.length
          || selectedCaseIds.some((id) => returned.tests.filter((item) => item?.id === id).length !== 1)))
          throw coded('TEST_EDITOR_CASE_RESULTS_MISMATCH');
        result = { tests: returned.tests, requiresManualReview: returned.requiresManualReview === true,
          sourceHashes: { [suite.scriptPath]: planned.sourceSha256 }, receipt: {
            operationId: planned.operationId, planHash: planned.planHash, status: execution.status,
            creatorInstanceId: execution.creatorInstanceId, sourceSha256: execution.sourceSha256,
            inputSha256: execution.inputSha256, startedAt: execution.startedAt,
            completedAt: execution.completedAt,
          } };
        if (coverage) {
          if (!returned.coverage) throw coded('TEST_COVERAGE_REPORT_MISSING');
          result.coverage = normalizeCreatorCoverage(plan.projectRoot, returned.coverage,
            { kind: 'creator-editor-script', maxBytes: 48 * 1024, errorPrefix: 'TEST_EDITOR_COVERAGE' });
        }
      }
      else if (suite.adapter === 'creator') {
        const catalog = await discover(instanceId);
        const command = catalog.commands?.find((item) => item.providerId === suite.providerId && item.id === suite.commandId);
        if (command?.status !== 'available' || command.access !== 'control' || command.approval !== true)
          throw coded('TEST_PROVIDER_APPROVAL_REQUIRED');
        const selectedCaseIds = suite.testIds ? selectedCaseIdsBySuite[suite.id] : undefined;
        const providerInput = { ...(suite.input || {}) };
        if (selectedCaseIds) {
          const selection = command.input?.properties?.testIds;
          if (selection?.type !== 'array' || selection.items?.type !== 'string'
            || !Number.isInteger(selection.maxItems) || selection.maxItems > 64
            || selectedCaseIds.length > selection.maxItems) throw coded('TEST_PROVIDER_CASE_SELECTION_UNSUPPORTED');
          providerInput.testIds = selectedCaseIds;
        }
        if (coverage) {
          const coverageInput = command.input?.properties?.coverage;
          if (coverageInput?.type !== 'boolean') throw coded('TEST_COVERAGE_CREATOR_PROVIDER_UNSUPPORTED');
          providerInput.coverage = true;
        }
        executionDispatched = true;
        const receipt = await invoke(instanceId, suite.providerId, suite.commandId, providerInput,
          { expectedFingerprint: command.providerFingerprint });
        const returned = receipt.result?.result;
        if (returned?.schemaVersion !== 1 || !Array.isArray(returned.tests)) throw coded('TEST_PROVIDER_REPORT_INVALID');
        if (selectedCaseIds && (returned.tests.length !== selectedCaseIds.length
          || selectedCaseIds.some((id) => returned.tests.filter((item) => item?.id === id).length !== 1)))
          throw coded('TEST_PROVIDER_CASE_RESULTS_MISMATCH');
        result = { tests: returned.tests, receipt, requiresManualReview: returned.requiresManualReview === true };
        if (coverage) {
          if (!returned.coverage) throw coded('TEST_COVERAGE_REPORT_MISSING');
          result.coverage = normalizeCreatorCoverage(plan.projectRoot, returned.coverage,
            { kind: 'creator-provider', maxBytes: MAX_PROVIDER_COVERAGE_BYTES, errorPrefix: 'TEST_PROVIDER_COVERAGE' });
        }
      } else {
        if (typeof previewSessionId !== 'string' || !previewSessionId) throw coded('PREVIEW_SESSION_REQUIRED');
        if (refreshPreview && !previewRefreshed) {
          await call(instanceId, 'creator.preview.refresh', { previewSessionId });
          previewRefreshed = true;
        }
        if (suite.testCases) {
          const selectedIds = new Set(selectedCaseIdsBySuite[suite.id]);
          const tests = [];
          const receipts = [];
          const coverages = [];
          for (const testCase of suite.testCases.filter((item) => selectedIds.has(item.id))) {
            if (signal?.aborted) throw coded('TEST_CANCELLED');
            executionDispatched = true;
            const receipt = await call(instanceId, 'creator.preview.interact', {
              actions: testCase.actions, assertions: testCase.assertions,
              ...(testCase.settleMs === undefined ? {} : { settleMs: testCase.settleMs }),
              previewSessionId, ...(coverage ? { coverage: true } : {}),
            });
            const previewResult = receipt.result;
            if (!Array.isArray(previewResult?.assertions) || !previewResult.assertions.length)
              throw coded('TEST_PREVIEW_REPORT_INVALID');
            if (coverage && !previewResult.coverage) throw coded('TEST_COVERAGE_REPORT_MISSING');
            const passed = previewResult.passed === true;
            const failedAssertions = previewResult.assertions.filter((item) => item.pass !== true);
            tests.push({ id: testCase.id, name: testCase.name || testCase.id,
              status: passed ? 'passed' : 'failed', durationMs: 0,
              message: passed ? '' : JSON.stringify(failedAssertions.length ? failedAssertions : previewResult.assertions).slice(0, 8192) });
            receipts.push({ caseId: testCase.id, previewSessionId: previewResult.previewSessionId,
              instanceId: previewResult.instanceId, projectRoot: previewResult.projectRoot,
              sceneUuid: previewResult.sceneUuid, navigationCount: previewResult.navigationCount,
              assertions: previewResult.assertions, passed });
            if (previewResult.coverage) coverages.push(previewResult.coverage);
          }
          if (tests.length !== selectedIds.size) throw coded('TEST_PREVIEW_CASE_RESULTS_MISMATCH');
          result = { tests, receipts };
          if (coverage) result.coverage = mergePreviewCoverageReports(coverages);
        } else {
          const receipt = await call(instanceId, 'creator.preview.interact', { ...suite.input, previewSessionId,
            ...(coverage ? { coverage: true } : {}) });
          const assertions = receipt.result?.assertions;
          if (!Array.isArray(assertions) || !assertions.length) throw coded('TEST_PREVIEW_REPORT_INVALID');
          if (coverage && !receipt.result?.coverage) throw coded('TEST_COVERAGE_REPORT_MISSING');
          result = { tests: assertions.map((item, index) => ({ name: `assertion-${index + 1}:${item.type || 'preview'}`,
            status: item.pass === true ? 'passed' : 'failed', message: JSON.stringify(item).slice(0, 8192) })), receipt };
          if (receipt.result.coverage) result.coverage = receipt.result.coverage;
          if (receipt.result?.passed !== true && !result.tests.some((item) => item.status === 'failed'))
            result.tests.push({ name: 'preview-result', status: 'failed', message: 'Preview did not confirm success.' });
        }
      }
      result.tests = normalizeTests(result.tests);
      if (!result.tests.some((item) => item.status !== 'skipped') && !normalizedShard) throw coded('TEST_NO_EXECUTED_CASES');
      if (result.requiresManualReview && !result.tests.some((item) => item.status === 'failed'))
        throw coded('TEST_REQUIRES_MANUAL_REVIEW');
    } catch (error) {
      result = { ...result, tests: [{ id: 'runner-error', name: suite.id, status: 'failed', durationMs: 0,
        message: error.code || error.message || String(error) }], error: error.code || error.message || String(error),
      requiresManualReview: executionDispatched };
    }
    const output = { id: suite.id, adapter: suite.adapter, ...result,
      durationMs: Date.now() - suiteStart, counts: counts(result.tests) };
    report.suites.push(output);
    onEvent({ type: 'test-suite-finished', runId: report.runId, suiteId: suite.id, counts: output.counts });
    // Creator calls cannot be safely cancelled/retried after interruption.
    if (output.requiresManualReview || signal?.aborted) break;
  }
  report.cancelled = signal?.aborted === true;
  report.notRunSuiteIds = runnable.filter((suite) => !report.suites.some((item) => item.id === suite.id)).map((suite) => suite.id);
  for (const suiteId of report.shardSkippedSuiteIds)
    onEvent({ type: 'test-suite-skipped', runId: report.runId, suiteId, reason: 'TEST_SHARD_EXCLUDED' });
  if (report.cancelled && !report.suites.some((suite) => suite.tests.some((item) => item.status === 'failed'))) {
    const tests = [{ id: 'cancelled', name: 'TEST_CANCELLED', status: 'failed', durationMs: 0, message: 'Run cancelled before completion.' }];
    report.suites.push({ id: '$runner', adapter: 'runner', tests, counts: counts(tests), durationMs: 0 });
  }
  report.counts = counts(report.suites.flatMap((suite) => suite.tests));
  report.emptyShard = Boolean(normalizedShard && report.counts.total === 0);
  report.requiresManualReview = report.suites.some((suite) => suite.requiresManualReview);
  report.passed = !report.cancelled && !report.requiresManualReview && report.counts.failed === 0
    && (report.counts.passed > 0 || report.emptyShard) && report.notRunSuiteIds.length === 0;
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
