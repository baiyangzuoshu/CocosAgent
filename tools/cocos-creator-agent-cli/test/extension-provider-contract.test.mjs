import assert from 'node:assert/strict';
import test from 'node:test';
import providerContract from '../creator-extension/provider-contract.cjs';

const { normalizeProvider, validateArguments } = providerContract;

function metadata(access = 'read') {
  return { creatorVersion: '2.4.15', protocolVersion: '1', commands: [{ id: 'inspect-assets',
    title: 'Inspect assets', description: 'Read project asset metadata.', access,
    ...(access === 'write' || access === 'control' ? { approval: true } : {}),
    input: { type: 'object', required: ['query'], properties: {
      query: { type: 'string', minLength: 1, maxLength: 80 },
      limit: { type: 'integer', minimum: 1, maximum: 50 },
    }, additionalProperties: false } }] };
}

test('extension provider contract normalizes descriptors and validates declared inputs', () => {
  const provider = normalizeProvider('sample-assets', metadata());
  assert.equal(provider.providerId, 'sample-assets');
  assert.match(provider.providerFingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(validateArguments(provider.commands[0].input, { query: 'icon', limit: 10 }), { query: 'icon', limit: 10 });
  assert.throws(() => validateArguments(provider.commands[0].input, { query: 'icon', unexpected: true }),
    (error) => error.code === 'EXTENSION_COMMAND_INPUT_UNKNOWN_FIELD');
  assert.throws(() => validateArguments(provider.commands[0].input, { query: '' }),
    (error) => error.code === 'EXTENSION_COMMAND_INPUT_INVALID');
});

test('mutating provider commands require Creator approval and explicit object schemas', () => {
  const write = metadata('write');
  assert.equal(normalizeProvider('sample-assets', write).commands[0].approval, true);
  write.commands[0].approval = false;
  assert.throws(() => normalizeProvider('sample-assets', write),
    (error) => error.code === 'EXTENSION_COMMAND_DECLARATION_INVALID');

  const unsafe = metadata();
  unsafe.commands[0].input.properties.query.pattern = '.*';
  assert.throws(() => normalizeProvider('sample-assets', unsafe),
    (error) => error.code === 'EXTENSION_COMMAND_SCHEMA_INVALID');
});

test('provider contracts reject invalid identities, duplicate command IDs, and oversized arguments', () => {
  assert.throws(() => normalizeProvider('../outside', metadata()),
    (error) => error.code === 'EXTENSION_PROVIDER_METADATA_INVALID');
  const duplicate = metadata();
  duplicate.commands.push({ ...duplicate.commands[0] });
  assert.throws(() => normalizeProvider('sample-assets', duplicate),
    (error) => error.code === 'EXTENSION_COMMAND_DECLARATION_INVALID');
  const provider = normalizeProvider('sample-assets', metadata());
  assert.throws(() => validateArguments(provider.commands[0].input, { query: 'x'.repeat(17000) }),
    (error) => error.code === 'EXTENSION_COMMAND_INPUT_INVALID');
});
