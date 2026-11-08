export class Context {
  private readonly services = new Map<string, unknown>();

  provide(name: string, service: unknown): void {
    this.services.set(name, service);
    Object.defineProperty(this, name, {
      configurable: true,
      enumerable: true,
      get: () => this.services.get(name),
    });
  }

  log(source: string, message: string): void {
    console.log(`[${source}] ${message}`);
  }
}
