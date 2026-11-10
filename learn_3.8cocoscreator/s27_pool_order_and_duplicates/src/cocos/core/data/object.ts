const objectsToDestroy: CCObject[] = [];

export default class CCObject {
  private _toDestroy = false;
  private _destroyed = false;

  static _deferredDestroy(): void {
    const count = objectsToDestroy.length;
    for (let i = 0; i < count; i++) objectsToDestroy[i]._destroyImmediate();
    objectsToDestroy.splice(0, count);
  }

  get isValid(): boolean {
    return !this._destroyed;
  }

  destroy(): boolean {
    if (this._toDestroy || this._destroyed) return false;
    this._toDestroy = true;
    objectsToDestroy.push(this);
    return true;
  }

  _destroyImmediate(): void {
    if (this._destroyed) return;
    this._onPreDestroy();
    this._destroyed = true;
  }

  protected _onPreDestroy(): void {}
}
