import type { IPhysicsWorld } from "../spec/i-physics-world.ts";

export class BulletWorld implements IPhysicsWorld {
  constructor(private readonly write: (message: string) => void) {}

  syncSceneToPhysics(): void {
    this.write("syncSceneToPhysics");
  }

  step(fixedTimeStep: number): void {
    this.write("BulletWorld.step(" + fixedTimeStep.toFixed(4) + ")");
  }

  emitEvents(): void {
    this.write("emitEvents");
  }

  syncAfterEvents(): void {
    this.write("syncAfterEvents");
  }
}
