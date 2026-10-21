import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(packageRoot, 'cli.mjs');

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd: packageRoot, encoding: 'utf8' });
}

test('CLI supports filtered subcommand help and command catalog search', () => {
  const subcommand = runCli(['project', '--help']);
  assert.equal(subcommand.status, 0);
  assert.match(subcommand.stdout, /project open/);
  assert.match(subcommand.stdout, /project search/);
  assert.doesNotMatch(subcommand.stdout, /creator build/);

  const search = runCli(['help', 'search', 'rename']);
  assert.equal(search.status, 0);
  assert.match(search.stdout, /creator\.scene\.node\.rename\.plan/);
  assert.match(search.stdout, /collision-free sibling name/);

  const textureSearch = runCli(['help', 'search', 'import-settings']);
  assert.equal(textureSearch.status, 0);
  assert.match(textureSearch.stdout, /creator\.asset\.import-settings\.plan/);
  assert.match(textureSearch.stdout, /creator\.asset\.import-settings\.reconcile/);
});

test('CLI emits a versioned JSON error envelope and usage exit code', () => {
  const result = runCli(['not-a-command', '--format', 'json']);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, '');
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.success, false);
  assert.equal(payload.exitCode, 2);
  assert.equal(payload.error.code, 'CLI_UNKNOWN_COMMAND');
  assert.equal(payload.error.kind, 'usage');
});

test('CLI rejects unsupported output formats as usage errors', () => {
  const result = runCli(['--format', 'yaml', '--json']);
  assert.equal(result.status, 2);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.error.code, 'CLI_USAGE_ERROR');
  assert.equal(payload.error.kind, 'usage');
});
