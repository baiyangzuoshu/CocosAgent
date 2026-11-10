import { ERaycast2DType, type QueryFixture, type RaycastResult2D, type Rect } from "../framework/physics-types.ts";
import { PhysicsAABBQueryCallback, PhysicsRayCastCallback, overlaps } from "./physics-query-callback.ts";
import { PhysicsDebugDraw } from "./physics-debug-draw.ts";

export class Box2DPhysicsWorld {
  private _debugDrawFlags = 0;
  private _debugDraw: PhysicsDebugDraw | null = null;

  constructor(private readonly _fixtures: QueryFixture[], private readonly _log: (message: string) => void) {}

  raycast(p1: { x: number; y: number }, p2: { x: number; y: number }, type: ERaycast2DType, mask: number): RaycastResult2D[] {
    if (p1.x === p2.x && p1.y === p2.y) return [];
    const sorted = [...this._fixtures].sort((a, b) => a.fraction - b.fraction);
    return new PhysicsRayCastCallback(type, mask).collect(sorted);
  }

  testAABB(rect: Rect): string[] {
    return new PhysicsAABBQueryCallback().collect(this._fixtures, rect);
  }

  set debugDrawFlags(value: number) {
    if (!value) {
      this._debugDrawFlags = value;
      this._log("debug Graphics 节点移出 Canvas");
      return;
    }
    this._debugDrawFlags = value;
    this._checkDebugDrawValid();
    this._debugDraw!.flags = value;
  }

  drawDebug(): void {
    if (!this._debugDrawFlags) return;
    this._checkDebugDrawValid();
    this._debugDraw!.clear();
    this._debugDraw!.draw(this._fixtures);
  }

  private _checkDebugDrawValid(): void {
    if (this._debugDraw) return;
    this._debugDraw = new PhysicsDebugDraw(this._log, this._debugDrawFlags);
    this._log("创建 Canvas/Graphics 与 PhysicsDebugDraw");
  }
}
