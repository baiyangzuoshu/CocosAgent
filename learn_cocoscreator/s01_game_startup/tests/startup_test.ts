import { type FrameDriver, Game } from "../src/CCGame.ts";
import { Director } from "../src/CCDirector.ts";
import { NodeActivator } from "../src/NodeActivator.ts";
import { Node, Scene } from "../src/CCScene.ts";

function equal(actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`期望 ${expected}，实际 ${actual}`);
}

function setup(frameRate = 60) {
  const log: string[] = [];
  const frames: Array<(now: number) => void> = [];
  let finishBuiltins: (() => void) | undefined;
  const frame: FrameDriver = {
    now: () => 100,
    requestAnimFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
  };
  const game = new Game({
    frame,
    initRenderer() {
      log.push("renderer");
    },
    initEvents() {
      log.push("events");
    },
    initBuiltins(done) {
      log.push("builtins");
      finishBuiltins = done;
    },
    setDisplayStats() {
      log.push("stats");
    },
  });
  const director = new Director(game, {
    now: () => 100,
    createScheduler() {
      log.push("scheduler");
      return { update() {} };
    },
    enableEventManager() {
      log.push("eventManager");
    },
    visitRenderNode() {},
    debug: false,
  });
  game.director = director;
  game.once(game.EVENT_GAME_INITED, () => {
    equal(frames.length, 1); // 调度先于 EVENT_GAME_INITED。
    log.push("game_inited");
  });
  const scene = new Scene("scene");
  const child = new Node("child");
  scene.addChild(child);
  child.addComponent({
    node: child,
    _objFlags: 0,
    _enabled: true,
    update(dt) {
      equal(frames.length, 1); // mainLoop 之前已注册下一次帧回调。
      log.push(`update:${dt}`);
    },
  });
  game.run({ frameRate }, () => {
    log.push("onStart");
    director.runSceneImmediate(scene);
  });
  return { game, director, log, frames, finish: () => finishBuiltins!() };
}

Deno.test("初始化事件驱动 Director，内置资源完成后才安排主循环", () => {
  const s = setup();
  equal(
    s.log.join(","),
    "renderer,events,scheduler,eventManager,builtins",
  );
  equal(s.game._prepared, false);
  equal(s.director._nodeActivator instanceof NodeActivator, true);
  equal(s.director._scene, null);
  equal(s.frames.length, 0);
  s.finish();
  equal(s.log.slice(-3).join(","), "stats,game_inited,onStart");
  equal(s.game._prepared, true);
  equal(s.game._paused, false);
  s.frames.shift()!(116);
  equal(s.log.at(-1), "update:0.016");
  equal(s.frames.length, 1); // 执行 mainLoop 前已安排下一次回调。
});

Deno.test("Web 30 FPS 分支交替跳过浏览器回调", () => {
  const s = setup(30);
  s.finish();
  s.frames.shift()!(116);
  s.frames.shift()!(132);
  s.frames.shift()!(148);
  equal(
    s.log.filter((value) => value.startsWith("update:")).join(","),
    "update:0.016,update:0.032",
  );
});

Deno.test("Director 暂停时继续接收帧但不执行组件 update", () => {
  const s = setup();
  s.finish();
  s.director._paused = true;
  s.frames.shift()!(116);
  equal(s.log.some((value) => value.startsWith("update:")), false);
  equal(s.frames.length, 1);
  s.director._paused = false;
  s.frames.shift()!(132);
  equal(s.log.at(-1), "update:0.016");
});

Deno.test("已准备时 prepare 直接执行回调；晚注册的初始化监听立即执行", () => {
  const s = setup();
  s.finish();
  let calls = 0;
  s.game.prepare(() => calls++);
  s.game.once(s.game.EVENT_ENGINE_INITED, () => calls++);
  s.game.once(s.game.EVENT_GAME_INITED, () => calls++);
  equal(calls, 3);
  equal(s.log.filter((value) => value === "renderer").length, 1);
});
