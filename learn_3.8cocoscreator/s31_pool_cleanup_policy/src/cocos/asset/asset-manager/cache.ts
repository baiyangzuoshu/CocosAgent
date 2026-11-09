export class Cache<T> {
  private readonly _map = new Map<string, T>();

  add(key: string, value: T): T {
    this._map.set(key, value);
    return value;
  }

  get(key: string): T | undefined {
    return this._map.get(key);
  }

  has(key: string): boolean {
    return this._map.has(key);
  }
}
