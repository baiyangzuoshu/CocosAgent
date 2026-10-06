---
name: cocos2-startup-trace
description: Trace or diagnose Cocos Creator 2.4.15 engine startup, first scene, and first frame using this workspace's 2.x source. Use for startup order, black screen, missing onStart, or missing frame callbacks in 2.4.15; not for 3.x.
---

# Trace a 2.4.15 startup

Work from the user's observed symptom toward the earliest missing transition. Confirm that the target is `2.4.15engine/` or its paired `2.4.15NewProject/` before applying these source anchors.

- First check the 2.4 official manual for the reported surface: [project structure](https://docs.cocos.com/creator/2.4/manual/zh/getting-started/project-structure.html), [preview versus build](https://docs.cocos.com/creator/2.4/manual/zh/getting-started/basics/preview-build.html), or [public scene loading](https://docs.cocos.com/creator/2.4/manual/zh/scripting/scene-managing.html). Browser preview runs the open scene; confirm whether the report instead concerns Simulator or a build. The manual describes developer behavior, not the internal boot event order.
- For engine assembly, start at `2.4.15engine/index.js`, then `cocos2d/core/predefine.js`, `cocos2d/index.js`, and `extends.js`. Treat module loading separately from `game.run`.
- For boot readiness, follow `cocos2d/core/CCGame.js`: `run` → `_initConfig` → `prepare` → `_prepareFinished` → `_initEngine`/`_setAnimFrame`/builtin assets. Check `EVENT_ENGINE_INITED` and `EVENT_GAME_INITED` separately. `CCDirector.js` registers `director.init` on the former event.
- For a missing frame, follow `CCGame._runMainLoop` → `CCDirector.mainLoop` → `renderer.render`. Check the `CC_EDITOR` branch, `_prepared`, pause state, frame request, active scene, and renderer initialization before inspecting deeper rendering code.
- For a missing first scene in editor browser preview, inspect the page's `settings.js` and `app/editor/static/preview-templates/boot.js`. The boot script waits for plugins and bundles, calls `cc.game.run(option, onStart)`, then `onStart` loads `preview-scene.json` and passes its scene to `director.runSceneImmediate`. Compare `settings/project.json` and scene `.meta` to identify the scene UUID; root `project.json` identifies the project. In a build, inspect that build's actual host script instead of assuming it uses the preview path. Do not substitute the manual's public `cc.director.loadScene(name)` example for this preview host call.
- For precise preview order, compare against [the measured 2.4.15 trace](../../traces/2.4.15-preview-startup.jsonl): `ENGINE_INITED` → `GAME_INITED` → `onStart` → scene launch → first update/draw. The second argument to `runSceneImmediate` is `onBeforeLoadScene`; its callback precedes `EVENT_BEFORE_SCENE_LAUNCH`.

Report the last transition supported by evidence, the next missing transition, and exact source paths and symbols. Distinguish source evidence from observed runtime behavior. If the question needs frame or scene internals beyond startup, continue into those sources instead of assuming this skill's map is complete.

For the current architecture map and its evidence limits, read [2.x startup study](../../../2.x/01-startup-and-frame.md) when needed.
