import assert from 'node:assert/strict';
import test from 'node:test';
import { readPreviewComponentProperty } from '../bridge/preview-components.mjs';

test('preview component assertions read Creator 2.4 component arrays without calling getComponents()', () => {
  const component = { counter: 1 };
  component.constructor = { name: 'CocosCliAcceptance20261020' };
  const node = { _components: [component], getComponents() { throw new Error('Creator 2.4 requires a type argument'); } };
  assert.deepEqual(readPreviewComponentProperty(node, 'CocosCliAcceptance20261020', 'counter'), { found: true, actual: 1 });
  assert.deepEqual(readPreviewComponentProperty(node, 'OtherComponent', 'counter'), { found: false, actual: null });
  assert.deepEqual(readPreviewComponentProperty(node, 'CocosCliAcceptance20261020', 'missing'), { found: false, actual: null });
});

test('preview component assertions reject accessors and non-primitive values', () => {
  const component = { constructor: { name: 'Example' }, get value() { return 1; }, object: {} };
  const node = { _components: [component] };
  assert.deepEqual(readPreviewComponentProperty(node, 'Example', 'value'), { found: false, actual: null });
  assert.deepEqual(readPreviewComponentProperty(node, 'Example', 'object'), { found: true, actual: '[non-primitive-or-accessor]' });
});
