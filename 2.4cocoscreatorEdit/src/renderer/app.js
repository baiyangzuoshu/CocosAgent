const api = window.cocosLite;
const treeElement = document.getElementById('hierarchy-tree');
const inspectorElement = document.getElementById('inspector-content');
const runtimeFrame = document.getElementById('runtime-frame');
const statusMessage = document.getElementById('status-message');
const statusIcon = document.getElementById('status-icon');
const projectLabel = document.getElementById('project-label');
const projectPathLabel = document.getElementById('project-path');
const runtimeStatus = document.getElementById('runtime-status');
const runtimeLabel = document.getElementById('runtime-label');
const runtimeLed = document.querySelector('.runtime-led');
const saveButton = document.querySelector('[data-action="save-project"]');
const buildButton = document.querySelector('[data-action="build-web"]');
const openLocationButton = document.querySelector('[data-action="open-location"]');
const deleteButton = document.querySelector('[data-action="delete-node"]');
const unsavedIndicator = document.getElementById('unsaved-indicator');

let scene = null;
let project = null;
let projectPath = null;
let selectedId = 'canvas';
let dirty = false;
let nodeSerial = 1;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setStatus(message, isError) {
  statusMessage.textContent = message;
  statusIcon.classList.toggle('error', Boolean(isError));
}

function getNode(id) {
  return scene && scene.nodes.find((node) => node.id === id);
}

function getChildren(parentId) {
  return scene.nodes.filter((node) => node.parentId === parentId);
}

function componentOf(node, type) {
  return node.components.find((component) => component.type === type);
}

function componentKind(node) {
  if (node.components.some((component) => component.type === 'Canvas')) return 'canvas';
  if (node.components.some((component) => component.type === 'Label')) return 'label';
  if (node.components.some((component) => component.type === 'Sprite')) return 'sprite';
  return 'node';
}

function renderNode(node, depth) {
  const row = document.createElement('button');
  const kind = componentKind(node);
  row.type = 'button';
  row.className = 'tree-item' + (selectedId === node.id ? ' selected' : '');
  row.dataset.nodeId = node.id;
  row.setAttribute('role', 'treeitem');
  row.setAttribute('aria-selected', selectedId === node.id ? 'true' : 'false');
  row.style.paddingLeft = String(8 + depth * 16) + 'px';

  const icon = document.createElement('span');
  icon.className = 'tree-kind ' + kind;
  icon.textContent = kind === 'canvas' ? '▣' : kind === 'label' ? 'T' : kind === 'sprite' ? '▧' : '◇';
  const label = document.createElement('span');
  label.className = 'tree-label';
  label.textContent = node.name;
  row.append(icon, label);
  treeElement.appendChild(row);

  getChildren(node.id).forEach((child) => renderNode(child, depth + 1));
}

function numberField(section, label, key, value, step) {
  const row = document.createElement('label');
  row.className = 'field-row';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.step = step || '1';
  input.value = Number(value);
  input.dataset.field = key;
  row.append(caption, input);
  section.appendChild(row);
}

function textField(section, label, key, value) {
  const row = document.createElement('label');
  row.className = 'field-row';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = String(value || '');
  input.dataset.field = key;
  row.append(caption, input);
  section.appendChild(row);
}

function colorField(section, label, key, value) {
  const row = document.createElement('label');
  row.className = 'field-row';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('input');
  input.type = 'color';
  input.value = /^#[0-9a-f]{6}$/i.test(String(value)) ? value : '#ffffff';
  input.dataset.field = key;
  row.append(caption, input);
  section.appendChild(row);
}

function checkboxField(section, label, key, checked) {
  const row = document.createElement('label');
  row.className = 'field-row checkbox-row';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = Boolean(checked);
  input.dataset.field = key;
  row.append(caption, input);
  section.appendChild(row);
}

function addSection(title) {
  const section = document.createElement('section');
  section.className = 'inspector-section';
  const heading = document.createElement('h2');
  heading.className = 'section-title';
  heading.textContent = title;
  section.appendChild(heading);
  inspectorElement.appendChild(section);
  return section;
}

function addComponentCard(title) {
  const card = document.createElement('section');
  card.className = 'component-card';
  const heading = document.createElement('h3');
  heading.className = 'component-title';
  heading.textContent = title;
  card.appendChild(heading);
  inspectorElement.appendChild(card);
  return card;
}

function renderHierarchy() {
  treeElement.replaceChildren();
  if (!scene) return;
  const root = scene.nodes.find((node) => node.parentId === null);
  if (root) renderNode(root, 0);
  document.getElementById('node-count').textContent = String(scene.nodes.length);
  deleteButton.disabled = !selectedId || selectedId === root.id;
}

