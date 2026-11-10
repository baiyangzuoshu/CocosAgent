import CCActionManager from "../actions/CCActionManager.ts";
import CCScheduler from "./CCScheduler.ts";

export default class CCDirector {
  private readonly scheduler: CCScheduler;
  private readonly actionManager: CCActionManager;

  constructor(private readonly report: (message: string) => void) {
    this.scheduler = new CCScheduler(report);
    this.actionManager = new CCActionManager(report);
    this.scheduler.scheduleUpdate(this.actionManager);
  }

  mainLoop(dt: number): void {
    this.report("CCDirector.mainLoop");
    this.scheduler.update(dt);
  }

  getActionManager(): CCActionManager {
    return this.actionManager;
  }
}
