import type { IPhysicsWorld } from "../spec/i-physics-world.ts";

type WorldFactory = () => IPhysicsWorld;

const backends = new Map<string, WorldFactory>();
let selectedBackend = "";

export function register(id: string, factory: WorldFactory): void {
  backends.set(id, factory);
  if (!selectedBackend) selectedBackend = id;
}

export function constructDefaultWorld(): IPhysicsWorld {
  const factory = backends.get(selectedBackend);
  if (!factory) throw new Error("No physics backend was registered");
  return factory();
}
