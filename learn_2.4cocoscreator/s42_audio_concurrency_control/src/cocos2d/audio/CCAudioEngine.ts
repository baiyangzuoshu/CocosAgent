import { CCAudio } from "./CCAudio.ts";
import { CCAudioClip } from "../core/assets/CCAudioClip.ts";

type AudioGroup = "music" | "effect";

interface AudioInstance {
  audio: CCAudio;
  clip: CCAudioClip;
  group: AudioGroup;
}

export class CCAudioEngine {
  private nextAudioId = 1;
  private readonly audios = new Map<number, AudioInstance>();
  private musicAudioId: number | null = null;
  private musicVolume = 0.4;
  private effectsVolume = 0.8;

  playMusic(clip: CCAudioClip, loop = true): number {
    this.stopMusic();
    this.musicAudioId = this.play(clip, loop, this.musicVolume, "music");
    return this.musicAudioId;
  }

  playEffect(clip: CCAudioClip, loop = false): number {
    return this.play(clip, loop, this.effectsVolume, "effect");
  }

  setMusicVolume(volume: number): number {
    this.musicVolume = this.clamp(volume);
    if (this.musicAudioId !== null) {
      this.audios.get(this.musicAudioId)?.audio.setVolume(this.musicVolume);
    }
    return this.musicVolume;
  }

  setEffectsVolume(volume: number): number {
    this.effectsVolume = this.clamp(volume);
    for (const instance of this.audios.values()) {
      if (instance.group === "effect") {
        instance.audio.setVolume(this.effectsVolume);
      }
    }
    return this.effectsVolume;
  }

  stopMusic(): void {
    if (this.musicAudioId === null) return;
    this.stop(this.musicAudioId);
    this.musicAudioId = null;
  }

  stopAllEffects(): void {
    for (const [audioId, instance] of this.audios) {
      if (instance.group === "effect") this.stop(audioId);
    }
  }

  uncache(clip: CCAudioClip): void {
    for (const [audioId, instance] of this.audios) {
      if (instance.clip.nativeUrl === clip.nativeUrl) this.stop(audioId);
    }
  }

  private play(
    clip: CCAudioClip,
    loop: boolean,
    volume: number,
    group: AudioGroup,
  ): number {
    const audioId = this.nextAudioId++;
    const audio = new CCAudio(clip, () => this.finish(audioId));
    this.audios.set(audioId, { audio, clip, group });
    void audio.play(loop, volume).catch((error: unknown) => {
      console.error("Audio playback failed:", error);
      this.finish(audioId);
    });
    return audioId;
  }

  private stop(audioId: number): void {
    const instance = this.audios.get(audioId);
    if (!instance) return;
    instance.audio.stop();
    this.audios.delete(audioId);
    if (this.musicAudioId === audioId) this.musicAudioId = null;
  }

  private finish(audioId: number): void {
    this.audios.delete(audioId);
    if (this.musicAudioId === audioId) this.musicAudioId = null;
  }

  private clamp(volume: number): number {
    return Math.max(0, Math.min(1, volume));
  }
}

export const audioEngine = new CCAudioEngine();
