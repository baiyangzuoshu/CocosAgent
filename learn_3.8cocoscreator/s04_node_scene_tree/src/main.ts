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

director.on(Director.EVENT_AFTER_UPDATE, () => {
  status.textContent = [
    `帧数: ${director.totalFrames} · deltaTime: ${director.deltaTime.toFixed(4)}s`,
    `Player.parent: ${player.parent?.name ?? "无"}`,
    ...treeLines,
  ].join("\n");
});

await game.init({});
game.run();

status.textContent = `初始化完成，等待首帧……\n${treeLines.join("\n")}`;
