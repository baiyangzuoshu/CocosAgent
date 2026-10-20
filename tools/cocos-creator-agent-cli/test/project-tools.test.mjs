import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readProjectTools, resolveProjectTool } from '../bridge/project-tools.mjs';

function fixture(t) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-project-tools-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(projectRoot, '.cocos-agent'));
  return fs.realpathSync(projectRoot);
}

test('project tool aliases inherit canonical schemas, access, approval, and registry hash', (t) => {
  const projectRoot = fixture(t);
  const registryPath = path.join(projectRoot, '.cocos-agent/tools.json');
  fs.writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, tools: [
    { id: 'player-script', title: 'Read player script', description: 'Read the player component source.',
      commandId: 'creator.script.read' },
    { id: 'plan-script', title: 'Plan script creation', description: 'Plan a bounded script creation.',
      commandId: 'creator.script.create.plan' },
    { id: 'create-script', title: 'Create script', description: 'Create after Creator approval.',
      commandId: 'creator.script.create.commit' },
  ] }));

  const first = readProjectTools(projectRoot);
  assert.equal(first.status, 'ready');
  assert.match(first.registryHash, /^[a-f0-9]{64}$/);
  assert.equal(first.tools[0].access, 'read');
  assert.equal(first.tools[0].input, resolveProjectTool(projectRoot, 'player-script').tool.input);
  assert.equal(first.tools[0].input.required[0], 'scriptPath');
  assert.equal(first.tools[1].access, 'plan');
  assert.deepEqual(first.tools[1].input.required, ['scriptPath', 'source']);
  assert.equal(first.tools[2].access, 'write');
  assert.equal(first.tools[2].approval, true);
  assert.deepEqual(first.tools[2].input.required, ['operationId', 'planHash']);

  fs.writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, tools: [{
    id: 'player-script', title: 'Read player source', description: 'Read the player component source.',
    commandId: 'creator.script.read',
  }] }));
  const second = readProjectTools(projectRoot);
  assert.notEqual(second.registryHash, first.registryHash);
});

test('project tool registry rejects unapproved controls, duplicate declarations, and symlink files', (t) => {
  const projectRoot = fixture(t);
  const directory = path.join(projectRoot, '.cocos-agent');
  const registryPath = path.join(directory, 'tools.json');
  const declaration = { id: 'write-script', title: 'Write script', description: 'Try to expose a write.',
    commandId: 'creator.script.create.commit' };

  const unapprovedControl = { id: 'preview-input', title: 'Interact', description: 'Interact with preview.',
    commandId: 'creator.preview.interact' };
  fs.writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, tools: [unapprovedControl] }));
  assert.throws(() => readProjectTools(projectRoot), (error) => error.code === 'PROJECT_TOOL_COMMAND_NOT_ALLOWED');

  const duplicate = { ...declaration, id: 'read-script', commandId: 'creator.script.read' };
  fs.writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, tools: [duplicate, duplicate] }));
  assert.throws(() => readProjectTools(projectRoot), (error) => error.code === 'PROJECT_TOOL_DECLARATION_INVALID');

  const externalFile = path.join(projectRoot, 'external-tools.json');
  fs.writeFileSync(externalFile, JSON.stringify({ schemaVersion: 1, tools: [] }));
  fs.unlinkSync(registryPath);
  fs.symlinkSync(externalFile, registryPath);
  assert.throws(() => readProjectTools(projectRoot), (error) => error.code === 'PROJECT_TOOLS_REGISTRY_UNSAFE');
});
