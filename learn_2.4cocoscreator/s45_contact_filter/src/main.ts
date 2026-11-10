import { PhysicsManager } from "./cocos2d/core/physics/CCPhysicsManager.ts";
import { RigidBody } from "./cocos2d/core/physics/CCRigidBody.ts";
import { PhysicsCollider } from "./cocos2d/core/physics/collider/CCPhysicsCollider.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => {
  output.textContent += `${message}\n`;
};

// group 0 与 group 1 双向允许碰撞，镜像 collisionMatrix 的位掩码。
const collisionMatrix = [
  [false, true],
  [true, false],
];
const manager = new PhysicsManager();
const playerBody = new RigidBody("player", 0, true);
const wallBody = new RigidBody("wall", 1, false);
const player = new PhysicsCollider("player-box", playerBody, collisionMatrix);
const wall = new PhysicsCollider("wall-box", wallBody, collisionMatrix);

playerBody.components.push({
  onBeginContact: (_contact, self, other) => log(`脚本收到 ${self.name} 与 ${other.name} 接触`),
  onPreSolve: (contact) => {
    contact.disabledOnce = true;
    log("脚本在 onPreSolve 设置 disabledOnce");
  },
});
manager.registerContactFixture(player);
log(`filter: player(category=${player.filter.categoryBits}, mask=${player.filter.maskBits})`);
log(`filter: wall(category=${wall.filter.categoryBits}, mask=${wall.filter.maskBits})`);
manager.step(player, wall, log);
