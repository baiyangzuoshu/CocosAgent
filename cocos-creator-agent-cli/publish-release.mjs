#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cliRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(cliRoot, '..');
const packageInfo = JSON.parse(fs.readFileSync(path.join(cliRoot, 'package.json'), 'utf8'));
const tagPrefix = 'cocos-creator-agent-cli-v';
const dryRun = process.argv.includes('--dry-run');
const help = process.argv.includes('--help') || process.argv.includes('-h');

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

function tail(value, maxLength = 8_000) {
  const text = String(value || '').trim();
  return text.length > maxLength ? text.slice(-maxLength) : text;
}

function run(command, args, {
  allowFailure = false,
  cwd = repoRoot,
  timeout = 15_000,
  env = {},
} = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...env },
  });
  if (result.error) fail('CLI_RELEASE_COMMAND_FAILED', `${command}: ${result.error.message}`);
  const output = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
  if (!allowFailure && result.status !== 0) {
    fail('CLI_RELEASE_COMMAND_FAILED', `${command} ${args.join(' ')}${output ? `\n${tail(output)}` : ''}`);
  }
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function repositoryName(value) {
  const source = String(value || '').trim();
  const normalized = source.startsWith('git@github.com:')
    ? `ssh://git@github.com/${source.slice('git@github.com:'.length)}`
    : source;
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }
  if (!['github.com', 'ssh.github.com'].includes(parsed.hostname.toLowerCase())) return null;
  return parsed.pathname.replace(/^\//, '').replace(/\.git$/i, '').replace(/\/$/, '').toLowerCase();
}

function sshConnection() {
  const result = run('ssh', [
    '-T', '-p', '443',
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ConnectTimeout=5',
    'git@ssh.github.com',
  ], { allowFailure: true, timeout: 10_000 });
  const output = `${result.stdout}\n${result.stderr}`;
  if (output.includes('Host key verification failed') || /No .* host key is known/.test(output)) {
    fail('CLI_RELEASE_GITHUB_HOST_KEY_MISSING', 'Verify GitHub’s SSH fingerprint, then add the trusted [ssh.github.com]:443 host key before publishing. See https://docs.github.com/en/authentication/troubleshooting-ssh/using-ssh-over-the-https-port');
  }
  if (!/Hi [^!\r\n]+! You.ve successfully authenticated/.test(output)) {
    fail('CLI_RELEASE_SSH_AUTH_FAILED', tail(output) || `ssh exited with status ${result.status}`);
  }
  return output.match(/Hi ([^!\r\n]+)!/i)?.[1] || 'GitHub account';
}

function readRemoteRefs(remote, tag) {
  const result = run('git', [
    'ls-remote', remote,
    'refs/heads/main',
    `refs/tags/${tag}`,
    `refs/tags/${tag}^{}`,
  ]);
  return new Map(result.stdout.split('\n').filter(Boolean).map((line) => {
    const [sha, ref] = line.split(/\s+/);
    return [ref, sha];
  }));
}

function checkGithubCliAuth() {
  const result = run('gh', ['auth', 'status', '--hostname', 'github.com'], { allowFailure: true, timeout: 15_000 });
  if (result.status !== 0) {
    fail('CLI_RELEASE_GITHUB_CLI_AUTH_REQUIRED', 'Authenticate GitHub CLI with `gh auth login --hostname github.com` and ensure the account can create releases in this repository.');
  }
}

