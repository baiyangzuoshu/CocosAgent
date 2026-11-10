import { RayCastType, type QueryFixture } from "../CCPhysicsTypes.ts";

export class PhysicsRayCastCallback {
  private _type = RayCastType.Closest;
  readonly fixtures: QueryFixture[] = [];

  init(type: RayCastType): void {
    this._type = type;
    this.fixtures.length = 0;
  }

  ReportFixture(fixture: QueryFixture): number {
    if (fixture.startsInside) return -1;
    if (this._type === RayCastType.Closest) {
      this.fixtures[0] = fixture;
      return fixture.fraction;
    }
    this.fixtures.push(fixture);
    if (this._type === RayCastType.Any) return 0;
    return 1;
  }
}
