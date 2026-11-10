import { CCAudioClip } from "../core/assets/CCAudioClip.ts";

export class CCAudio {
  private readonly _element: HTMLAudioElement;

  constructor(private readonly _src: CCAudioClip) {
    this._element = new Audio(_src.nativeUrl);
    this._element.preload = "auto";
  }

  play(loop = false, volume = 1): Promise<void> {
    this._element.loop = loop;
    this._element.volume = volume;
    this._element.currentTime = 0;
    return this._element.play();
  }
}
