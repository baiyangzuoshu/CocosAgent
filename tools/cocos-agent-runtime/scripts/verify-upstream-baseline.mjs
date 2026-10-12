import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const commit = '0dcafa2ae053a1ddd6a72f265431104b08a5aa13';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const snapshotRoot = resolve(repoRoot, 'vendor/learn-claude-code', commit);
const manifestPath = resolve(snapshotRoot, 'SOURCE-MANIFEST.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (manifest.repository !== 'shareAI-lab/learn-claude-code' || manifest.commit !== commit) {
  throw new Error('UPSTREAM_MANIFEST_IDENTITY_MISMATCH');
}

for (const entry of manifest.files) {
  const bytes = await readFile(resolve(snapshotRoot, entry.path));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const gitBlobSha1 = createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest('hex');
  if (sha256 !== entry.sha256 || gitBlobSha1 !== entry.git_blob_sha1) {
    throw new Error(`UPSTREAM_BASELINE_HASH_MISMATCH: ${entry.path}`);
  }
}

console.log(`Verified ${manifest.files.length} upstream files at ${commit}.`);
