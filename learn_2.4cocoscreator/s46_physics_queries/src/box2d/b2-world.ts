import type { AABB, QueryFixture } from "../cocos2d/core/physics/CCPhysicsTypes.ts";
import type { PhysicsRayCastCallback } from "../cocos2d/core/physics/platform/CCPhysicsRayCastCallback.ts";
import type { PhysicsAABBQueryCallback } from "../cocos2d/core/physics/platform/CCPhysicsAABBQueryCallback.ts";
import type { PhysicsDebugDraw } from "../cocos2d/core/physics/platform/CCPhysicsDebugDraw.ts";

export class B2World {
  private _debugDraw: PhysicsDebugDraw | null = null;

  constructor(readonly fixtures: QueryFixture[], private readonly log: (message: string) => void) {}

  RayCast(callback: PhysicsRayCastCallback, _p1: { x: number; y: number }, _p2: { x: number; y: number }): void {
    let maxFraction = 1;
    for (const fixture of [...this.fixtures].sort((a, b) => a.fraction - b.fraction)) {
      if (fixture.startsInside || fixture.fraction > maxFraction) continue;
      maxFraction = callback.ReportFixture(fixture);
      if (maxFraction === 0) break;
    }
  }

  QueryAABB(callback: PhysicsAABBQueryCallback, area: AABB): QueryFixture[] {
    return callback.queryCandidates(this.fixtures, area);
  }

  SetDebugDraw(draw: PhysicsDebugDraw): void {
    this._debugDraw = draw;
  }

  DrawDebugData(): void {
    for (const fixture of this.fixtures) this._debugDraw?.drawFixture(fixture);
  }

  debugLog(message: string): void {
    this.log(message);
  }
}
