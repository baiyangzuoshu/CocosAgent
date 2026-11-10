import { AudioClip } from "./audio-clip.ts";
import { AudioPlayer, AudioState } from "../../pal/audio/web/player.ts";
import Node from "../scene-graph/node.ts";
import { audioManager } from "./audio-manager.ts";

export const AudioSourceEventType = {
  ENDED: "audio-ended",
};

export class AudioSource {
  private _clip: AudioClip | null = null;
  private _player: AudioPlayer | null = null;
  private _loop = false;
  private _volume = 1;
  ready: Promise<void> = Promise.resolve();

  constructor(readonly node = new Node()) {}

  set clip(value: AudioClip) {
    this._clip = value;
    this._syncPlayer();
  }

  get state(): AudioState {
    return this._player?.state ?? AudioState.INIT;
  }

  set loop(value: boolean) {
    this._loop = value;
    if (this._player) this._player.loop = value;
  }

  set volume(value: number) {
    this._volume = Math.max(0, Math.min(1, value));
    if (this._player) this._player.volume = this._volume;
  }

  get volume(): number {
    return this._volume;
  }

  private _syncPlayer(): void {
    const clip = this._clip;
    if (!clip) return;

    this.ready = AudioPlayer.load(clip._nativeAsset.url, this._volume, this._loop).then((player) => {
      this._player?.destroy();
      this._player = player;
      player.onEnded(() => {
        audioManager.removePlaying(player);
        this.node.emit(AudioSourceEventType.ENDED, this);
      });
    });
  }

  play(): Promise<void> {
    if (!this._player) {
      return Promise.reject(new Error("AudioSource is not loaded"));
    }
    const player = this._player;
    audioManager.discardOnePlayingIfNeeded();
    if (this.state === AudioState.PLAYING) {
      return player.stop().then(() => {
        audioManager.addPlaying(player, false);
        return player.play().catch((error: unknown) => {
          audioManager.removePlaying(player);
          throw error;
        });
      });
    }
    audioManager.addPlaying(player, false);
    return player.play().catch((error: unknown) => {
      audioManager.removePlaying(player);
      throw error;
    });
  }

  pause(): Promise<void> {
    return this._player?.pause() ?? Promise.resolve();
  }

  stop(): Promise<void> {
    if (!this._player) return Promise.resolve();
    audioManager.removePlaying(this._player);
    return this._player.stop();
  }

  playOneShot(clip: AudioClip, volumeScale = 1): void {
    if (!clip._nativeAsset) return;
    void AudioPlayer.loadOneShotAudio(
      clip._nativeAsset.url,
      this._volume * volumeScale,
    ).then((oneShot) => {
      audioManager.discardOnePlayingIfNeeded();
      oneShot.onEnded(() => audioManager.removePlaying(oneShot));
      audioManager.addPlaying(oneShot, true);
      void oneShot.play().catch(() => audioManager.removePlaying(oneShot));
    }).catch((error: unknown) => {
      console.error("One-shot playback failed:", error);
    });
  }
}
