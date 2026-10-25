import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function writeExtension(root, version, source) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'cocos-creator-agent-extension', version,
    'cocos-creator-agent': { creatorVersion: '2.4.15' },
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'main.js'), source);
}

test('extension lifecycle installs, updates, protects drift, backs up forced replacement, and uninstalls', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-extension-lifecycle-'));
  const originalHome = os.homedir;
  os.homedir = () => path.join(tempRoot, 'home');
  t.after(() => {
    os.homedir = originalHome;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const lifecycle = await import(`../extension-lifecycle.mjs?fixture=${encodeURIComponent(tempRoot)}`);
  const projectRoot = path.join(tempRoot, 'project');
  const oldSource = path.join(tempRoot, 'source-0.6.2');
  const newSource = path.join(tempRoot, 'source-0.7.0');
  fs.mkdirSync(path.join(projectRoot, 'packages'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'fixture' }));
  writeExtension(oldSource, '0.6.2', 'module.exports = "old";\n');
  writeExtension(newSource, '0.7.0', 'module.exports = "new";\n');

  const installed = lifecycle.installExtension(projectRoot, oldSource, '0.10.6');
  assert.equal(installed.extensionVersion, '0.6.2');
  const oldStatus = lifecycle.extensionStatus(projectRoot, oldSource);
  assert.equal(oldStatus.managed, true);
  assert.equal(oldStatus.changedFiles.length, 0);

  const upgraded = lifecycle.updateExtension(projectRoot, newSource, '0.11.0');
  assert.equal(upgraded.previousVersion, '0.6.2');
  assert.equal(upgraded.extensionVersion, '0.7.0');
  const extensionPath = path.join(projectRoot, 'packages', 'cocos-creator-agent-extension');
  fs.appendFileSync(path.join(extensionPath, 'main.js'), '// local drift\n');
  const drifted = lifecycle.extensionStatus(projectRoot, newSource);
  assert.deepEqual(drifted.changedFiles, ['main.js']);
  assert.throws(() => lifecycle.updateExtension(projectRoot, newSource, '0.11.0'), /EXTENSION_LOCAL_CHANGES/);

  const forced = lifecycle.updateExtension(projectRoot, newSource, '0.11.0', { force: true });
  assert.equal(forced.updated, true);
  assert.ok(forced.backupPath.startsWith(path.join(tempRoot, 'home', '.cocos-creator-agent', 'extension-backups')));
  assert.match(fs.readFileSync(path.join(forced.backupPath, 'main.js'), 'utf8'), /local drift/);
  const clean = lifecycle.extensionStatus(projectRoot, newSource);
  assert.equal(clean.extensionVersion, '0.7.0');
  assert.equal(clean.changedFiles.length, 0);

  const removed = lifecycle.uninstallExtension(projectRoot, newSource);
  assert.equal(removed.uninstalled, true);
  assert.equal(lifecycle.extensionStatus(projectRoot, newSource).installed, false);
});
