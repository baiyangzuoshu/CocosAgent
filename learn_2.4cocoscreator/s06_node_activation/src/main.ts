import cc from "./index.ts";

const status = document.querySelector<HTMLPreElement>("#status");

if (!status) {
  throw new Error("找不到页面状态节点 #status");
}

const NodeClass = cc.Node;
const SceneClass = cc.Scene;

if (!NodeClass || !SceneClass) {
  throw new Error("cc.Node 或 cc.Scene 没有完成注册");
}

type TreeNode = {
  name: string;
  children: readonly TreeNode[];
};

const scene = new SceneClass("MainScene");
const canvas = new NodeClass("Canvas");
const player = new NodeClass("Player");
const weapon = new NodeClass("Weapon");
const world = new NodeClass("World");

canvas.active = false;
canvas.setPosition(100, 50);
player.setPosition(12, 7);
weapon.setPosition(2, 1);

scene.addChild(canvas);
canvas.addChild(player);
player.addChild(weapon);
scene.addChild(world);

const lines: string[] = [];
function appendTree(node: TreeNode, depth = 0): void {
  lines.push(`${"  ".repeat(depth)}${node.name}`);
  for (const child of node.children) {
    appendTree(child, depth + 1);
  }
}

appendTree(scene);
const parentName = player.getParent()?.name ?? "无";
const playerLocal = player.getPosition();
const playerWorld = player.getWorldPosition();
const weaponWorld = weapon.getWorldPosition();

const game = cc.game;
const director = cc.director;
const Director = cc.Director;

if (!game || !director || !Director) {
  throw new Error("cc.game 或 cc.director 没有完成注册");
}

const showResult = (deltaTime: number): void => {
  status.textContent = [
    `帧数: ${director.totalFrames} · deltaTime: ${deltaTime.toFixed(4)}s`,
    `Canvas.active / activeInHierarchy: ${canvas.active} / ${canvas.activeInHierarchy}`,
    `Player.active / activeInHierarchy: ${player.active} / ${player.activeInHierarchy}`,
    `World.activeInHierarchy: ${world.activeInHierarchy}`,
    `Player.parent: ${parentName}`,
    `Player.local: (${playerLocal.x}, ${playerLocal.y})`,
    `Player.world: (${playerWorld.x}, ${playerWorld.y})`,
    `Weapon.world: (${weaponWorld.x}, ${weaponWorld.y})`,
    ...lines,
  ].join("\n");
};

director.on(Director.EVENT_AFTER_UPDATE, showResult);
game.run({ frameRate: 60 }, () => {
  director.runSceneImmediate(scene);
  showResult(0);
});
