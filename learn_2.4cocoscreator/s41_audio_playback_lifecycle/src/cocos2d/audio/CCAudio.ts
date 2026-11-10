import { CCAudioClip } from "../core/assets/CCAudioClip.ts";

export class CCAudio {
  private readonly _element: HTMLAudioElement;
  private _state: CCAudioState = CCAudioState.STOPPED;

  constructor(
    private readonly _src: CCAudioClip,
    private readonly _onEnded: () => void,
  ) {
    this._element = new Audio(_src.nativeUrl);
    this._element.preload = "auto";
    this._element.addEventListener("ended", () => {
      this._state = CCAudioState.STOPPED;
      this._onEnded();
    });
  }

  play(loop = false, volume = 1): Promise<void> {
    this._element.loop = loop;
    this._element.volume = volume;
    this._element.currentTime = 0;
    this._state = CCAudioState.PLAYING;
    return this._element.play().then(() => undefined);
  }

  pause(): void {
    if (this._state !== CCAudioState.PLAYING) return;
    this._element.pause();
    this._state = CCAudioState.PAUSED;
  }

  resume(): Promise<void> {
    if (this._state !== CCAudioState.PAUSED) return Promise.resolve();
    this._state = CCAudioState.PLAYING;
    return this._element.play().then(() => undefined);
  }

  stop(): void {
    this._element.pause();
    this._element.currentTime = 0;
    this._state = CCAudioState.STOPPED;
  }

  get state(): CCAudioState {
    return this._state;
  }
}

export enum CCAudioState {
  STOPPED = "STOPPED",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
}
