import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension');

test('component write receipts work in Creator runtimes without Object.hasOwn', () => {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  vm.runInNewContext('Object.hasOwn = undefined;\n' + source + '\nmodule.exports.receipt = sceneComponentPropertyReceipt;', {
    module, exports: module.exports, require: createRequire(path.join(root, 'main.js')), __dirname: root,
    Buffer, console, process, setTimeout, clearTimeout,
  });
  const operation = { operationId: 'test', status: 'completed', plan: { property: 'counter',
    expectedBefore: { value: 0 }, expectedAfter: { value: 7 } } };
  assert.equal(module.exports.receipt(operation, { value: 7 }).value, 7);
  assert.equal(module.exports.receipt(operation, { value: 0 }).value, 0);
  assert.equal(module.exports.receipt(operation, Object.create({ value: 7 })).value, null);
});

test('Provider schema discovery and input validation work without Object.hasOwn', () => {
  const module = { exports: {} };
  vm.runInNewContext('Object.hasOwn = undefined;\n' + fs.readFileSync(path.join(root, 'provider-contract.cjs'), 'utf8'), {
    module, exports: module.exports, require: createRequire(path.join(root, 'provider-contract.cjs')), Buffer,
  });
  const metadata = { creatorVersion: '2.4.15', protocolVersion: '1', commands: [{ id: 'run-tests', access: 'control',
    approval: true, title: 'Tests', description: 'Project tests', input: { type: 'object', required: ['query'],
      properties: { query: { type: 'string', maxLength: 10 } }, additionalProperties: false } }] };
  const provider = module.exports.normalizeProvider('project-tests', metadata);
  assert.equal(provider.commands[0].approval, true);
  assert.equal(module.exports.validateArguments(provider.commands[0].input, { query: 'test' }).query, 'test');
  assert.throws(() => module.exports.validateArguments(provider.commands[0].input, {}), /EXTENSION_COMMAND_INPUT_REQUIRED/);
});