function buildReleaseAssets(tempRoot, version) {
  const test = run('npm', ['test'], { cwd: cliRoot, timeout: 10 * 60_000 });
  const testSummary = test.stdout.split('\n').filter((line) => /^# (tests|pass|fail|duration_ms) /.test(line));
  if (testSummary.length) process.stdout.write(`CLI test suite passed: ${testSummary.join(', ')}\n`);
  else process.stdout.write('CLI test suite passed.\n');

  const cache = path.join(tempRoot, 'npm-cache');
  const pack = run('npm', ['--cache', cache, 'pack', '--pack-destination', tempRoot, '--json'], {
    cwd: cliRoot,
    timeout: 2 * 60_000,
  });
  let packed;
  try {
    [packed] = JSON.parse(pack.stdout);
  } catch {
    fail('CLI_RELEASE_PACK_INVALID', `npm pack did not return valid package metadata.\n${tail(pack.stdout)}\n${tail(pack.stderr)}`);
  }
  if (!packed || packed.name !== packageInfo.name || packed.version !== version) {
    fail('CLI_RELEASE_PACK_VERSION_MISMATCH', `Expected ${packageInfo.name}@${version}; npm packed ${packed?.name || '(missing)'}@${packed?.version || '(missing)'}.`);
  }
  if (packed.files.some((file) => file.path === 'publish-release.mjs')) {
    fail('CLI_RELEASE_PACK_INCLUDES_MAINTAINER_SCRIPT', 'publish-release.mjs must remain excluded from the CLI package.');
  }

  const sourceArchive = path.join(tempRoot, packed.filename);
  const archiveName = `${packageInfo.name}-v${version}.tgz`;
  const archive = path.join(tempRoot, archiveName);
  if (sourceArchive !== archive) fs.renameSync(sourceArchive, archive);
  const bytes = fs.readFileSync(archive);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const checksum = `${archive}.sha256`;
  fs.writeFileSync(checksum, `${sha256}\n`);

  return {
    archive,
    archiveName,
    checksum,
    checksumName: path.basename(checksum),
    size: bytes.length,
    sha256,
  };
}

function releaseForTag(repo, tag) {
  const result = run('gh', ['release', 'view', tag, '--repo', repo, '--json', 'assets,url'], {
    allowFailure: true,
    timeout: 30_000,
  });
  if (result.status === 0) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      fail('CLI_RELEASE_GITHUB_RESPONSE_INVALID', 'GitHub CLI returned invalid release metadata.');
    }
  }
  if (/release not found|http 404|not found/i.test(`${result.stdout}\n${result.stderr}`)) return null;
  fail('CLI_RELEASE_GITHUB_LOOKUP_FAILED', tail(`${result.stderr}\n${result.stdout}`));
}

function verifyExistingRelease(repo, tag, release, assets, tempRoot) {
  const byName = new Map((release.assets || []).map((asset) => [asset.name, asset]));
  const archiveAsset = byName.get(assets.archiveName);
  const checksumAsset = byName.get(assets.checksumName);
  if (!archiveAsset || !checksumAsset || archiveAsset.size !== assets.size || checksumAsset.size !== 65) return false;

  const downloadDir = path.join(tempRoot, 'existing-release');
  fs.mkdirSync(downloadDir, { recursive: true });
  const download = run('gh', [
    'release', 'download', tag,
    '--repo', repo,
    '--dir', downloadDir,
    '--pattern', assets.archiveName,
    '--pattern', assets.checksumName,
  ], { allowFailure: true, timeout: 60_000 });
  if (download.status !== 0) return false;

  const downloadedArchive = fs.readFileSync(path.join(downloadDir, assets.archiveName));
  const expectedArchive = fs.readFileSync(assets.archive);
  const downloadedChecksum = fs.readFileSync(path.join(downloadDir, assets.checksumName), 'utf8').trim();
  return downloadedArchive.equals(expectedArchive) && downloadedChecksum === assets.sha256;
}

function printHelp() {
  process.stdout.write('Usage: node cocos-creator-agent-cli/publish-release.mjs [--dry-run]\n');
  process.stdout.write('Runs tests, packages the CLI, computes SHA-256, pushes the version tag via SSH 443, and creates the GitHub Release with gh.\n');
}

