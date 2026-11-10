import { AudioClip } from "./audio-clip.ts";
import { AudioPlayer } from "../../pal/audio/web/player.ts";

export class AudioSource {
  private _clip: AudioClip | null = null;
  private _player: AudioPlayer | null = null;
  ready: Promise<void> = Promise.resolve();

  set clip(value: AudioClip) {
    this._clip = value;
    this._syncPlayer();
  }

  private _syncPlayer(): void {
    const clip = this._clip;
    if (!clip) return;

    this.ready = AudioPlayer.load(clip._nativeAsset.url).then((player) => {
      this._player?.destroy();
      this._player = player;
    });
  }

  play(): Promise<void> {
    if (!this._player) {
      return Promise.reject(new Error("AudioSource is not loaded"));
    }
    return this._player.play();
  }
}
