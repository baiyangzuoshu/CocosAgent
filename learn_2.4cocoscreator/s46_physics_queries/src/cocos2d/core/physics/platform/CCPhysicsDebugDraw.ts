import type { QueryFixture } from "../CCPhysicsTypes.ts";
import { DrawBits } from "../CCPhysicsTypes.ts";

export class PhysicsDebugDraw {
  constructor(private readonly log: (message: string) => void, private _flags: number) {}

  SetFlags(flags: number): void {
    this._flags = flags;
  }

  clear(): void {
    this.log("Graphics.clear()");
  }

  drawFixture(fixture: QueryFixture): void {
    if (this._flags & DrawBits.Shape) this.log(`Graphics.stroke(${fixture.collider} shape)`);
    if (this._flags & DrawBits.AABB) this.log(`Graphics.stroke(${fixture.collider} AABB)`);
  }
}