function renderInspector() {
  inspectorElement.replaceChildren();
  const node = getNode(selectedId);
  if (!node) {
    document.getElementById('inspector-type').textContent = 'NONE';
    inspectorElement.innerHTML = '<div class="empty-inspector">从层级面板选择一个节点<br>查看并修改属性</div>';
    return;
  }

  const kind = componentKind(node);
  document.getElementById('inspector-type').textContent = kind.toUpperCase();
  const basic = addSection('节点');
  textField(basic, '名称', 'name', node.name);
  checkboxField(basic, 'Active', 'active', node.active);

  if (kind === 'canvas') {
    const resolution = addSection('画布');
    numberField(resolution, '宽度', 'designWidth', scene.designResolution.width, '1');
    numberField(resolution, '高度', 'designHeight', scene.designResolution.height, '1');
    return;
  }

  const transform = node.transform;
  const transformSection = addSection('Transform');
  const transformGrid = document.createElement('div');
  transformGrid.className = 'transform-grid';
  numberField(transformGrid, 'X', 'x', transform.x, '1');
  numberField(transformGrid, 'Y', 'y', transform.y, '1');
  numberField(transformGrid, 'Rot', 'rotation', transform.rotation, '1');
  numberField(transformGrid, 'SX', 'scaleX', transform.scaleX, '0.1');
  numberField(transformGrid, 'SY', 'scaleY', transform.scaleY, '0.1');
  transformSection.appendChild(transformGrid);

  const label = componentOf(node, 'Label');
  if (label) {
    const card = addComponentCard('Label');
    textField(card, '文本', 'labelText', label.text);
    numberField(card, '字号', 'fontSize', label.fontSize, '1');
    colorField(card, '颜色', 'labelColor', label.color);
  }
  const sprite = componentOf(node, 'Sprite');
  if (sprite) {
    const card = addComponentCard('Sprite');
    numberField(card, '宽度', 'spriteWidth', sprite.width, '1');
    numberField(card, '高度', 'spriteHeight', sprite.height, '1');
    colorField(card, '颜色', 'spriteColor', sprite.color);
  }
  if (!label && !sprite) {
    const hint = document.createElement('div');
    hint.className = 'empty-inspector';
    hint.textContent = '此节点暂时没有可编辑组件。';
    inspectorElement.appendChild(hint);
  }
}

function renderProjectInfo() {
  const projectName = project ? project.name : '示例场景 · 未保存';
  projectLabel.textContent = projectName;
  projectPathLabel.textContent = projectPath || '尚未创建或打开项目';
  document.getElementById('scene-title').textContent = (scene && scene.name ? scene.name : 'Main') + '.scene.json';
  document.getElementById('resolution-label').textContent =
    String(scene.designResolution.width) + ' × ' + String(scene.designResolution.height);
  saveButton.disabled = !projectPath;
  buildButton.disabled = !projectPath;
  openLocationButton.disabled = !projectPath;
  unsavedIndicator.classList.toggle('visible', dirty);
}

function sendSceneToRuntime() {
  if (!runtimeFrame.contentWindow || !scene) return;
  runtimeFrame.contentWindow.postMessage(
    {
      channel: 'cocos-creator-lite-v1',
      type: 'apply-scene',
      scene: clone(scene),
    },
    window.location.origin,
  );
}

function renderAll() {
  renderHierarchy();
  renderInspector();
  renderProjectInfo();
  sendSceneToRuntime();
}

