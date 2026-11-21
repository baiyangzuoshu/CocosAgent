import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { access, cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';

const appRoot = app.getAppPath();
const publicRoot = path.join(appRoot, 'public');
const sampleProjectPath = path.join(appRoot, 'samples/Starter2D/project.json');
const sampleScenePath = path.join(appRoot, 'samples/Starter2D/scenes/main.scene.json');
const webBuilds = new Map();
let activeProjectRoot = null;
let activeManifest = null;
let mainWindow = null;
let server = null;
let serverPort = 0;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function resolveInside(root, relativePath) {
  const rootPath = path.resolve(root);
  const candidate = path.resolve(rootPath, relativePath);
  const relative = path.relative(rootPath, candidate);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    return null;
  }
  return candidate;
}

async function serveFile(response, root, relativePath, method) {
  const filePath = resolveInside(root, relativePath || 'index.html');
  if (!filePath) {
    response.writeHead(403);
    response.end();
    return;
  }

  try {
    const fileStat = await stat(filePath);
    const finalPath = fileStat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const content = await readFile(finalPath);
    response.writeHead(200, {
      'content-type': mimeTypes[path.extname(finalPath).toLowerCase()] || 'application/octet-stream',
      'content-length': content.length,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    response.end(method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

function startLocalServer() {
  server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405);
      response.end();
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400);
      response.end();
      return;
    }

    const buildMatch = pathname.match(/^\/_webbuild\/([^/]+)\/?(.*)$/);
    if (buildMatch) {
      const outputRoot = webBuilds.get(buildMatch[1]);
      if (!outputRoot) {
        response.writeHead(404);
        response.end();
        return;
      }
      await serveFile(response, outputRoot, buildMatch[2] || 'index.html', request.method);
      return;
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    await serveFile(response, publicRoot, relativePath, request.method);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('本地服务启动失败'));
        return;
      }
      serverPort = address.port;
      resolve(address.port);
    });
  });
}

function validateScene(scene) {
  if (
    !scene ||
    scene.format !== 'cocos-creator-lite-scene' ||
    scene.schemaVersion !== 1 ||
    !Array.isArray(scene.nodes)
  ) {
    throw new Error('场景格式无效，只支持 cocos-creator-lite-scene schemaVersion 1。');
  }
  if (!scene.designResolution || !Number.isFinite(Number(scene.designResolution.width)) || !Number.isFinite(Number(scene.designResolution.height))) {
    throw new Error('场景设计分辨率无效。');
  }
  if (scene.nodes.length === 0 || scene.nodes.length > 1000) {
    throw new Error('场景节点数量必须在 1 到 1000 之间。');
  }

  const nodesById = new Map();
  for (const node of scene.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id || nodesById.has(node.id)) {
      throw new Error('节点 ID 缺失或重复。');
    }
    if (typeof node.name !== 'string' || !node.name) {
      throw new Error('每个节点都需要名称。');
    }
    const transform = node.transform || {};
    for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY']) {
      if (!Number.isFinite(Number(transform[key]))) {
        throw new Error('节点 ' + node.name + ' 的变换字段 ' + key + ' 无效。');
      }
    }
    if (!Array.isArray(node.components)) node.components = [];
    for (const component of node.components) {
      if (!component || !['Canvas', 'Label', 'Sprite'].includes(component.type)) {
        throw new Error('只支持 Canvas、Label 与 Sprite 组件。');
      }
    }
    nodesById.set(node.id, node);
  }

  const roots = scene.nodes.filter((node) => node.parentId === null);
  if (roots.length !== 1 || !roots[0].components.some((component) => component.type === 'Canvas')) {
    throw new Error('场景必须且只能有一个带 Canvas 组件的根节点。');
  }
  for (const node of scene.nodes) {
    if (node.parentId !== null && !nodesById.has(node.parentId)) {
      throw new Error('节点 ' + node.name + ' 引用了不存在的父节点。');
    }
  }
  return scene;
}

function safeProjectName(value) {
  const name = String(value || '').trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\.+$/g, '');
  if (!name || name === '.' || name === '..') throw new Error('请输入有效的项目名称。');
  return name.slice(0, 80);
}

function makeManifest(name) {
  return {
    format: 'cocos-creator-lite-project',
    schemaVersion: 1,
    name,
    engineVersion: '2.4.15',
    mainScene: 'scenes/main.scene.json',
  };
}

function ensureProjectPath(root, relativePath) {
  const target = resolveInside(root, relativePath);
  if (!target) throw new Error('项目主场景路径越界。');
  return target;
}

async function readProject(root) {
  const manifest = JSON.parse(await readFile(path.join(root, 'project.json'), 'utf8'));
  if (manifest.format !== 'cocos-creator-lite-project' || manifest.schemaVersion !== 1) {
    throw new Error('不支持此项目格式。');
  }
  const scenePath = ensureProjectPath(root, manifest.mainScene);
  const scene = validateScene(JSON.parse(await readFile(scenePath, 'utf8')));
  activeProjectRoot = root;
  activeManifest = manifest;
  return { projectPath: root, project: manifest, scene };
}

