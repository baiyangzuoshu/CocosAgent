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

const game = cc.game;
const director = cc.director;
const Director = cc.Director;

if (!game || !director || !Director) {
  throw new Error("cc.game 或 cc.director 没有完成注册");
}

const showResult = (deltaTime: number): void => {
  status.textContent = [
    `帧数: ${director.totalFrames} · deltaTime: ${deltaTime.toFixed(4)}s`,
    `Player.parent: ${parentName}`,
    ...lines,
  ].join("\n");
};

director.on(Director.EVENT_AFTER_UPDATE, showResult);
game.run({ frameRate: 60 }, () => showResult(0));
