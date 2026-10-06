---
name: cocos2-engine-build-provenance
description: Diagnose whether a Cocos Creator 2.4 project preview or build uses a neighboring customized 2.x JavaScript engine, and locate engine compilation versus Editor build boundaries.
---

# Diagnose 2.4 engine build provenance

Use when a 2.4 source change seems absent from a project preview or published package. Read the [2.4 custom engine manual](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/engine-customization.html) and the [local source map](../../../2.x/12-editor-extension-and-diagnostics.md).

1. Record the exact Creator patch version, project, target, preview/build time and whether the changed file is JS engine, Cocos2d-x, adapter or editor extension. These require different build paths.
2. For JS engine, locate changed symbols under `2.4.15engine/cocos2d/`; inspect `gulpfile.js`/`gulp/tasks/engine.js` for the relevant compiled artifact. Record the compile command and artifact path. Compilation alone does not bind the project to this engine.
3. Inspect the project's custom engine setting in Creator and the matching build log or identifiable artifact marker. Treat `local/builder.json`, `settings/builder.json` and generated `build/` as evidence of their specific scope. If none records the engine path, report provenance **unresolved**.
4. If the issue is instead an extension or build template, route to `packages/`, `build-templates/[platform]` and the [2.4 build template/event manual](https://docs.cocos.com/creator/2.4/manual/zh/publish/custom-project-build-template.html). The editor host and `Editor.Builder` implementation are not in this engine snapshot.
5. To confirm a fix, use the matching 2.4 Creator, compile the changed engine, select its path, rebuild the target and check a distinct runtime or artifact marker. Retain before/after paths and logs. Do not modify generated caches as the source fix.

This project's [stage 12 read-only trace](../../traces/stage12-engine-provenance.jsonl) is the unresolved example; it does not prove the old Mac package's engine source. See the [validation record](../editor-extension-diagnostics-validation.md).
