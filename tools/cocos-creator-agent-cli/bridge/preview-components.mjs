/**
 * Read a component field from Creator 2.4's serialized runtime node shape.
 * This function is serialized into the preview page assertion expression, so
 * it must stay self-contained and avoid newer Creator Node APIs.
 */
export function readPreviewComponentProperty(node, componentType, componentProperty) {
  const components = node && Array.isArray(node._components) ? node._components : [];
  const component = components.find((item) => item && item.constructor
    && (item.constructor.name === componentType
      || item.constructor.prototype && item.constructor.prototype.__classname__ === componentType));
  let descriptor = component && Object.getOwnPropertyDescriptor(component, componentProperty);
  let found = !!descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
  let actual = found ? descriptor.value : null;
  // Creator 2.4 exposes these fields as prototype-backed properties. Read
  // their verified instance storage fields instead of invoking arbitrary
  // component getters in the preview page.
  if (component && !found) {
    const backingField = componentType === 'cc.Label'
      ? componentProperty === 'string' ? '_string'
        : componentProperty === 'overflow' ? '_N$overflow' : null
      : componentType === 'cc.PageView' && componentProperty === 'direction' ? '_N$direction' : null;
    descriptor = backingField ? Object.getOwnPropertyDescriptor(component, backingField) : null;
    found = !!descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
    actual = found ? descriptor.value : null;
  }
  const primitive = actual === null || ['string', 'number', 'boolean'].includes(typeof actual);
  return { found, actual: primitive ? actual : '[non-primitive-or-accessor]' };
}
