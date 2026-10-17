---
name: cocos2d-x-creator2-comparison
description: Compare or port a game workflow between Cocos2d-x 4.x and Cocos Creator 2.4.x using version-specific source and evidence; not for Creator 2.x-to-3.x migration.
---

# Cocos2d-x 4.x 与 Creator 2.4.x 对照

Use this skill when a task compares, diagnoses, or ports a concrete game behavior between Cocos2d-x 4.x and Cocos Creator 2.4.x. Start from the behavior the game needs, then trace each stack independently. These are different product and project models; do not translate class names one-for-one.

## Identify the project and snapshot

- For Creator, confirm the Creator version and inspect `project.json`, `assets/`, `.meta` files, serialized scenes/Prefabs, scripts, and build settings. The local engine reference is `2.4.15engine/`; the sample project is `2.4.15NewProject/`.
- For Cocos2d-x, confirm the exact checkout/version and inspect `CMakeLists.txt`, templates, `Classes/`, platform launcher, `AppDelegate`, dependency/submodule state, and build options. The local source is `cocos2d-x-4/`; its README and changelog identify the 4.0 line.
- Do not infer that the local source tree contains the full Creator Editor or every upstream Cocos2d-x dependency. State when a conclusion depends on an external Editor, SDK, generated project, submodule, or platform runtime.
- For a runnable comparison, prefer the paired minimal HelloWorld content: Cocos2d-x `templates/cpp-template-default` and Creator `2.4.15NewProject/assets/Scene/Cocos2dComparison.fire`. Read [the demo build notes](../../../cocos2d-x-creator2x-demo.md) before configuring or claiming runtime evidence. This Creator project is also used for Agent work; keep its original scenes and default start-scene setting intact unless the user specifically asks to change them.

## Compare one behavior at a time

1. Restate the visible goal and acceptance evidence, such as “open the first scene and respond to one tap.”
2. Read the relevant version-specific official guide first, then trace the local source from the platform/editor entry point to the resulting state.
3. Keep separate notes for each side: entry point, core objects, ownership/lifecycle, content identity, asynchronous callbacks, platform-specific code, and final observable result.
4. Compare the responsibilities and invariants, not just APIs. Common high-risk boundaries include C++ versus JavaScript, `Ref`/autorelease versus JS object destruction, file/cache loading versus Creator AssetDB/UUID/serialized references, and direct platform/CMake builds versus Creator Editor/Builder workflows.
5. Label evidence as official documented behavior, local source fact, test result, runtime observation, or inference. Mark runtime/platform cases not exercised as unverified.
6. For a port, implement the target stack using its own supported workflow. Preserve the user-visible behavior, then verify compile/build, runtime interaction, content references, and cleanup on the requested platform. Do not claim completion from an API-name match or a desktop/Web-only check.

## Source map

Read only the relevant topics from [the source study plan](../../../cocos2d-x-creator2x-source-study-plan.md), [the current architecture comparison](../../../comparisons/cocos2d-x-4-vs-creator-2.4.md), and the [Cocos2d-x startup slice](../../../cocos2d-x/01-startup-and-frame.md). Useful initial entry points:

- Cocos2d-x startup/template: `cocos2d-x-4/templates/cpp-template-default/Classes/AppDelegate.cpp`, `cocos2d-x-4/cocos/base/CCDirector.cpp`, `cocos2d-x-4/cocos/2d/CCScene.cpp`, `cocos2d-x-4/cocos/2d/CCNode.cpp`.
- Creator startup/runtime: `2.4.15engine/cocos2d/core/CCGame.js`, `2.4.15engine/cocos2d/core/CCDirector.js`, `2.4.15engine/cocos2d/core/CCNode.js`, `2.4.15engine/cocos2d/core/components/CCComponent.js`.
- Cocos2d-x build/docs/tests: `cocos2d-x-4/CMakeLists.txt`, `cocos2d-x-4/templates/`, `cocos2d-x-4/tests/`, and `cocos2d-x-4/README.md`.
- Creator sample content/build: `2.4.15NewProject/assets/`, `2.4.15NewProject/settings/`, and relevant Creator 2.4 manual pages.

## Output

Report the confirmed versions, behavior being compared, source/doc/test/runtime evidence for each side, material differences in project/editor/runtime ownership, the result on the requested platform, and unresolved evidence gaps. Use a table when it clarifies responsibilities; avoid migration recommendations until the project constraints and target platform are known.

This is a research-stage candidate skill. It does not certify that all listed topics or platforms have been run and verified.
