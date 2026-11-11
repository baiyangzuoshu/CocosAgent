import { Physics3DManager } from "./3d/physics/framework/physics-manager.ts";

type ScheduledUpdate = { update(deltaTime: number): void };

export class CCDirector {
  private readonly _systemUpdates: ScheduledUpdate[] = [];
  private _physics3DManager: Physics3DManager | null = null;

  constructor(private readonly write: (message: string) => void) {}

  sharedInit(hasPhysicsBackend: boolean): void {
    if (!hasPhysicsBackend) {
      this.write("no 3D physics module in this build");
      return;
    }

    this._physics3DManager = new Physics3DManager(this.write);
    this._systemUpdates.push(this._physics3DManager);
    this.write("schedule Physics3DManager at system priority");
  }

  getPhysics3DManager(): Physics3DManager | null {
    return this._physics3DManager;
  }

  mainLoop(deltaTime: number): void {
    this.write("Director frame delta=" + deltaTime.toFixed(4));
    for (const system of this._systemUpdates) system.update(deltaTime);
  }
}
