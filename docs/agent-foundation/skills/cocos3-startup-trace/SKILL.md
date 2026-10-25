---
name: cocos3-startup-trace
description: Trace or diagnose Cocos Creator 3.8.7 engine startup, launch scene, and first frame using this workspace's 3.x source. Use for init/run order, startup screen, launch-scene, Pacer, or first tick problems in 3.8.7; not for 2.x.
---

# Trace a 3.8.7 startup

Confirm that the target is `engine/3.8.7engine/` or its paired `3.8,7NewProject/`. Identify the runtime platform first: the Web template is an example of the host entry, while native and mini-game templates and pacers differ.

- Check the 3.8 official manual for [project structure](https://docs.cocos.com/creator/3.8/manual/zh/getting-started/project-structure/index.html), [preview mode and scene selection](https://docs.cocos.com/creator/3.8/manual/zh/editor/preview/index.html), [browser preview flow](https://docs.cocos.com/creator/3.8/manual/zh/editor/preview/preview-guid.html), or [public scene loading](https://docs.cocos.com/creator/3.8/manual/zh/scripting/scene-managing.html) as relevant. Browser preview may target a selected scene; "current scene" is only the default. The manual does not specify the internal four-phase event order.
- For a Web build, start at `engine/3.8.7engine/templates/web-desktop/index.js.ejs` and `templates/launcher/application.ejs`; the latter awaits `game.init(...)` before `game.run()`. For editor browser preview, inspect the served `/preview-app/index.js`, `/preview-app/main.js` and settings URL instead. In this current-scene trace, that URL was `settings.js?scene=current_scene`; the preview host cleared `launch.launchScene` in the `game.init` override, then loaded `scene/current_scene.json` in the `game.run` callback and called `runSceneImmediate`. `exports/base.ts` is the engine's base module export.
- The manual calls the generated preview configuration `settings.json`; the captured browser response for this project was `settings.js?scene=current_scene`. Check the actual served response and host script before choosing a URL or diagnosing a missing configuration. Root `package.json` identifies a 3.x project; do not use the 2.4 `project.json` convention.
- In `cocos/game/game.ts`, trace the ordered `init` phases: Base, Infrastructure, Subsystem, Project. Check the phase events/delegates and which dependency becomes available at each boundary. `game.run` only resumes after initialization.
- For no tick, follow `game.resume` → `pal/pacer/` implementation for the chosen platform → `Game._updateCallback`. Distinguish splash-screen update, initial `launch.launchScene` load, and the later `director.tick` path.
- For no scene or draw, follow `cocos/game/director.ts` `loadScene`/`runSceneImmediate`/`tick`, then `cocos/root.ts` `frameMove`. Check the actual served or generated settings and host script; a scene file in `assets/` alone does not establish the launch path.
- For exact preview timing, compare against [the measured 3.8.7 trace](../../traces/3.8.7-preview-startup.jsonl). It records all four pre/post init phases, scene launch and first tick/draw. In this preview, `EVENT_RENDERER_INITED` occurred after `EVENT_ENGINE_INITED`, matching `_setRenderPipeline()` in the Project phase even though the event comment says the reverse.

Report the last transition supported by evidence, the next missing transition, and exact source paths and symbols. Mark whether a conclusion comes from engine source, a build template, a generated project file, or runtime observation. Do not generalize the Web `System.import('cc')` step to native or mini-game startup.

For the current architecture map and its evidence limits, read [3.x startup study](../../../3.x/01-startup-and-frame.md) when needed.
