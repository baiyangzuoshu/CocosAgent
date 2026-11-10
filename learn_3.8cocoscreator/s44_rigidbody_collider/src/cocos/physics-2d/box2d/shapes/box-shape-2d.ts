import type { BoxCollider2D } from "../../framework/components/colliders/box-collider-2d.ts";
import type { Collider2D } from "../../framework/components/colliders/collider-2d.ts";
import type { PhysicsSystem2D } from "../../framework/physics-system.ts";
import { PHYSICS_2D_PTM_RATIO } from "../../framework/physics-types.ts";
import { DemoPolygonShape } from "../runtime.ts";

export class b2BoxShape {
  collider!: Collider2D;

  constructor(private readonly log: (message: string) => void) {}

  initialize(collider: Collider2D): void {
    this.collider = collider;
  }

  apply(system: PhysicsSystem2D): void {
    const body = this.collider.body?.impl?.implBody ?? system.physicsWorld.groundBody;
    const { width, height } = (this.collider as BoxCollider2D).size;
    const scale = this.collider.node.worldScale;
    const shape = new DemoPolygonShape().SetAsBox(
      width / 2 / PHYSICS_2D_PTM_RATIO * Math.abs(scale.x),
      height / 2 / PHYSICS_2D_PTM_RATIO * Math.abs(scale.y),
    );
    body.CreateFixture({ shape, density: this.collider.density, friction: this.collider.friction, restitution: this.collider.restitution }, this.log);
  }
}
