export class AudioPlayer {
  private constructor(private readonly _element: HTMLAudioElement) {}

  static load(url: string): Promise<AudioPlayer> {
    return new Promise((resolve, reject) => {
      const element = new Audio();
      element.preload = "auto";

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

  play(): Promise<void> {
    this._element.currentTime = 0;
    return this._element.play();
  }

  destroy(): void {
    this._element.pause();
    this._element.removeAttribute("src");
    this._element.load();
  }
}
