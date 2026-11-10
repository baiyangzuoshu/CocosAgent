import { AudioPlayer } from "../../pal/audio/web/player.ts";

interface PlayingAudio {
  audio: AudioPlayer;
  oneShot: boolean;
  playTime: number;
}

export class AudioManager {
  private readonly playing: PlayingAudio[] = [];

  addPlaying(audio: AudioPlayer, oneShot: boolean): void {
    const existing = this.playing.find((item) => item.audio === audio);
    if (existing) {
      existing.playTime = performance.now();
      return;
    }
    this.playing.push({ audio, oneShot, playTime: performance.now() });
  }

  removePlaying(audio: AudioPlayer): void {
    const index = this.playing.findIndex((item) => item.audio === audio);
    if (index !== -1) this.playing.splice(index, 1);
  }

  discardOnePlayingIfNeeded(): void {
    if (this.playing.length < AudioPlayer.maxAudioChannel) return;
    const oneShots = this.playing.filter((item) => item.oneShot);
    const candidates = oneShots.length > 0 ? oneShots : this.playing;
    const oldest = candidates.reduce((previous, current) =>
      current.playTime < previous.playTime ? current : previous
    );
    void oldest.audio.stop();
    this.removePlaying(oldest.audio);
  }

  get activeCount(): number {
    return this.playing.length;
  }
}

export const audioManager = new AudioManager();
