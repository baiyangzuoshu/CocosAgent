import type { IPhysicsWorld } from "../spec/i-physics-world.ts";

type PhysicsWorldFactory = () => IPhysicsWorld;

let worldFactory: PhysicsWorldFactory | null = null;

export function instantiate(factory: PhysicsWorldFactory): void {
  worldFactory = factory;
}

export function createPhysicsWorld(): IPhysicsWorld {
  if (!worldFactory) throw new Error("No physics backend was installed");
  return worldFactory();
}
