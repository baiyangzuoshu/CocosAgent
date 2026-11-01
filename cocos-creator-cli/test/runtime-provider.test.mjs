import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperSource = fs.readFileSync(path.join(packageRoot, 'runtime/provider.js'), 'utf8');

function loadRuntimeApi() {
  const window = {};
  const module = { exports: {} };
  vm.runInNewContext(helperSource, { window, module, setTimeout, clearTimeout });
  return window.CocosCreatorAgentRuntime;
}

function metadata(providerId = 'game-state') {
  return { providerId, protocolVersion: '1', commands: [{ id: 'get-score', title: 'Read score',
    description: 'Read the current score.', access: 'read', input: {
      type: 'object', required: ['limit'], properties: { limit: { type: 'integer', minimum: 1, maximum: 10 } },
      additionalProperties: false,
    } }] };
}

test('runtime Provider API registers a bounded command and invokes it with validated input', async () => {
  const api = loadRuntimeApi();
  const seen = [];
  api.registerProvider(metadata(), { 'get-score': (input) => { seen.push(input); return { score: input.limit * 2 }; } });
  const [registered] = api.describe();
  const invoked = await api.invoke({ providerId: 'game-state', commandId: 'get-score',
    expectedMetadata: api.canonical(registered), input: { limit: 3 } });
  assert.deepEqual(JSON.parse(JSON.stringify(registered)), { ...metadata(), commands: metadata().commands.map((item) => ({ ...item, approval: false })) });
  assert.deepEqual(JSON.parse(JSON.stringify(invoked)), { ok: true, result: { score: 6 } });
  assert.deepEqual(JSON.parse(JSON.stringify(seen)), [{ limit: 3 }]);
});

test('runtime Provider API rejects missing fields, unknown fields, and reserved session selectors', () => {
  const api = loadRuntimeApi();
  api.registerProvider(metadata(), { 'get-score': (input) => input });
  const [registered] = api.describe();
  assert.throws(() => api.validateArguments(registered.commands[0].input, {}), /RUNTIME_PROVIDER_INPUT_REQUIRED/);
  assert.throws(() => api.validateArguments(registered.commands[0].input, { limit: 2, extra: true }), /RUNTIME_PROVIDER_INPUT_UNKNOWN_FIELD/);
  const reserved = metadata('reserved-tool');
  reserved.commands[0].input.properties.previewSessionId = { type: 'string' };
  assert.throws(() => loadRuntimeApi().registerProvider(reserved, { 'get-score': () => null }), /RUNTIME_PROVIDER_SCHEMA_RESERVED_FIELD/);
});

test('runtime Provider API rejects malformed declarations and duplicate provider or command IDs', () => {
  const api = loadRuntimeApi();
  const controlWithoutApproval = metadata();
  controlWithoutApproval.commands[0].access = 'control';
  assert.throws(() => api.registerProvider(controlWithoutApproval, { 'get-score': () => null }), /RUNTIME_PROVIDER_COMMAND_INVALID/);
  const unsafeSchema = metadata();
  unsafeSchema.commands[0].input.additionalProperties = true;
  assert.throws(() => api.registerProvider(unsafeSchema, { 'get-score': () => null }), /RUNTIME_PROVIDER_SCHEMA_INVALID/);
  const duplicateCommands = metadata();
  duplicateCommands.commands.push({ ...duplicateCommands.commands[0] });
  assert.throws(() => api.registerProvider(duplicateCommands, { 'get-score': () => null }), /RUNTIME_PROVIDER_COMMAND_INVALID/);
  api.registerProvider(metadata(), { 'get-score': () => null });
  assert.throws(() => api.registerProvider(metadata(), { 'get-score': () => null }), /RUNTIME_PROVIDER_DUPLICATE/);
});

test('runtime Provider API matches the existing schema and byte limits and protects its catalog from mutation', () => {
  const api = loadRuntimeApi();
  const declared = metadata();
  api.registerProvider(declared, { 'get-score': () => null });
  declared.commands[0].input.properties.limit.maximum = 1000;
  const [catalogEntry] = api.describe();
  assert.equal(catalogEntry.commands[0].input.properties.limit.maximum, 10);
  catalogEntry.commands[0].input.properties.limit.maximum = 20;
  assert.equal(api.describe()[0].commands[0].input.properties.limit.maximum, 10);

  let deepSchema = { type: 'string' };
  for (let depth = 0; depth < 7; depth += 1) {
    deepSchema = { type: 'object', properties: { child: deepSchema }, additionalProperties: false };
  }
  const tooDeep = metadata('deep-schema');
  tooDeep.commands[0].input = deepSchema;
  assert.throws(() => loadRuntimeApi().registerProvider(tooDeep, { 'get-score': () => null }), /RUNTIME_PROVIDER_SCHEMA_INVALID/);

  const oversizedSchema = { type: 'object', properties: { chunks: {
    type: 'array', items: { type: 'string', maxLength: 4096 }, maxItems: 64,
  } }, additionalProperties: false };
  assert.throws(() => api.validateArguments(oversizedSchema, { chunks: ['界'.repeat(4096), '界'.repeat(4096)] }),
    /RUNTIME_PROVIDER_INPUT_INVALID/);
});

test('runtime Provider API rejects a stale declaration and reports an uncertain handler timeout', async () => {
  const api = loadRuntimeApi();
  api.registerProvider(metadata(), { 'get-score': () => new Promise(() => {}) });
  const [registered] = api.describe();
  const stale = await api.invoke({ providerId: 'game-state', commandId: 'get-score',
    expectedMetadata: `${api.canonical(registered)} `, input: { limit: 1 }, timeoutMs: 100 });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, 'RUNTIME_PROVIDER_CHANGED');
  const timedOut = await api.invoke({ providerId: 'game-state', commandId: 'get-score',
    expectedMetadata: api.canonical(registered), input: { limit: 1 }, timeoutMs: 100 });
  assert.equal(timedOut.ok, false);
  assert.equal(timedOut.error.code, 'RUNTIME_PROVIDER_TIMEOUT_UNCERTAIN');
});

test('runtime discovery rejects invalid or disconnected Preview sessions', async () => {
  const { runtimeProviderCommands, callRuntimeProvider, runtimePlayerErrorCode } = await import('../bridge/runtime-preview.mjs');
  await assert.rejects(() => runtimeProviderCommands('not-a-session'), /PREVIEW_SESSION_ID_INVALID/);
  const sessionId = '11111111-1111-4111-8111-111111111111';
  await assert.rejects(() => runtimeProviderCommands(sessionId), /PREVIEW_SESSION_NOT_FOUND/);
  await assert.rejects(() => callRuntimeProvider(sessionId, {
    providerId: 'game-state', commandId: 'get-score', providerFingerprint: 'a'.repeat(64), arguments: { limit: 1 },
  }), /PREVIEW_SESSION_NOT_FOUND/);
  assert.equal(runtimePlayerErrorCode({ code: 'PREVIEW_DEVTOOLS_DISCONNECTED' }), 'RUNTIME_PLAYER_DISCONNECTED');
  assert.equal(runtimePlayerErrorCode({ code: 'PREVIEW_BROWSER_EXITED' }), 'RUNTIME_PLAYER_DISCONNECTED');
  assert.equal(runtimePlayerErrorCode({ code: 'PREVIEW_DEVTOOLS_COMMAND_TIMEOUT' }), 'RUNTIME_PLAYER_UNRESPONSIVE');
});