try {
  if (help) {
    printHelp();
    process.exit(0);
  }
  if (process.argv.slice(2).some((arg) => !['--dry-run'].includes(arg))) {
    printHelp();
    fail('CLI_RELEASE_ARGUMENT_INVALID', 'Only --dry-run is supported.');
  }

  const repo = repositoryName(packageInfo.repository?.url);
  if (!repo) fail('CLI_RELEASE_REPOSITORY_INVALID', 'The CLI package must declare its GitHub repository URL.');
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(packageInfo.name || '')) {
    fail('CLI_RELEASE_PACKAGE_NAME_INVALID', `Invalid package name: ${packageInfo.name || '(empty)'}`);
  }
  const expectedRemote = `ssh://git@ssh.github.com:443/${repo}.git`;
  const currentRemote = run('git', ['remote', 'get-url', 'origin']).stdout;
  if (repositoryName(currentRemote) !== repo) {
    fail('CLI_RELEASE_ORIGIN_MISMATCH', `origin must point to the GitHub repository ${repo}.`);
  }
  if (run('git', ['status', '--porcelain']).stdout) {
    fail('CLI_RELEASE_WORKTREE_DIRTY', 'Commit or remove local changes before creating a release.');
  }
  const branch = run('git', ['branch', '--show-current']).stdout;
  if (branch !== 'main') fail('CLI_RELEASE_BRANCH_INVALID', `Switch to main before publishing; current branch is ${branch || '(detached)'}.`);

  const version = String(packageInfo.version || '');
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    fail('CLI_RELEASE_VERSION_INVALID', `Invalid package version: ${version || '(empty)'}`);
  }
  const tag = `${tagPrefix}${version}`;
  const head = run('git', ['rev-parse', 'HEAD']).stdout;
  const account = sshConnection();
  const remoteRefs = readRemoteRefs(expectedRemote, tag);
  const remoteMain = remoteRefs.get('refs/heads/main');
  if (!remoteMain) fail('CLI_RELEASE_REMOTE_MAIN_MISSING', 'Could not read refs/heads/main over SSH 443.');
  if (remoteMain !== head) fail('CLI_RELEASE_MAIN_NOT_PUSHED', `HEAD ${head} does not match origin/main ${remoteMain}; push the code commit before releasing.`);

  const remoteTagRef = remoteRefs.get(`refs/tags/${tag}`);
  const remoteTagCommit = remoteRefs.get(`refs/tags/${tag}^{}`) || remoteTagRef;
  if (remoteTagRef && remoteTagCommit !== head) {
    fail('CLI_RELEASE_TAG_POINTS_ELSEWHERE', `${tag} resolves to ${remoteTagCommit}, not HEAD ${head}.`);
  }
  const localTag = run('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`], { allowFailure: true });
  if (localTag.status === 0 && localTag.stdout !== head) {
    fail('CLI_RELEASE_TAG_POINTS_ELSEWHERE', `${tag} already points to ${localTag.stdout}, not HEAD ${head}.`);
  }
  checkGithubCliAuth();

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-cli-release-'));
  try {
    const assets = buildReleaseAssets(tempRoot, version);
    const release = releaseForTag(repo, tag);
    if (release) {
      if (!remoteTagRef) fail('CLI_RELEASE_TAG_MISSING_FOR_RELEASE', `${tag} has a GitHub Release but no remote Git tag.`);
      if (!verifyExistingRelease(repo, tag, release, assets, tempRoot)) {
        fail('CLI_RELEASE_ASSETS_MISMATCH', `${tag} already has a Release with assets that do not exactly match the current local package; inspect it before changing anything.`);
      }
      process.stdout.write(`Release already exists and its downloaded assets match ${packageInfo.name}@${version}.\n`);
      process.stdout.write(`${release.url}\n`);
    } else if (dryRun) {
      process.stdout.write(`Preflight passed for ${tag} at ${head}.\n`);
      process.stdout.write(`GitHub account: ${account}\n`);
      process.stdout.write(`Built ${assets.archiveName} (${assets.size} bytes), SHA-256 ${assets.sha256}.\n`);
      process.stdout.write(`${remoteTagRef ? 'Remote tag already exists at HEAD; would create the missing GitHub Release.' : 'Would create/push the annotated tag, then create the GitHub Release.'}\n`);
      process.stdout.write('No Git configuration, tag, remote ref, or Release was changed.\n');
    } else {
      if (currentRemote !== expectedRemote) {
        run('git', ['remote', 'set-url', 'origin', expectedRemote]);
        process.stdout.write(`Set this repository’s origin to ${expectedRemote}\n`);
      }
      if (!remoteTagRef) {
        if (localTag.status !== 0) run('git', ['tag', '-a', tag, '-m', `发布 Cocos Creator Agent CLI ${version}`]);
        run('git', ['push', 'origin', `refs/tags/${tag}`], { timeout: 60_000 });
        process.stdout.write(`Pushed ${tag} from ${head} via SSH 443.\n`);
      }
      const created = run('gh', [
        'release', 'create', tag,
        assets.archive,
        assets.checksum,
        '--repo', repo,
        '--title', `Cocos Creator Agent CLI v${version}`,
        '--generate-notes',
        '--verify-tag',
      ], { timeout: 2 * 60_000 });
      process.stdout.write(`Published ${packageInfo.name}@${version}: ${created.stdout}\n`);
      process.stdout.write(`SHA-256 ${assets.sha256}\n`);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
} catch (error) {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
}
