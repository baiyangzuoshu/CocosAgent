import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronRoot = path.resolve(
  process.env.DENOA_ELECTRON_ROOT || path.join(appRoot, '../../DenoA/electron'),
);
const electronDist = path.join(electronRoot, 'node_modules/electron/dist');
const electronBinary =
  process.platform === 'darwin'
    ? path.join(electronDist, 'Electron.app/Contents/MacOS/Electron')
    : process.platform === 'win32'
      ? path.join(electronDist, 'electron.exe')
      : path.join(electronDist, 'electron');

const build = spawn(process.execPath, [path.join(appRoot, 'scripts/build.mjs')], {
  cwd: appRoot,
  stdio: 'inherit',
});
const buildCode = await new Promise((resolve) => build.once('close', resolve));
if (buildCode !== 0) process.exit(Number(buildCode || 1));

try {
  await access(electronBinary);
} catch {
  throw new Error('找不到 Electron 37 可执行文件：' + electronBinary + '。可设置 DENOA_ELECTRON_ROOT。');
}

const app = spawn(electronBinary, [appRoot], {
  cwd: appRoot,
  stdio: 'inherit',
  env: process.env,
});
app.once('error', (error) => {
  console.error('Electron 启动失败：' + error.message);
  process.exitCode = 1;
});
app.once('close', (code, signal) => {
  if (code === null) {
    console.error('Electron 进程被信号终止：' + signal);
    process.exitCode = 1;
  } else {
    process.exitCode = Number(code);
  }
});
