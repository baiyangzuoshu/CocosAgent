/**
 * Read a component field from Creator 2.4's serialized runtime node shape.
 * This function is serialized into the preview page assertion expression, so
 * it must stay self-contained and avoid newer Creator Node APIs.
 */
export function readPreviewComponentProperty(node, componentType, componentProperty) {
  const components = node && Array.isArray(node._components) ? node._components : [];
  const component = components.find((item) => item && item.constructor && item.constructor.name === componentType);
  const descriptor = component && Object.getOwnPropertyDescriptor(component, componentProperty);
  const found = !!descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
  const actual = found ? descriptor.value : null;
  const primitive = actual === null || ['string', 'number', 'boolean'].includes(typeof actual);
  return { found, actual: primitive ? actual : '[non-primitive-or-accessor]' };
}
