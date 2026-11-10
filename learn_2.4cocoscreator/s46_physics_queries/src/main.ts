import { PhysicsManager, DefaultDebugFlags } from "./cocos2d/core/physics/CCPhysicsManager.ts";
import { RayCastType, type QueryFixture } from "./cocos2d/core/physics/CCPhysicsTypes.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => {
  output.textContent += `${message}\n`;
};

const fixtures: QueryFixture[] = [
  { collider: "near-crate", aabb: { minX: 20, minY: 10, maxX: 35, maxY: 30 }, fraction: 0.25, dynamic: true, startsInside: false },
  { collider: "far-wall", aabb: { minX: 55, minY: 10, maxX: 70, maxY: 30 }, fraction: 0.65, dynamic: true, startsInside: false },
  { collider: "static-floor", aabb: { minX: 0, minY: -10, maxX: 100, maxY: 0 }, fraction: 0.9, dynamic: false, startsInside: false },
];
const physics = new PhysicsManager(fixtures, log);
log(`Closest: ${physics.rayCast({ x: 0, y: 20 }, { x: 100, y: 20 }).join(", ")}`);
log(`All: ${physics.rayCast({ x: 0, y: 20 }, { x: 100, y: 20 }, RayCastType.All).join(", ")}`);
log(`testAABB: ${physics.testAABB({ minX: 15, minY: 5, maxX: 40, maxY: 35 }).join(", ")}`);
physics.debugDrawFlags = DefaultDebugFlags;
physics.step();
