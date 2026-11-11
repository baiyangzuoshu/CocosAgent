export interface IPhysicsWorld {
  syncSceneToPhysics(): void;
  step(fixedTimeStep: number): void;
  emitEvents(): void;
  syncAfterEvents(): void;
}
