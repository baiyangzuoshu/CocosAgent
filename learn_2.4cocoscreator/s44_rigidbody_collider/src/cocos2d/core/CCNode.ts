export type Position = { x: number; y: number };

export class CCNode {
  private readonly components: unknown[] = [];

  constructor(
    readonly name: string,
    readonly worldPosition: Position,
    readonly scale: Position = { x: 1, y: 1 },
  ) {}

  addComponent<T extends { node: CCNode }>(component: T): T {
    component.node = this;
    this.components.push(component);
    return component;
  }

  getComponent<T>(type: new (...args: any[]) => T): T | null {
    return (this.components.find((item) => item instanceof type) as T) ?? null;
  }
}