function defaultNode(name, parentId, components) {
  return {
    id: window.crypto.randomUUID(),
    name: name,
    parentId: parentId,
    active: true,
    transform: {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    components: components || [],
  };
}

function createNode(type) {
  const selected = getNode(selectedId);
  const parentId = selected ? selected.id : 'canvas';
  nodeSerial += 1;
  let node;
  if (type === 'label') {
    node = defaultNode('Label' + nodeSerial, parentId, [
      { type: 'Label', text: 'New Label', fontSize: 32, color: '#f4f7fb' },
    ]);
  } else if (type === 'sprite') {
    node = defaultNode('Sprite' + nodeSerial, parentId, [
      { type: 'Sprite', width: 120, height: 80, color: '#57c7ff' },
    ]);
  } else {
    node = defaultNode('Node' + nodeSerial, parentId, []);
  }
  scene.nodes.push(node);
  selectedId = node.id;
  markDirty();
  renderAll();
}

function deleteSelectedNode() {
  const selected = getNode(selectedId);
  if (!selected || selected.parentId === null) return;
  const removed = new Set([selected.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of scene.nodes) {
      if (removed.has(node.parentId) && !removed.has(node.id)) {
        removed.add(node.id);
        changed = true;
      }
    }
  }
  scene.nodes = scene.nodes.filter((node) => !removed.has(node.id));
  selectedId = 'canvas';
  markDirty();
  renderAll();
}

function markDirty() {
  dirty = true;
  unsavedIndicator.classList.add('visible');
}

function applyInspectorChange(input) {
  const node = getNode(selectedId);
  if (!node || !input.dataset.field) return;
  const field = input.dataset.field;
  const value = input.type === 'checkbox' ? input.checked : input.value;
  const number = Number(value);

  if (field === 'name') node.name = String(value).trim() || 'Node';
  else if (field === 'active') node.active = Boolean(value);
  else if (field === 'designWidth') scene.designResolution.width = Math.max(1, number || 1);
  else if (field === 'designHeight') scene.designResolution.height = Math.max(1, number || 1);
  else if (['x', 'y', 'rotation', 'scaleX', 'scaleY'].includes(field)) {
    node.transform[field] = Number.isFinite(number) ? number : 0;
  } else {
    const label = componentOf(node, 'Label');
    const sprite = componentOf(node, 'Sprite');
    if (field === 'labelText' && label) label.text = String(value);
    else if (field === 'fontSize' && label) label.fontSize = Math.max(8, number || 8);
    else if (field === 'labelColor' && label) label.color = String(value);
    else if (field === 'spriteWidth' && sprite) sprite.width = Math.max(1, number || 1);
    else if (field === 'spriteHeight' && sprite) sprite.height = Math.max(1, number || 1);
    else if (field === 'spriteColor' && sprite) sprite.color = String(value);
  }

  markDirty();
  renderAll();
}

async function createProject() {
  const dialog = document.getElementById('new-project-dialog');
  const nameInput = document.getElementById('new-project-name');
  nameInput.value = 'MyCocosProject';
  const choice = new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
  });
  dialog.showModal();
  nameInput.focus();
  const action = await choice;
  if (action !== 'create' || !nameInput.value.trim()) return;
  const result = await api.newProject(nameInput.value.trim(), clone(scene));
  if (!result) return;
  project = result.project;
  projectPath = result.projectPath;
  scene = result.scene;
  selectedId = 'canvas';
  dirty = false;
  renderAll();
  setStatus('项目已创建并保存。');
}

async function openProject() {
  const result = await api.openProject();
  if (!result) return;
  project = result.project;
  projectPath = result.projectPath;
  scene = result.scene;
  selectedId = scene.nodes.find((node) => node.parentId === null).id;
  dirty = false;
  renderAll();
  setStatus('已打开项目 ' + project.name + '。');
}

async function saveProject() {
  const result = await api.saveProject(clone(scene));
  if (!result) return;
  project = result.project;
  projectPath = result.projectPath;
  dirty = false;
  renderAll();
  setStatus('场景已保存。');
}

async function buildWeb() {
  const result = await api.buildWeb(clone(scene));
  if (!result) return;
  dirty = false;
  renderProjectInfo();
  setStatus('Web 构建已生成并打开预览：' + result.outputPath);
}

async function handleAction(action) {
  try {
    if (action === 'new-project') await createProject();
    else if (action === 'open-project') await openProject();
    else if (action === 'save-project') await saveProject();
    else if (action === 'build-web') await buildWeb();
    else if (action === 'open-location') await api.openProjectLocation();
    else if (action === 'run') {
      runtimeStatus.classList.remove('ready');
      runtimeStatus.textContent = '正在重新运行场景…';
      runtimeFrame.src = '/runtime/index.html?editor=1&t=' + Date.now();
    } else if (action === 'add-node') createNode('node');
    else if (action === 'delete-node') deleteSelectedNode();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

document.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    event.preventDefault();
    void handleAction(actionButton.dataset.action);
    return;
  }
  const createButton = event.target.closest('[data-create]');
  if (createButton && scene) {
    createNode(createButton.dataset.create);
    return;
  }
  const treeButton = event.target.closest('[data-node-id]');
  if (treeButton) {
    selectedId = treeButton.dataset.nodeId;
    renderHierarchy();
    renderInspector();
  }
});

inspectorElement.addEventListener('change', (event) => {
  if (event.target instanceof HTMLInputElement) applyInspectorChange(event.target);
});

runtimeFrame.addEventListener('load', () => {
  runtimeStatus.classList.remove('ready');
  runtimeStatus.textContent = '等待引擎启动…';
});

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.source !== runtimeFrame.contentWindow) return;
  const message = event.data;
  if (!message || message.channel !== 'cocos-creator-lite-v1') return;
  if (message.type === 'runtime-ready') {
    runtimeStatus.classList.add('ready');
    runtimeLed.classList.add('ready');
    runtimeLabel.textContent = 'Creator ' + message.detail.version + ' Web Mobile 运行时已连接';
    sendSceneToRuntime();
  }
  if (message.type === 'scene-applied') {
    runtimeStatus.classList.add('ready');
  }
});

fetch('/sample.scene.json')
  .then((response) => {
    if (!response.ok) throw new Error('无法读取 Starter2D 示例场景。');
    return response.json();
  })
  .then((sample) => {
    scene = sample;
    selectedId = 'canvas';
    renderAll();
    setStatus('示例场景已加载。新建项目后可保存为独立项目。');
  })
  .catch((error) => {
    setStatus(error instanceof Error ? error.message : String(error), true);
  });
