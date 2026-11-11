import { PhysicsSystem } from "../physics/framework/physics-system.ts";

export class CCDirector {
  private physicsSystem: PhysicsSystem | null = null;

  constructor(private readonly write: (message: string) => void) {}

  init(): void {
    this.physicsSystem = new PhysicsSystem(this.write);
    this.write("register PhysicsSystem after Director INIT");
  }

  tick(deltaTime: number): void {
    this.write("component update → lateUpdate → destroy");
    this.physicsSystem?.postUpdate(deltaTime);
  }
}
