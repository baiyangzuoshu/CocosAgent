import { ERaycast2DType, type QueryFixture, type RaycastResult2D, type Rect } from "./physics-types.ts";
import { Box2DPhysicsWorld } from "../box2d/physics-world.ts";

export class PhysicsSystem2D {
  readonly physicsWorld: Box2DPhysicsWorld;

  constructor(fixtures: QueryFixture[], log: (message: string) => void) {
    this.physicsWorld = new Box2DPhysicsWorld(fixtures, log);
  }

  raycast(p1: { x: number; y: number }, p2: { x: number; y: number }, type = ERaycast2DType.Closest, mask = 0xFFFFFFFF): readonly RaycastResult2D[] {
    return this.physicsWorld.raycast(p1, p2, type, mask);
  }

  testAABB(rect: Rect): readonly string[] {
    return this.physicsWorld.testAABB(rect);
  }

  set debugDrawFlags(value: number) {
    this.physicsWorld.debugDrawFlags = value;
  }

  postUpdate(): void {
    if (this.physicsWorld) this.physicsWorld.drawDebug();
  }
}
