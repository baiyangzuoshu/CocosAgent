import { Game } from "../src/CCGame.ts";
import { Director } from "../src/CCDirector.ts";
import { Node, Scene } from "../src/CCScene.ts";

function equal(actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`期望 ${expected}，实际 ${actual}`);
}

Deno.test("场景激活注册组件；每帧先更新组件再遍历可见节点", () => {
  const log: string[] = [];
  const frames: Array<(now: number) => void> = [];
  const game = new Game({
    frame: {
      now: () => 100,
      requestAnimFrame(fn) {
        frames.push(fn);
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
    createScheduler: () => ({
      update() {
        log.push("scheduler");
      },
    }),
    enableEventManager() {},
    visitRenderNode(node) {
      log.push(`visit:${node.name}`);
    },
    debug: false,
  });
  game.director = director;
  const scene = new Scene("scene"),
    player = new Node("player"),
    hidden = new Node("inactive"),
    transparent = new Node("transparent");
  hidden._active = false;
  transparent._opacity = 0;
  scene.addChild(player);
  scene.addChild(hidden);
  scene.addChild(transparent);
  player.addComponent({
    node: player,
    _objFlags: 0,
    _enabled: true,
    onLoad() {
      log.push("load");
    },
    onEnable() {
      log.push("enable");
    },
    start() {
      log.push("start");
    },
    update(dt) {
      log.push(`update:${dt}`);
    },
    lateUpdate() {
      log.push("late");
    },
    onDisable() {
      log.push("disable");
    },
  });
  transparent.addComponent({
    node: transparent,
    _objFlags: 0,
    _enabled: true,
    update() {
      log.push("transparent-update");
    },
  });
  hidden.addComponent({
    node: hidden,
    _objFlags: 0,
    _enabled: true,
    update() {
      log.push("inactive-update");
    },
  });
  game.run({ frameRate: 60 }, () => director.runSceneImmediate(scene));
  equal(log.join(","), "load,enable");
  frames.shift()!(116);
  equal(
    log.join(","),
    "load,enable,start,transparent-update,update:0.016,scheduler,late,visit:scene,visit:player",
  );
  log.length = 0;
  director._nodeActivator!.activateNode(player, false);
  frames.shift()!(132);
  equal(log.join(","), "disable,transparent-update,scheduler,visit:scene");
});
