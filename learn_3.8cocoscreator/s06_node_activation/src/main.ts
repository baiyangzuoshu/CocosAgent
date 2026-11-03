import { Director, director, game, Node, Scene } from "./exports/base.ts";

const status = document.querySelector<HTMLPreElement>("#status");

if (!status) {
  throw new Error("找不到页面状态节点 #status");
}

const scene = new Scene("MainScene");
const canvas = new Node("Canvas");
const player = new Node("Player");
const weapon = new Node("Weapon");
const world = new Node("World");

canvas.active = false;
canvas.setPosition(100, 50);
player.setPosition(12, 7);
weapon.setPosition(2, 1);

scene.addChild(canvas);
canvas.addChild(player);
player.addChild(weapon);
scene.addChild(world);

const treeLines: string[] = [];
function appendTree(node: Node, depth = 0): void {
  treeLines.push(`${"  ".repeat(depth)}${node.name}`);
  for (const child of node.children) {
    appendTree(child, depth + 1);
  }
}
appendTree(scene);
const playerLocal = player.getPosition();
const playerWorld = player.worldPosition;
const weaponWorld = weapon.worldPosition;

director.on(Director.EVENT_AFTER_UPDATE, () => {
  status.textContent = [
    `帧数: ${director.totalFrames} · deltaTime: ${director.deltaTime.toFixed(4)}s`,
    `Canvas.active / activeInHierarchy: ${canvas.active} / ${canvas.activeInHierarchy}`,
    `Player.active / activeInHierarchy: ${player.active} / ${player.activeInHierarchy}`,
    `World.activeInHierarchy: ${world.activeInHierarchy}`,
    `Player.parent: ${player.parent?.name ?? "无"}`,
    `Player.local: (${playerLocal.x}, ${playerLocal.y}, ${playerLocal.z})`,
    `Player.world: (${playerWorld.x}, ${playerWorld.y}, ${playerWorld.z})`,
    `Weapon.world: (${weaponWorld.x}, ${weaponWorld.y}, ${weaponWorld.z})`,
    ...treeLines,
  ].join("\n");
});

await game.init({});
director.runSceneImmediate(scene);
game.run();

status.textContent = `初始化完成，等待首帧……\n${treeLines.join("\n")}`;
