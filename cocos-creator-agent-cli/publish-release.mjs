#!/usr/bin/env node

import fs from 'node:fs';
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

function run(command, args, { allowFailure = false, timeout = 15_000 } = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  if (result.error) fail('CLI_RELEASE_COMMAND_FAILED', `${command}: ${result.error.message}`);
  if (!allowFailure && result.status !== 0) {
    const reason = (result.stderr || result.stdout || '').trim();
    fail('CLI_RELEASE_COMMAND_FAILED', `${command} ${args.join(' ')}${reason ? `\n${reason}` : ''}`);
  }
  return { status: result.status, stdout: (result.stdout || '').trim(), stderr: (result.stderr || '').trim() };
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
    fail('CLI_RELEASE_SSH_AUTH_FAILED', output.trim() || `ssh exited with status ${result.status}`);
  }
  return output.match(/Hi ([^!\r\n]+)!/i)?.[1] || 'GitHub account';
}

function printHelp() {
  process.stdout.write('Usage: node cocos-creator-agent-cli/publish-release.mjs [--dry-run]\n');
  process.stdout.write('Preflights and pushes the current CLI package version tag through ssh.github.com:443.\n');
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
  const expectedRemote = `ssh://git@ssh.github.com:443/${repo}.git`;
  const currentRemote = run('git', ['remote', 'get-url', 'origin']).stdout;
  if (repositoryName(currentRemote) !== repo) {
    fail('CLI_RELEASE_ORIGIN_MISMATCH', `origin must point to the GitHub repository ${repo}.`);
  }

  if (run('git', ['status', '--porcelain']).stdout) {
    fail('CLI_RELEASE_WORKTREE_DIRTY', 'Commit or remove local changes before creating a release tag.');
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
  const mainRef = run('git', ['ls-remote', expectedRemote, 'refs/heads/main']).stdout;
  const remoteMain = mainRef.split(/\s+/)[0];
  if (!remoteMain) fail('CLI_RELEASE_REMOTE_MAIN_MISSING', 'Could not read refs/heads/main over SSH 443.');
  if (remoteMain !== head) fail('CLI_RELEASE_MAIN_NOT_PUSHED', `HEAD ${head} does not match origin/main ${remoteMain}; push the code commit before releasing.`);

  const remoteTag = run('git', ['ls-remote', expectedRemote, `refs/tags/${tag}`]).stdout;
  if (remoteTag) fail('CLI_RELEASE_TAG_EXISTS_REMOTE', `${tag} already exists on GitHub; inspect its Release and Actions run instead of overwriting it.`);

  const localTag = run('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`], { allowFailure: true });
  if (localTag.status === 0 && localTag.stdout !== head) {
    fail('CLI_RELEASE_TAG_POINTS_ELSEWHERE', `${tag} already points to ${localTag.stdout}, not HEAD ${head}.`);
  }

  if (dryRun) {
    process.stdout.write(`Preflight passed for ${tag} at ${head}.\n`);
    process.stdout.write(`GitHub account: ${account}\n`);
    process.stdout.write(`Would set origin to ${expectedRemote}\n`);
    process.stdout.write(`${localTag.status === 0 ? 'Would push existing local tag' : 'Would create and push annotated tag'} ${tag}.\n`);
    process.stdout.write('No Git configuration, tag, or remote ref was changed.\n');
  } else {
    if (currentRemote !== expectedRemote) {
      run('git', ['remote', 'set-url', 'origin', expectedRemote]);
      process.stdout.write(`Set this repository’s origin to ${expectedRemote}\n`);
    }
    if (localTag.status !== 0) run('git', ['tag', '-a', tag, '-m', `发布 Cocos Creator Agent CLI ${version}`]);
    run('git', ['push', 'origin', `refs/tags/${tag}`]);
    process.stdout.write(`Pushed ${tag} from ${head} via SSH 443.\n`);
    process.stdout.write(`GitHub Actions will build and publish: https://github.com/${repo}/actions/workflows/release-cocos-creator-agent-cli.yml\n`);
  }
} catch (error) {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
}
