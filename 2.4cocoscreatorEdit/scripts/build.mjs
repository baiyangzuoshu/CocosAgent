import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeSource = path.resolve(
  process.env.COCOS_WEB_RUNTIME_SOURCE || path.join(appRoot, '../2.4NewProject/build/web-mobile'),
);
const publicRoot = path.join(appRoot, 'public');
const runtimeTarget = path.join(publicRoot, 'runtime');

let rootFiles;
let sourceFiles;
try {
  rootFiles = await readdir(runtimeSource);
  sourceFiles = await readdir(path.join(runtimeSource, 'src'));
} catch {
  throw new Error(
    '找不到 Creator 2.4.15 Web 构建目录：' +
      runtimeSource +
      '。请先构建 2.4NewProject 的 Web 手机端，或设置 COCOS_WEB_RUNTIME_SOURCE。',
  );
}
if (
  !rootFiles.includes('index.html') ||
  !rootFiles.some((name) => /^main.*\.js$/.test(name)) ||
  !rootFiles.some((name) => /^cocos2d-js.*\.js$/.test(name)) ||
  !sourceFiles.some((name) => /^settings.*\.js$/.test(name))
) {
  throw new Error('该目录不是 Creator 2.4.15 Web Mobile 构建输出：' + runtimeSource);
}

await rm(publicRoot, { recursive: true, force: true });
await mkdir(publicRoot, { recursive: true });
await cp(path.join(appRoot, 'src/renderer'), publicRoot, { recursive: true });
await cp(runtimeSource, runtimeTarget, {
  recursive: true,
  filter(source) {
    const base = path.basename(source);
    return base !== '.DS_Store' && base !== '.runtime-bridge';
  },
});

await cp(
  path.join(appRoot, 'src/runtime/creator-lite-bridge.js'),
  path.join(runtimeTarget, 'creator-lite-bridge.js'),
);

const runtimeIndexPath = path.join(runtimeTarget, 'index.html');
let runtimeIndex = await readFile(runtimeIndexPath, 'utf8');
runtimeIndex = runtimeIndex.replace(/<title>[\s\S]*?<\/title>/i, '<title>Cocos Creator Lite Runtime</title>');
if (!runtimeIndex.includes('creator-lite-bridge.js')) {
  runtimeIndex = runtimeIndex.replace(
    /<\/body>/i,
    '  <script src="creator-lite-bridge.js"></script>\n</body>',
  );
}
await writeFile(runtimeIndexPath, runtimeIndex);

await cp(
  path.join(appRoot, 'samples/Starter2D/scenes/main.scene.json'),
  path.join(publicRoot, 'sample.scene.json'),
);
await writeFile(
  path.join(publicRoot, 'runtime-manifest.json'),
  JSON.stringify(
    {
      creatorVersion: '2.4.15',
      source: path.relative(appRoot, runtimeSource),
      preparedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + '\n',
);

console.log('Prepared editor UI and Creator 2.4.15 Web runtime.');
console.log('Runtime source: ' + runtimeSource);
