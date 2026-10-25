import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const TAG_PREFIX = 'cocos-creator-agent-cli-v';
const API_ROOT = 'https://api.github.com';

function githubRepository(packageInfo) {
  const repository = typeof packageInfo.repository === 'string' ? packageInfo.repository : packageInfo.repository?.url;
  if (typeof repository !== 'string') throw new Error('CLI_RELEASE_REPOSITORY_MISSING');
  const match = repository.match(/github\.com[:/]([^/]+\/[^/#.]+)(?:\.git)?(?:[#?].*)?$/i);
  if (!match) throw new Error('CLI_RELEASE_REPOSITORY_INVALID');
  return match[1];
}

function parseVersion(value) {
  const match = String(value).replace(/^v/, '').match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) throw new Error(`CLI_VERSION_INVALID:${value}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ? match[4].split('.') : null };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (const field of ['major', 'minor', 'patch']) if (a[field] !== b[field]) return a[field] < b[field] ? -1 : 1;
  if (!a.prerelease && !b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (a.prerelease[index] === undefined) return -1;
    if (b.prerelease[index] === undefined) return 1;
    if (a.prerelease[index] === b.prerelease[index]) continue;
    const leftNumeric = /^\d+$/.test(a.prerelease[index]);
    const rightNumeric = /^\d+$/.test(b.prerelease[index]);
    if (leftNumeric && rightNumeric) return Number(a.prerelease[index]) < Number(b.prerelease[index]) ? -1 : 1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return a.prerelease[index] < b.prerelease[index] ? -1 : 1;
  }
  return 0;
}

async function fetchResponse(url, { githubToken, fetchImpl = fetch, ...headers } = {}) {
  const requestHeaders = { 'user-agent': 'cocos-creator-agent-cli', ...headers };
  if (githubToken && new URL(url).hostname === 'api.github.com') requestHeaders.authorization = `Bearer ${githubToken}`;
  const response = await fetchImpl(url, { headers: requestHeaders,
    redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`CLI_RELEASE_HTTP_${response.status}`);
  return response;
}

function getGitHubToken(env, spawnImpl) {
  for (const name of ['GH_TOKEN', 'GITHUB_TOKEN']) {
    const token = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (token && token.length <= 8192 && !/[\r\n\0]/.test(token)) return token;
  }
  const result = spawnImpl(process.platform === 'win32' ? 'gh.exe' : 'gh', ['auth', 'token', '--hostname', 'github.com'], {
    encoding: 'utf8', timeout: 5000, maxBuffer: 16 * 1024, windowsHide: true,
    env: { ...env, GH_PROMPT: 'disabled' },
  });
  const token = result.status === 0 && typeof result.stdout === 'string' ? result.stdout.trim() : '';
  return token && token.length <= 8192 && !/[\r\n\0]/.test(token) ? token : null;
}

function withoutGitHubTokens(env) {
  const sanitized = { ...env };
  delete sanitized.GH_TOKEN;
  delete sanitized.GITHUB_TOKEN;
  return sanitized;
}

async function getRelease(packageInfo, requestedVersion, dependencies) {
  const repository = githubRepository(packageInfo);
  if (requestedVersion) {
    const version = requestedVersion.replace(/^v/, '');
    parseVersion(version);
    const response = await fetchResponse(`${API_ROOT}/repos/${repository}/releases/tags/${encodeURIComponent(`${TAG_PREFIX}${version}`)}`, {
      accept: 'application/vnd.github+json', githubToken: dependencies.githubToken, fetchImpl: dependencies.fetchImpl,
    });
    return response.json();
  }
  const response = await fetchResponse(`${API_ROOT}/repos/${repository}/releases?per_page=100`, {
    accept: 'application/vnd.github+json', githubToken: dependencies.githubToken, fetchImpl: dependencies.fetchImpl,
  });
  const releases = await response.json();
  const candidates = releases.filter((release) => !release.draft && !release.prerelease && release.tag_name?.startsWith(TAG_PREFIX));
  candidates.sort((left, right) => compareVersions(right.tag_name.slice(TAG_PREFIX.length), left.tag_name.slice(TAG_PREFIX.length)));
  if (!candidates.length) throw new Error('CLI_RELEASE_NOT_FOUND');
  return candidates[0];
}

function trustedReleaseAsset(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(parsed.hostname)) {
    throw new Error('CLI_RELEASE_ASSET_HOST_REJECTED');
  }
}

function trustedReleaseApiAsset(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.github.com'
    || !/^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/releases\/assets\/[0-9]+$/.test(parsed.pathname)) {
    throw new Error('CLI_RELEASE_ASSET_HOST_REJECTED');
  }
}

async function downloadAsset(asset, destination, dependencies) {
  if (!asset || typeof asset.browser_download_url !== 'string') throw new Error('CLI_RELEASE_ASSET_MISSING');
  trustedReleaseAsset(asset.browser_download_url);
  const downloadUrl = dependencies.githubToken && typeof asset.url === 'string' ? asset.url : asset.browser_download_url;
  if (downloadUrl === asset.url) trustedReleaseApiAsset(downloadUrl);
  const response = await fetchResponse(downloadUrl, { accept: 'application/octet-stream',
    githubToken: dependencies.githubToken, fetchImpl: dependencies.fetchImpl });
  const resolvedUrl = response.url || downloadUrl;
  if (new URL(resolvedUrl).hostname === 'api.github.com') trustedReleaseApiAsset(resolvedUrl);
  else trustedReleaseAsset(resolvedUrl);
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 100 * 1024 * 1024) throw new Error('CLI_RELEASE_ASSET_SIZE_INVALID');
  const chunks = [];
  let byteLength = 0;
  for await (const chunk of response.body) {
    byteLength += chunk.length;
    if (byteLength > 100 * 1024 * 1024) throw new Error('CLI_RELEASE_ASSET_SIZE_INVALID');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (!bytes.length) throw new Error('CLI_RELEASE_ASSET_SIZE_INVALID');
  fs.writeFileSync(destination, bytes, { flag: 'wx', mode: 0o600 });
  return bytes;
}

export async function updateCli(packageInfo, { checkOnly = false, version: requestedVersion } = {}, {
  fetchImpl = fetch, spawnImpl = spawnSync, env = process.env,
} = {}) {
  const currentVersion = packageInfo.version;
  const githubToken = getGitHubToken(env, spawnImpl);
  const dependencies = { fetchImpl, githubToken, spawnImpl };
  const release = await getRelease(packageInfo, requestedVersion, dependencies);
  const version = release.tag_name?.startsWith(TAG_PREFIX) ? release.tag_name.slice(TAG_PREFIX.length) : '';
  parseVersion(version);
  const comparison = compareVersions(version, currentVersion);
  const updateAvailable = comparison > 0;
  if (checkOnly) return { currentVersion, latestVersion: version, updateAvailable, releaseTag: release.tag_name };
  if (!requestedVersion && !updateAvailable) return { updated: false, currentVersion, latestVersion: version, reason: 'ALREADY_CURRENT' };
  if (comparison === 0) return { updated: false, currentVersion, latestVersion: version, reason: 'ALREADY_CURRENT' };

  const assetName = `${TAG_PREFIX}${version}.tgz`;
  const checksumName = `${assetName}.sha256`;
  const archiveAsset = release.assets?.find((asset) => asset.name === assetName);
  const checksumAsset = release.assets?.find((asset) => asset.name === checksumName);
  if (!archiveAsset || !checksumAsset) throw new Error('CLI_RELEASE_ASSETS_INCOMPLETE');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-creator-agent-update-'));
  const archivePath = path.join(tempRoot, assetName);
  const checksumPath = path.join(tempRoot, checksumName);
  try {
    const archive = await downloadAsset(archiveAsset, archivePath, dependencies);
    const checksumBytes = await downloadAsset(checksumAsset, checksumPath, dependencies);
    const expectedChecksum = checksumBytes.toString('utf8').trim().split(/\s+/)[0].toLowerCase();
    const actualChecksum = createHash('sha256').update(archive).digest('hex');
    if (!/^[a-f0-9]{64}$/.test(expectedChecksum) || actualChecksum !== expectedChecksum) throw new Error('CLI_RELEASE_CHECKSUM_MISMATCH');

    const result = spawnImpl(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['install', '--global', '--ignore-scripts', '--no-audit', '--no-fund', archivePath], {
      encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, shell: process.platform === 'win32', env: withoutGitHubTokens(env),
    });
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw new Error(`CLI_GLOBAL_INSTALL_FAILED:${result.error.message}`);
    if (result.status !== 0) throw new Error(`CLI_GLOBAL_INSTALL_FAILED:${result.status ?? 'signal'}`);
    return { updated: true, previousVersion: currentVersion, version, releaseTag: release.tag_name };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
