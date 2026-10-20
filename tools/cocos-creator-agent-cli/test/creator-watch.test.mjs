import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { startProjectFileWatch } from '../creator-watch.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function projectFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-preview-watch-'));
  const assets = path.join(root, 'assets', 'scripts');
  fs.mkdirSync(assets, { recursive: true });
  const source = path.join(assets, 'Player.ts');
  fs.writeFileSync(source, 'export default 1;\n');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, source };
}

test('preview watch detects exact project file changes and stops cleanly', async (t) => {
  const { root, source } = projectFixture(t);
  const changes = [];
  const watcher = startProjectFileWatch({ projectRoot: root, paths: ['assets/scripts/Player.ts'],
    intervalMs: 250, debounceMs: 100, onChange: async (paths) => changes.push(paths) });
  fs.writeFileSync(source, 'export default 2;\n');
  const deadline = Date.now() + 4000;
  while (!changes.length && Date.now() < deadline) await sleep(50);
  watcher.stop();
  const result = await watcher.done;
  assert.deepEqual(changes, [['assets/scripts/Player.ts']]);
  assert.equal(result.stopped, true);
  assert.equal(result.projectRoot, fs.realpathSync(root));
});

test('preview watch rejects paths outside the project and symbolic links', (t) => {
  const { root, source } = projectFixture(t);
  const outside = path.join(os.tmpdir(), `cocos-outside-${process.pid}.ts`);
  fs.writeFileSync(outside, 'outside');
  t.after(() => fs.rmSync(outside, { force: true }));
  assert.throws(() => startProjectFileWatch({ projectRoot: root, paths: [outside], onChange() {} }),
    (error) => error.code === 'WATCH_PATH_INVALID');
  assert.throws(() => startProjectFileWatch({ projectRoot: root, paths: ['../outside.ts'], onChange() {} }),
    (error) => error.code === 'WATCH_PATH_OUTSIDE_PROJECT');
  const link = path.join(path.dirname(source), 'Linked.ts');
  fs.symlinkSync(outside, link);
  assert.throws(() => startProjectFileWatch({ projectRoot: root, paths: ['assets/scripts/Linked.ts'], onChange() {} }),
    (error) => error.code === 'WATCH_PATH_UNSAFE');
});

test('preview watch enforces file count, interval, and byte bounds', (t) => {
  const { root } = projectFixture(t);
  assert.throws(() => startProjectFileWatch({ projectRoot: root,
    paths: Array.from({ length: 33 }, (_, index) => `assets/scripts/${index}.ts`), onChange() {} }),
  (error) => error.code === 'WATCH_PATHS_INVALID');
  assert.throws(() => startProjectFileWatch({ projectRoot: root, paths: ['assets/scripts/Player.ts'], intervalMs: 100, onChange() {} }),
    (error) => error.code === 'WATCH_INTERVAL_INVALID');
  const large = path.join(root, 'assets/scripts/Large.ts');
  fs.writeFileSync(large, Buffer.alloc(8 * 1024 * 1024 + 1));
  assert.throws(() => startProjectFileWatch({ projectRoot: root, paths: ['assets/scripts/Large.ts'], onChange() {} }),
    (error) => error.code === 'WATCH_FILE_TOO_LARGE');
});
