import type { QueryFixture } from "../framework/physics-types.ts";

export class PhysicsDebugDraw {
  constructor(private readonly _log: (message: string) => void, public flags: number) {}

  clear(): void {
    this._log("Graphics.clear()");
  }

  draw(fixtures: QueryFixture[]): void {
    for (const fixture of fixtures) this._log(`Graphics.stroke(${fixture.collider} shape)`);
  }
}
