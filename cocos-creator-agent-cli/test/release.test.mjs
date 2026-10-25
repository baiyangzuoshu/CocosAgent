import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { updateCli } from '../release.mjs';

const packageInfo = {
  name: 'cocos-creator-agent-cli',
  version: '0.10.6',
  repository: { url: 'https://github.com/baiyangzuoshu/CocosAgent.git' },
};
const tag = 'cocos-creator-agent-cli-v0.9.0';
const archiveName = `${tag}.tgz`;
const checksumName = `${archiveName}.sha256`;
const archiveBytes = Buffer.from('private release archive fixture');
const checksum = createHash('sha256').update(archiveBytes).digest('hex');
const assetUrl = (id) => `https://api.github.com/repos/baiyangzuoshu/CocosAgent/releases/assets/${id}`;

function release(archiveChecksum = `${checksum}  ${archiveName}\n`) {
  return {
    tag_name: tag,
    draft: false,
    prerelease: false,
    assets: [
      { name: archiveName, url: assetUrl(123), browser_download_url: `https://github.com/baiyangzuoshu/CocosAgent/releases/download/${tag}/${archiveName}` },
      { name: checksumName, url: assetUrl(124), browser_download_url: `https://github.com/baiyangzuoshu/CocosAgent/releases/download/${tag}/${checksumName}` },
    ],
    archiveChecksum,
  };
}

function mockDependencies(releaseData, { env = {}, onInstall = () => {}, tokenFromGh = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, headers: options.headers || {} });
    if (url.includes('/releases/tags/')) return Response.json(releaseData);
    if (url === assetUrl(123)) return new Response(archiveBytes);
    if (url === assetUrl(124)) return new Response(releaseData.archiveChecksum);
    throw new Error(`UNEXPECTED_RELEASE_URL:${url}`);
  };
  const spawnImpl = (command, args, options = {}) => {
    if (args[0] === 'auth' && args[1] === 'token') {
      assert.equal(command, process.platform === 'win32' ? 'gh.exe' : 'gh');
      assert.equal(options.env.GH_PROMPT, 'disabled');
      return { status: tokenFromGh ? 0 : 1, stdout: tokenFromGh || '', stderr: '' };
    }
    onInstall(command, args, options);
    return { status: 0, stdout: '', stderr: '' };
  };
  return { calls, fetchImpl, spawnImpl, env };
}

test('private release check authenticates to the GitHub API without exposing the token in its result', async () => {
  const dependencies = mockDependencies(release(), { env: { GH_TOKEN: 'fixture-secret-token' } });
  const result = await updateCli(packageInfo, { checkOnly: true, version: '0.9.0' }, dependencies);
  assert.deepEqual(result, { currentVersion: '0.10.6', latestVersion: '0.9.0', updateAvailable: false, releaseTag: tag });
  assert.equal(dependencies.calls.length, 1);
  assert.equal(dependencies.calls[0].headers.authorization, 'Bearer fixture-secret-token');
  assert.equal(JSON.stringify(result).includes('fixture-secret-token'), false);
});

test('authenticated rollback to 0.9.0 verifies private asset checksums before replacing the CLI', async () => {
  let installCount = 0;
  const dependencies = mockDependencies(release(), {
    env: { GITHUB_TOKEN: 'rollback-token' },
    onInstall(command, args, options) {
      installCount += 1;
      assert.equal(command, process.platform === 'win32' ? 'npm.cmd' : 'npm');
      assert.deepEqual(args.slice(0, 5), ['install', '--global', '--ignore-scripts', '--no-audit', '--no-fund']);
      assert.equal(fs.readFileSync(args.at(-1), 'utf8'), archiveBytes.toString('utf8'));
      assert.equal(options.env.GITHUB_TOKEN, undefined);
      assert.equal(options.env.GH_TOKEN, undefined);
    },
  });
  const result = await updateCli(packageInfo, { version: '0.9.0' }, dependencies);
  assert.deepEqual(result, { updated: true, previousVersion: '0.10.6', version: '0.9.0', releaseTag: tag });
  assert.equal(installCount, 1);
  assert.equal(dependencies.calls.length, 3);
  assert.ok(dependencies.calls.every((call) => call.headers.authorization === 'Bearer rollback-token'));
});

test('checksum mismatch refuses an install even for an authenticated private release', async () => {
  let installCount = 0;
  const dependencies = mockDependencies(release(`${'0'.repeat(64)}  ${archiveName}\n`), {
    env: { GH_TOKEN: 'bad-checksum-token' },
    onInstall() { installCount += 1; },
  });
  await assert.rejects(updateCli(packageInfo, { version: '0.9.0' }, dependencies), /CLI_RELEASE_CHECKSUM_MISMATCH/);
  assert.equal(installCount, 0);
});

test('GitHub CLI authentication is used only when environment tokens are absent', async () => {
  const dependencies = mockDependencies(release(), { env: {}, tokenFromGh: 'gh-auth-token' });
  const result = await updateCli(packageInfo, { checkOnly: true, version: '0.9.0' }, dependencies);
  assert.equal(result.latestVersion, '0.9.0');
  assert.equal(dependencies.calls[0].headers.authorization, 'Bearer gh-auth-token');
});
