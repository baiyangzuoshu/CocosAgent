import { Game } from "./CCGame.ts";
import { Director } from "./CCDirector.ts";
import { Node, Scene } from "./CCScene.ts";

// 模拟浏览器帧队列；真实浏览器由 requestAnimationFrame 调用。
const frames: Array<(now: number) => void> = [];
const game = new Game({
  frame: {
    now: () => 100,
    requestAnimFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
  },
  initRenderer() {},
  initEvents() {},
  initBuiltins(done) {
    done();
  },
  setDisplayStats() {},
});
const director = new Director(game, {
  now: () => 100,
  createScheduler: () => ({ update(_dt: number) {} }), // Scheduler 的具体任务留空。
  enableEventManager() {},
  visitRenderNode(node) {
    console.log(`渲染流程访问 ${node.name}`);
  },
  debug: false,
});
game.director = director;

const scene = new Scene("Scene");
const player = new Node("Player");
scene.addChild(player);
// 组件挂在节点上；场景激活后，调度器才会将 update 加入每帧队列。
player.addComponent({
  node: player,
  _objFlags: 0,
  _enabled: true,
  update(dt) {
    console.log(`Player.update(${dt})`);
  },
});

// 编号 1–24 追踪本示例：场景在 onStart 中同步激活，然后收到帧回调。
// 真实 Bundle 异步加载时，第一帧与场景激活的先后可能不同。
// 1. 以启动回调代替真实 Bundle 异步加载，进入 Game.run。
game.run({ frameRate: 60 }, () => director.runSceneImmediate(scene));
// 模拟两次浏览器回调，时间戳间隔各为 16 毫秒。
frames.shift()!(116);
frames.shift()!(132);
