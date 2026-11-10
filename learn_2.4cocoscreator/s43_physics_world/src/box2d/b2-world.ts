export class DemoBox2DWorld {
  stepCount = 0;

  Step(
    timeStep: number,
    velocityIterations: number,
    positionIterations: number,
    log: (message: string) => void,
  ): void {
    this.stepCount += 1;
    log(
      "Box2D World.Step(" +
        timeStep.toFixed(4) +
        ", " +
        velocityIterations +
        ", " +
        positionIterations +
        ") #" +
        this.stepCount,
    );
  }
}
