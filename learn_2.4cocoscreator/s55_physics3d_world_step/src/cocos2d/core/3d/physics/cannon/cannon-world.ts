import type { IPhysicsWorld } from "../spec/i-physics-world.ts";

export class CannonWorld implements IPhysicsWorld {
  constructor(private readonly write: (message: string) => void) {}

  step(deltaTime: number): void {
    this.write("syncSceneToPhysics");
    this.write("CANNON.World.step(" + deltaTime.toFixed(4) + ")");
    this.write("syncPhysicsToScene");
    this.write("emitEvents");
  }
}
