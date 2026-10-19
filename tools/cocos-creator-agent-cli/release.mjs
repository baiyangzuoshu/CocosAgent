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

async function fetchResponse(url, headers = {}) {
  const response = await fetch(url, { headers: { 'user-agent': 'cocos-creator-agent-cli', ...headers },
    redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`CLI_RELEASE_HTTP_${response.status}`);
  return response;
}

async function getRelease(packageInfo, requestedVersion) {
  const repository = githubRepository(packageInfo);
  if (requestedVersion) {
    const version = requestedVersion.replace(/^v/, '');
    parseVersion(version);
    const response = await fetchResponse(`${API_ROOT}/repos/${repository}/releases/tags/${encodeURIComponent(`${TAG_PREFIX}${version}`)}`, {
      accept: 'application/vnd.github+json',
    });
    return response.json();
  }
  const response = await fetchResponse(`${API_ROOT}/repos/${repository}/releases?per_page=100`, {
    accept: 'application/vnd.github+json',
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

async function downloadAsset(asset, destination) {
  if (!asset || typeof asset.browser_download_url !== 'string') throw new Error('CLI_RELEASE_ASSET_MISSING');
  trustedReleaseAsset(asset.browser_download_url);
  const response = await fetchResponse(asset.browser_download_url, { accept: 'application/octet-stream' });
  trustedReleaseAsset(response.url);
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

export async function updateCli(packageInfo, { checkOnly = false, version: requestedVersion } = {}) {
  const currentVersion = packageInfo.version;
  const release = await getRelease(packageInfo, requestedVersion);
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
    const archive = await downloadAsset(archiveAsset, archivePath);
    const checksumBytes = await downloadAsset(checksumAsset, checksumPath);
    const expectedChecksum = checksumBytes.toString('utf8').trim().split(/\s+/)[0].toLowerCase();
    const actualChecksum = createHash('sha256').update(archive).digest('hex');
    if (!/^[a-f0-9]{64}$/.test(expectedChecksum) || actualChecksum !== expectedChecksum) throw new Error('CLI_RELEASE_CHECKSUM_MISMATCH');

    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['install', '--global', '--ignore-scripts', '--no-audit', '--no-fund', archivePath], {
      encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, shell: process.platform === 'win32',
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
