import { DemoBox2DWorld } from "../../../box2d/b2-world.ts";

export class PhysicsManager {
  enabled = false;
  enabledAccumulator = false;
  fixedTimeStep = 1 / 60;
  maxAccumulator = 1 / 5;
  private accumulator = 0;
  private world: DemoBox2DWorld | null = null;

  constructor(private readonly log: (message: string) => void) {}

  setEnabled(value: boolean): void {
    if (value && !this.world) {
      this.log("enabled=true：延迟创建 Box2D World，gravity=(0, -10)");
      this.world = new DemoBox2DWorld();
    }
    this.enabled = value;
    this.log("PhysicsManager.enabled=" + value);
  }

  update(dt: number): void {
    if (!this.world || !this.enabled) return;

    if (!this.enabledAccumulator) {
      this.world.Step(1 / 60, 10, 10, this.log);
      return;
    }

    this.accumulator = Math.min(this.accumulator + dt, this.maxAccumulator);
    while (this.accumulator > this.fixedTimeStep) {
      this.world.Step(this.fixedTimeStep, 10, 10, this.log);
      this.accumulator -= this.fixedTimeStep;
    }
    this.log("PhysicsManager.update：accumulator=" + this.accumulator.toFixed(4));
  }
}
