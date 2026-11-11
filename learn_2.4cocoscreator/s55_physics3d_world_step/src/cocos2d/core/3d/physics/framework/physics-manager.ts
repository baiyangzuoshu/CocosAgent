import { createPhysicsWorld } from "./physics-selector.ts";
import type { IPhysicsWorld } from "../spec/i-physics-world.ts";

export class Physics3DManager {
  readonly physicsWorld: IPhysicsWorld;
  enabled = false;
  readonly deltaTime = 1 / 60;

  constructor(private readonly write: (message: string) => void) {
    this.physicsWorld = createPhysicsWorld();
  }

  update(_frameDelta: number): void {
    if (!this.enabled) {
      this.write("Physics3DManager skipped: disabled");
      return;
    }

    this.write("EVENT_BEFORE_PHYSICS");
    this.physicsWorld.step(this.deltaTime);
    this.write("EVENT_AFTER_PHYSICS");
  }
}
