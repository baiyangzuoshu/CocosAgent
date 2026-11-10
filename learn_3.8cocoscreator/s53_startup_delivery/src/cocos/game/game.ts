import { Director } from "./director.ts";

export class Game {
  private onStart?: () => void;

  constructor(
    private readonly write: (message: string) => void,
    private readonly director: Director,
    private readonly launchScene: string,
  ) {}

  async init(): Promise<void> {
    this.write("Game.init: initialize base, infrastructure, and project");
    await Promise.resolve();
    this.write("Game.EVENT_GAME_INITED");
  }

  run(onStart: () => void): void {
    this.onStart = onStart;
    this.write("Game.run: resume frame driver");
  }

  firstTick(): void {
    this.write("Game._updateCallback: load configured launch scene");
    this.director.loadScene(this.launchScene, () => {
      this.write("Game: invoke onStart after scene launch");
      this.onStart?.();
    });
  }
}
