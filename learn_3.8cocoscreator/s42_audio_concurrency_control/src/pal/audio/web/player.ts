export enum AudioState {
  INIT = "INIT",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  STOPPED = "STOPPED",
}

export class AudioPlayer {
  static readonly maxAudioChannel = 3;

  private stateValue = AudioState.INIT;
  private endedCallback: (() => void) | null = null;

  private constructor(private readonly element: HTMLAudioElement) {
    this.element.addEventListener("ended", () => {
      this.element.currentTime = 0;
      this.stateValue = AudioState.INIT;
      this.endedCallback?.();
    });
  }

  static load(url: string, volume = 1, loop = false): Promise<AudioPlayer> {
    return new Promise((resolve, reject) => {
      const element = new Audio();
      element.preload = "auto";
      element.volume = volume;
      element.loop = loop;

      const onReady = (): void => {
        element.removeEventListener("canplay", onReady);
        element.removeEventListener("error", onError);
        resolve(new AudioPlayer(element));
      };
      const onError = (): void => {
        element.removeEventListener("canplay", onReady);
        element.removeEventListener("error", onError);
        reject(new Error("Unable to load audio: " + url));
      };

      element.addEventListener("canplay", onReady);
      element.addEventListener("error", onError);
      element.src = url;
      element.load();
    });
  }

  static loadOneShotAudio(url: string, volume: number): Promise<AudioPlayer> {
    return AudioPlayer.load(url, volume, false);
  }

  play(): Promise<void> {
    return this.element.play().then(() => {
      this.stateValue = AudioState.PLAYING;
    });
  }

  pause(): Promise<void> {
    this.element.pause();
    this.stateValue = AudioState.PAUSED;
    return Promise.resolve();
  }

  stop(): Promise<void> {
    this.element.pause();
    this.element.currentTime = 0;
    this.stateValue = AudioState.STOPPED;
    return Promise.resolve();
  }

  onEnded(callback: () => void): void {
    this.endedCallback = callback;
  }

  set loop(value: boolean) {
    this.element.loop = value;
  }

  set volume(value: number) {
    this.element.volume = Math.max(0, Math.min(1, value));
  }

  get state(): AudioState {
    return this.stateValue;
  }

  destroy(): void {
    this.element.pause();
    this.element.removeAttribute("src");
    this.element.load();
  }
}
