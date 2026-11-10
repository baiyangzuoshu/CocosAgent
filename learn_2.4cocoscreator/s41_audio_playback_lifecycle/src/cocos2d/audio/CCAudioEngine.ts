import { CCAudio, CCAudioState } from "./CCAudio.ts";
import { CCAudioClip } from "../core/assets/CCAudioClip.ts";

export class CCAudioEngine {
  private nextAudioId = 1;
  private readonly audios = new Map<number, CCAudio>();
  private readonly finishCallbacks = new Map<number, () => void>();

  play(clip: CCAudioClip, loop = false, volume = 1): number {
    const audioId = this.nextAudioId++;
    console.info("cc.audioEngine.play:", clip.nativeUrl);
    const audio = new CCAudio(clip, () => this.finish(audioId));
    this.audios.set(audioId, audio);
    void audio.play(loop, volume).catch((error: unknown) => {
      console.error("Audio playback failed:", error);
      this.audios.delete(audioId);
    });
    return audioId;
  }

  setFinishCallback(audioId: number, callback: () => void): void {
    if (this.audios.has(audioId)) this.finishCallbacks.set(audioId, callback);
  }

  pause(audioId: number): boolean {
    const audio = this.audios.get(audioId);
    if (!audio) return false;
    audio.pause();
    return true;
  }

  resume(audioId: number): Promise<void> {
    const audio = this.audios.get(audioId);
    return audio ? audio.resume() : Promise.resolve();
  }

  stop(audioId: number): boolean {
    const audio = this.audios.get(audioId);
    if (!audio) return false;
    audio.stop();
    this.audios.delete(audioId);
    this.finishCallbacks.delete(audioId);
    return true;
  }

  getState(audioId: number): CCAudioState | "ERROR" {
    return this.audios.get(audioId)?.state ?? "ERROR";
  }

  private finish(audioId: number): void {
    this.finishCallbacks.get(audioId)?.();
    this.finishCallbacks.delete(audioId);
    this.audios.delete(audioId);
  }
}

export const audioEngine = new CCAudioEngine();
