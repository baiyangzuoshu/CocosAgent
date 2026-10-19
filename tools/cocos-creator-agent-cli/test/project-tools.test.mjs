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

test('project tool aliases inherit the built-in read schema and registry hash', (t) => {
  const projectRoot = fixture(t);
  const registryPath = path.join(projectRoot, '.cocos-agent/tools.json');
  fs.writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, tools: [{
    id: 'player-script', title: 'Read player script', description: 'Read the player component source.',
    commandId: 'creator.script.read',
  }] }));

  const first = readProjectTools(projectRoot);
  assert.equal(first.status, 'ready');
  assert.match(first.registryHash, /^[a-f0-9]{64}$/);
  assert.equal(first.tools[0].access, 'read');
  assert.equal(first.tools[0].input, resolveProjectTool(projectRoot, 'player-script').tool.input);
  assert.equal(first.tools[0].input.required[0], 'scriptPath');

  fs.writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, tools: [{
    id: 'player-script', title: 'Read player source', description: 'Read the player component source.',
    commandId: 'creator.script.read',
  }] }));
  const second = readProjectTools(projectRoot);
  assert.notEqual(second.registryHash, first.registryHash);
});

test('project tool registry rejects writes, duplicate declarations, and symlink files', (t) => {
  const projectRoot = fixture(t);
  const directory = path.join(projectRoot, '.cocos-agent');
  const registryPath = path.join(directory, 'tools.json');
  const declaration = { id: 'write-script', title: 'Write script', description: 'Try to expose a write.',
    commandId: 'creator.script.create.commit' };
  fs.writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, tools: [declaration] }));
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
