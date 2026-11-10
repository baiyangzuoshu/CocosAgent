import CCActionManager from "../actions/CCActionManager.ts";
import CCScheduler from "./CCScheduler.ts";

export default class CCDirector {
  private readonly scheduler = new CCScheduler();
  private readonly actionManager = new CCActionManager();

  constructor() {
    this.scheduler.scheduleUpdate(this.actionManager);
  }

  mainLoop(dt: number): void {
    this.scheduler.update(dt);
  }

  getActionManager(): CCActionManager {
    return this.actionManager;
  }
}
