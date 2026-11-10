export default class Pacer {
  private _isPlaying = false;
  private _frameHandle = 0;
  private _onTick: (() => void) | null = null;

  set onTick(callback: (() => void) | null) {
    this._onTick = callback;
  }

  start(): void {
    if (this._isPlaying) {
      return;
    }

    this._isPlaying = true;
    const update = (): void => {
      if (!this._isPlaying) {
        return;
      }

      this._frameHandle = requestAnimationFrame(update);
      this._onTick?.();
    };

    this._frameHandle = requestAnimationFrame(update);
  }

  stop(): void {
    if (!this._isPlaying) {
      return;
    }

    cancelAnimationFrame(this._frameHandle);
    this._isPlaying = false;
  }
}