async function writeProjectScene(scene) {
  if (!activeProjectRoot || !activeManifest) throw new Error('请先新建或打开项目。');
  validateScene(scene);
  const scenePath = ensureProjectPath(activeProjectRoot, activeManifest.mainScene);
  await mkdir(path.dirname(scenePath), { recursive: true });
  await writeFile(scenePath, JSON.stringify(scene, null, 2) + '\n', 'utf8');
  await writeFile(
    path.join(activeProjectRoot, 'project.json'),
    JSON.stringify(activeManifest, null, 2) + '\n',
    'utf8',
  );
  return { projectPath: activeProjectRoot, project: activeManifest };
}

async function showOpenProjectDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Cocos Creator Lite 项目',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return readProject(result.filePaths[0]);
}

async function createProject(name, scene) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择项目保存位置',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const projectName = safeProjectName(name);
  const root = path.join(result.filePaths[0], projectName);
  try {
    await mkdir(root);
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      throw new Error('目标目录已存在，请换一个项目名称或选择其他位置。');
    }
    throw error;
  }

  const manifest = makeManifest(projectName);
  const checkedScene = validateScene(scene);
  const scenePath = ensureProjectPath(root, manifest.mainScene);
  await mkdir(path.dirname(scenePath), { recursive: true });
  await writeFile(path.join(root, 'project.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(scenePath, JSON.stringify(checkedScene, null, 2) + '\n', 'utf8');
  activeProjectRoot = root;
  activeManifest = manifest;
  return { projectPath: root, project: manifest, scene: checkedScene };
}

async function uniqueBuildPath(projectRoot) {
  const base = path.join(projectRoot, 'build/web-mobile');
  try {
    await access(base);
  } catch {
    return base;
  }
  const date = new Date();
  const stamp =
    String(date.getFullYear()) +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0') +
    '-' +
    String(date.getHours()).padStart(2, '0') +
    String(date.getMinutes()).padStart(2, '0') +
    String(date.getSeconds()).padStart(2, '0');
  let candidate = path.join(projectRoot, 'build/web-mobile-' + stamp);
  let suffix = 2;
  while (true) {
    try {
      await access(candidate);
      candidate = path.join(projectRoot, 'build/web-mobile-' + stamp + '-' + suffix++);
    } catch {
      return candidate;
    }
  }
}

async function createWebBuild(scene) {
  if (!activeProjectRoot) throw new Error('请先新建或打开项目。');
  await writeProjectScene(scene);

  const runtimeRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'runtime')
    : path.join(publicRoot, 'runtime');
  await access(path.join(runtimeRoot, 'creator-lite-bridge.js'));
  const outputRoot = await uniqueBuildPath(activeProjectRoot);
  await mkdir(path.dirname(outputRoot), { recursive: true });
  await cp(runtimeRoot, outputRoot, { recursive: true });
  await writeFile(path.join(outputRoot, 'scene.json'), JSON.stringify(scene, null, 2) + '\n', 'utf8');

  const indexPath = path.join(outputRoot, 'index.html');
  let indexHtml = await readFile(indexPath, 'utf8');
  indexHtml = indexHtml.replace(
    /<title>[\s\S]*?<\/title>/i,
    '<title>' + activeManifest.name.replace(/[<>&"]/g, '') + '</title>',
  );
  await writeFile(indexPath, indexHtml, 'utf8');

  const buildId = randomUUID();
  webBuilds.set(buildId, outputRoot);
  const preview = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    title: activeManifest.name + ' · Web 构建预览',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  preview.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  await preview.loadURL('http://127.0.0.1:' + serverPort + '/_webbuild/' + buildId + '/index.html');
  return { outputPath: outputRoot, previewUrl: preview.getURL() };
}

function registerIpc() {
  ipcMain.handle('project:open', () => showOpenProjectDialog());
  ipcMain.handle('project:new', (_event, name, scene) => createProject(name, scene));
  ipcMain.handle('project:save', (_event, scene) => writeProjectScene(scene));
  ipcMain.handle('project:build-web', (_event, scene) => createWebBuild(scene));
  ipcMain.handle('project:open-location', async () => {
    if (!activeProjectRoot) return false;
    await shell.openPath(activeProjectRoot);
    return true;
  });
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 960,
    minWidth: 1180,
    minHeight: 720,
    title: 'Cocos Creator Lite',
    backgroundColor: '#15191f',
    webPreferences: {
      preload: path.join(appRoot, 'src/preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  await mainWindow.loadURL('http://127.0.0.1:' + serverPort + '/');
}

app.setName('Cocos Creator Lite');
app.setAppUserModelId('com.youjunmao.cocoscreatorlite');
const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) {
  app.quit();
} else {
  app.whenReady()
    .then(async () => {
      registerIpc();
      await startLocalServer();
      await createMainWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
      });
    })
    .catch((error) => {
      console.error(error);
      app.quit();
    });

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (server) server.close();
});
