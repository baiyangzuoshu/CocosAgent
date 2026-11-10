import { ERaycast2DType, type QueryFixture } from "./cocos/physics-2d/framework/physics-types.ts";
import { PhysicsSystem2D } from "./cocos/physics-2d/framework/physics-system.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => {
  output.textContent += `${message}\n`;
};

const fixtures: QueryFixture[] = [
  { collider: "near-crate", category: 1, aabb: { minX: 20, minY: 10, maxX: 35, maxY: 30 }, fraction: 0.25, startsInside: false },
  { collider: "far-wall", category: 2, aabb: { minX: 55, minY: 10, maxX: 70, maxY: 30 }, fraction: 0.65, startsInside: false },
  { collider: "start-inside", category: 1, aabb: { minX: -5, minY: 10, maxX: 5, maxY: 30 }, fraction: 0, startsInside: true },
];
const physics = new PhysicsSystem2D(fixtures, log);
log(`Closest: ${physics.raycast({ x: 0, y: 20 }, { x: 100, y: 20 }).map((hit) => hit.collider).join(", ")}`);
log(`mask=2: ${physics.raycast({ x: 0, y: 20 }, { x: 100, y: 20 }, ERaycast2DType.All, 2).map((hit) => hit.collider).join(", ")}`);
log(`testAABB: ${physics.testAABB({ minX: 15, minY: 5, maxX: 40, maxY: 35 }).join(", ")}`);
physics.debugDrawFlags = 1;
physics.postUpdate();
