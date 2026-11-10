export class CCGame {
  constructor(private readonly write: (message: string) => void) {}

  run(config: { frameRate: number }, onStart: () => void): void {
    this.write("CCGame.run: initialize config at " + config.frameRate + " FPS");
    this._prepareFinished(onStart);
  }

  private _prepareFinished(onStart: () => void): void {
    this.write("CCGame._prepareFinished: initialize engine");
    this.write("CCGame._prepareFinished: initialize built-in assets");
    this.write("CCGame._prepareFinished: start main loop");
    this.write("CCGame.EVENT_GAME_INITED");
    onStart();
  }
}
