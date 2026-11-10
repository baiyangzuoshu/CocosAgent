import { ERaycast2DType, type QueryFixture, type RaycastResult2D, type Rect } from "../framework/physics-types.ts";

export class PhysicsRayCastCallback {
  constructor(private readonly _type: ERaycast2DType, private readonly _mask: number) {}

  collect(fixtures: QueryFixture[]): RaycastResult2D[] {
    const hits: RaycastResult2D[] = [];
    for (const fixture of fixtures) {
      if (fixture.startsInside || (fixture.category & this._mask) === 0) continue;
      hits.push({ collider: fixture.collider, fraction: fixture.fraction });
      if (this._type === ERaycast2DType.Any) break;
      if (this._type === ERaycast2DType.Closest) break;
    }
    return hits;
  }
}

export class PhysicsAABBQueryCallback {
  collect(fixtures: QueryFixture[], rect: Rect): string[] {
    return fixtures.filter((fixture) => overlaps(fixture.aabb, rect)).map((fixture) => fixture.collider);
  }
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}
