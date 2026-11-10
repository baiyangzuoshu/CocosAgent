import type { AABB, QueryFixture } from "../CCPhysicsTypes.ts";

export class PhysicsAABBQueryCallback {
  private _point: { x: number; y: number } | null = null;
  readonly fixtures: QueryFixture[] = [];

  init(point?: { x: number; y: number }): void {
    this._point = point ?? null;
    this.fixtures.length = 0;
  }

  ReportFixture(fixture: QueryFixture): boolean {
    if (!fixture.dynamic) return true;
    if (this._point) {
      const { x, y } = this._point;
      const contains = x >= fixture.aabb.minX && x <= fixture.aabb.maxX
        && y >= fixture.aabb.minY && y <= fixture.aabb.maxY;
      if (!contains) return true;
      this.fixtures.push(fixture);
      return false;
    }
    this.fixtures.push(fixture);
    return true;
  }

  queryCandidates(fixtures: QueryFixture[], area: AABB): QueryFixture[] {
    for (const fixture of fixtures) {
      const overlaps = fixture.aabb.minX <= area.maxX && fixture.aabb.maxX >= area.minX
        && fixture.aabb.minY <= area.maxY && fixture.aabb.maxY >= area.minY;
      if (overlaps && !this.ReportFixture(fixture)) break;
    }
    return this.fixtures;
  }
}
