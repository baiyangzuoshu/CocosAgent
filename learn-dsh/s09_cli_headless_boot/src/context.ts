export class Context {
  private readonly services = new Map<string, unknown>();

  provide<T>(name: string, value: T): void {
    this.services.set(name, value);
  }

  require<T>(name: string): T {
    if (!this.services.has(name)) throw new Error(`required service is missing: ${name}`);
    return this.services.get(name) as T;
  }
}
