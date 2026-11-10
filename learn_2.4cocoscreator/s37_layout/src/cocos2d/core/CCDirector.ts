export default class CCDirector {
  private readonly afterUpdateListeners: Array<() => void> = [];

  onAfterUpdate(listener: () => void): void {
    this.afterUpdateListeners.push(listener);
  }

  afterUpdate(): void {
    for (const listener of this.afterUpdateListeners) listener();
  }
}
