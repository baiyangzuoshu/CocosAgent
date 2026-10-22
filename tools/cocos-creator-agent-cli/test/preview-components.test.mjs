import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { readPreviewComponentProperty } from '../bridge/preview-components.mjs';
import { previewUiRefreshExpression, validatePreviewActions } from '../bridge/runtime-preview.mjs';

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

test('preview component assertions accept exact Creator class names from serialized components', () => {
  class Slider { constructor() { this.progress = 0.75; } }
  Slider.prototype.__classname__ = 'cc.Slider';
  const node = { _components: [new Slider()] };
  assert.deepEqual(readPreviewComponentProperty(node, 'cc.Slider', 'progress'), { found: true, actual: 0.75 });
});

test('preview actions validate bounded canvas drags and text entry', () => {
  assert.deepEqual(validatePreviewActions([
    { type: 'drag', startX: 0.1, startY: 0.2, endX: 0.9, endY: 0.8, durationMs: 180 },
    { type: 'text', text: 'player name' },
  ]), [
    { type: 'drag', startX: 0.1, startY: 0.2, endX: 0.9, endY: 0.8, durationMs: 180 },
    { type: 'text', text: 'player name' },
  ]);
  assert.throws(() => validatePreviewActions([{ type: 'drag', startX: -0.1, startY: 0, endX: 1, endY: 1 }]),
    { code: 'PREVIEW_DRAG_OUT_OF_BOUNDS' });
  assert.throws(() => validatePreviewActions([{ type: 'text', text: 'x'.repeat(513) }]),
    { code: 'PREVIEW_TEXT_INPUT_INVALID' });
  assert.throws(() => validatePreviewActions([{ type: 'text', text: 'ok', path: 'Scene' }]),
    { code: 'PREVIEW_ACTION_FIELD_INVALID' });
});

test('preview UI refresh actions are limited to exact Widget/Layout paths', () => {
  assert.deepEqual(validatePreviewActions([{ type: 'ui-refresh', path: 'Scene/Canvas/List', componentType: 'cc.Layout' }]),
    [{ type: 'ui-refresh', path: 'Scene/Canvas/List', componentType: 'cc.Layout' }]);
  assert.throws(() => validatePreviewActions([{ type: 'ui-refresh', path: '../List', componentType: 'cc.Layout' }]),
    { code: 'PREVIEW_UI_REFRESH_INPUT_INVALID' });
  assert.throws(() => validatePreviewActions([{ type: 'ui-refresh', path: 'Scene/List', componentType: 'cc.Button' }]),
    { code: 'PREVIEW_UI_REFRESH_INPUT_INVALID' });
});

test('preview UI refresh invokes public layout methods and returns bounded before/after geometry', () => {
  class Widget { updateAlignment() { panel.y = 24; } }
  class Layout { updateLayout() { list.children[0].y = 40; } }
  const button = { name: 'Item', uuid: 'item-uuid', x: 0, y: 0, width: 100, height: 30, anchorX: 0.5, anchorY: 0.5 };
  const list = { name: 'List', uuid: 'list-uuid', x: 0, y: 0, width: 200, height: 100,
    anchorX: 0.5, anchorY: 0.5, children: [button], _components: [new Layout()],
    getComponent(type) { return this._components.find((component) => component instanceof type) || null; } };
  const panel = { name: 'Panel', uuid: 'panel-uuid', x: 0, y: 0, width: 200, height: 100,
    anchorX: 0.5, anchorY: 0.5, children: [list], _components: [new Widget()],
    getComponent(type) { return this._components.find((component) => component instanceof type) || null; } };
  const root = { name: 'Scene', children: [panel], _components: [] };
  const cc = { director: { getScene: () => root }, Widget, Layout, Object: { Flags: { DontSave: 1, HideInHierarchy: 2 } } };
  const widgetResult = runInNewContext(previewUiRefreshExpression({ type: 'ui-refresh', path: 'Scene/Panel', componentType: 'cc.Widget' }),
    { window: { cc } });
  assert.equal(widgetResult.applied, true);
  assert.equal(widgetResult.method, 'updateAlignment');
  assert.equal(widgetResult.before.y, 0);
  assert.equal(widgetResult.after.y, 24);
  const layoutResult = runInNewContext(previewUiRefreshExpression({ type: 'ui-refresh', path: 'Scene/Panel/List', componentType: 'cc.Layout' }),
    { window: { cc } });
  assert.equal(layoutResult.applied, true);
  assert.equal(layoutResult.changed, true);
  assert.equal(layoutResult.childrenBefore[0].y, 0);
  assert.equal(layoutResult.childrenAfter[0].y, 40);
});
