import { DrawBits, RayCastType, type AABB, type QueryFixture } from "./CCPhysicsTypes.ts";
import { PhysicsAABBQueryCallback } from "./platform/CCPhysicsAABBQueryCallback.ts";
import { PhysicsDebugDraw } from "./platform/CCPhysicsDebugDraw.ts";
import { PhysicsRayCastCallback } from "./platform/CCPhysicsRayCastCallback.ts";
import { B2World } from "../../../box2d/b2-world.ts";

export class PhysicsManager {
  private readonly _world: B2World;
  private readonly _aabbQueryCallback = new PhysicsAABBQueryCallback();
  private readonly _raycastQueryCallback = new PhysicsRayCastCallback();
  private _debugDrawer: PhysicsDebugDraw | null = null;
  private _debugDrawFlags = 0;

  constructor(fixtures: QueryFixture[], private readonly log: (message: string) => void) {
    this._world = new B2World(fixtures, log);
  }

  rayCast(p1: { x: number; y: number }, p2: { x: number; y: number }, type = RayCastType.Closest): string[] {
    if (p1.x === p2.x && p1.y === p2.y) return [];
    this._raycastQueryCallback.init(type);
    this._world.RayCast(this._raycastQueryCallback, p1, p2);
    return this._raycastQueryCallback.fixtures.map((fixture) => fixture.collider);
  }

  testAABB(area: AABB): string[] {
    this._aabbQueryCallback.init();
    return this._world.QueryAABB(this._aabbQueryCallback, area).map((fixture) => fixture.collider);
  }

  set debugDrawFlags(flags: number) {
    if (flags && !this._debugDrawFlags) this._checkDebugDrawValid();
    if (!flags && this._debugDrawFlags) this.log("debug drawer node inactive");
    this._debugDrawFlags = flags;
    if (flags) this._debugDrawer?.SetFlags(flags);
  }

  private _checkDebugDrawValid(): void {
    if (!this._debugDrawer) {
      this._debugDrawer = new PhysicsDebugDraw(this.log, this._debugDrawFlags);
      this._world.SetDebugDraw(this._debugDrawer);
      this.log("PhysicsDebugDraw 注册到 Box2D World");
    }
  }

  step(): void {
    if (!this._debugDrawFlags) return;
    this._checkDebugDrawValid();
    this._debugDrawer!.clear();
    this._world.DrawDebugData();
  }
}

export const DefaultDebugFlags = DrawBits.Shape | DrawBits.AABB;
