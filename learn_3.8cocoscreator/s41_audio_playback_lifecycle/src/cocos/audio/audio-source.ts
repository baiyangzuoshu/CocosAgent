import { AudioClip } from "./audio-clip.ts";
import { AudioPlayer, AudioState } from "../../pal/audio/web/player.ts";
import Node from "../scene-graph/node.ts";

export const AudioSourceEventType = {
  ENDED: "audio-ended",
};

export class AudioSource {
  private _clip: AudioClip | null = null;
  private _player: AudioPlayer | null = null;
  ready: Promise<void> = Promise.resolve();

  constructor(readonly node = new Node()) {}

  set clip(value: AudioClip) {
    this._clip = value;
    this._syncPlayer();
  }

  get state(): AudioState {
    return this._player?.state ?? AudioState.INIT;
  }

  private _syncPlayer(): void {
    const clip = this._clip;
    if (!clip) return;

    this.ready = AudioPlayer.load(clip._nativeAsset.url).then((player) => {
      this._player?.destroy();
      this._player = player;
      player.onEnded(() => {
        this.node.emit(AudioSourceEventType.ENDED, this);
      });
    });
  }

  play(): Promise<void> {
    if (!this._player) {
      return Promise.reject(new Error("AudioSource is not loaded"));
    }
    const player = this._player;
    if (this.state === AudioState.PLAYING) {
      return player.stop().then(() => player.play());
    }
    return player.play();
  }

  pause(): Promise<void> {
    return this._player?.pause() ?? Promise.resolve();
  }

  stop(): Promise<void> {
    return this._player?.stop() ?? Promise.resolve();
  }
}
