export class Node {
  private readonly components: unknown[] = [];

  constructor(
    readonly name: string,
    readonly worldPosition: { x: number; y: number },
    readonly worldScale = { x: 1, y: 1 },
  ) {}

  addComponent<T extends { node: Node }>(component: T): T {
    component.node = this;
    this.components.push(component);
    return component;
  }

  getComponent<T>(type: new (...args: any[]) => T): T | null {
    return (this.components.find((item) => item instanceof type) as T) ?? null;
  }
}
