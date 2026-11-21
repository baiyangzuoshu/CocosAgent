import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronRoot = path.resolve(
  process.env.DENOA_ELECTRON_ROOT || path.join(appRoot, '../../DenoA/electron'),
);
const builderCli = path.join(electronRoot, 'node_modules/electron-builder/out/cli/cli.js');
const target = process.argv[2];
if (!['mac', 'win'].includes(target)) {
  throw new Error('用法：node scripts/package.mjs mac|win');
}

const build = spawn(process.execPath, [path.join(appRoot, 'scripts/build.mjs')], {
  cwd: appRoot,
  stdio: 'inherit',
});
const buildCode = await new Promise((resolve) => build.once('close', resolve));
if (buildCode !== 0) process.exit(Number(buildCode || 1));

try {
  await access(builderCli);
} catch {
  throw new Error('找不到 electron-builder：' + builderCli + '。可设置 DENOA_ELECTRON_ROOT。');
}

const args = [builderCli, '--projectDir', appRoot, '--config', path.join(appRoot, 'electron-builder.config.cjs')];
if (target === 'mac') args.push('--mac', '--arm64', '--dir', '--publish=never');
if (target === 'win') args.push('--win', 'portable', '--x64', '--publish=never');

const packagerEnv = { ...process.env };
if (target === 'mac') {
  packagerEnv.COCOS_LITE_ELECTRON_DIST = path.join(electronRoot, 'node_modules/electron/dist');
} else if (process.env.COCOS_LITE_WINDOWS_ELECTRON_DIST) {
  packagerEnv.COCOS_LITE_ELECTRON_DIST = process.env.COCOS_LITE_WINDOWS_ELECTRON_DIST;
} else {
  delete packagerEnv.COCOS_LITE_ELECTRON_DIST;
}

const packager = spawn(process.execPath, args, {
  cwd: appRoot,
  stdio: 'inherit',
  env: packagerEnv,
});
const packageCode = await new Promise((resolve) => packager.once('close', resolve));
process.exitCode = Number(packageCode || 0);
