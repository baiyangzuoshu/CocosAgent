export class DemoPhysicsWorld {
  stepCount = 0;

  syncSceneToPhysics(log: (message: string) => void): void {
    log("PhysicsWorld.syncSceneToPhysics");
  }

  step(
    timeStep: number,
    velocityIterations: number,
    positionIterations: number,
    log: (message: string) => void,
  ): void {
    this.stepCount += 1;
    log(
      "PhysicsWorld.step(" +
        timeStep.toFixed(4) +
        ", " +
        velocityIterations +
        ", " +
        positionIterations +
        ") #" +
        this.stepCount,
    );
  }

  syncPhysicsToScene(log: (message: string) => void): void {
    log("PhysicsWorld.syncPhysicsToScene");
  }
}
