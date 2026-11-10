import { PhysicsSystem2D } from "./cocos/physics-2d/framework/physics-system.ts";
import { RigidBody2D } from "./cocos/physics-2d/framework/rigid-body-2d.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => {
  output.textContent += `${message}\n`;
};

// Creator 3.8 使用位标记作为组号；矩阵值是允许接触的类别位。
const system = new PhysicsSystem2D({ 1: 2, 2: 1 });
const playerBody = new RigidBody2D("player", 1, true);
const wallBody = new RigidBody2D("wall", 2, false);
const player = system.createCollider("player-box", 1, playerBody);
const wall = system.createCollider("wall-box", 1, wallBody);

player.listeners.push((type, self, other, contact) => {
  if (type === "begin-contact") log(`Collider.emit: ${self.name} 接触 ${other.name}`);
  if (type === "pre-solve") {
    contact.disabledOnce = true;
    log("脚本在 pre-solve 设置 disabledOnce");
  }
});
log(`filter: player(category=1, mask=${system.collisionMatrix[1]})`);
log(`filter: wall(category=2, mask=${system.collisionMatrix[2]})`);
system.physicsWorld.step(player, wall, log);
