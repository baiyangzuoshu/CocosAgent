---
name: cocos3-engine-build-provenance
description: Diagnose whether a Cocos Creator 3.8 project build uses customized TypeScript or Native engine source, by checking Engine Manager selection and the exact build's generated engine paths.
---

# Diagnose 3.8 engine build provenance

Use when a 3.8 engine change does not appear in a preview or published target. Read the [3.8 custom engine manual](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/engine-customization.html) and the [local source map](../../../3.x/12-editor-extension-and-diagnostics.md).

1. Identify Creator patch version, project, target, build time and whether the change is in `cocos/`, `pal/`, `native/cocos/`, editor integration or build extension. Record TypeScript and Native Engine Manager selection separately.
2. Inspect the **same build's** `build/<target>/cocos.compile.config.json`: `engineInfo.typescript/native` type and path, `buildEngineParam.entry`, and `cocosParams.enginePath/nativeEnginePath` when present. Compare canonical paths with the intended source checkout. Generated config describes that build, not necessarily current editor settings.
3. Use `engine/3.8.7engine/package.json` and `scripts/build-h5-source.js` to understand local engine compilation, and `cocos/`, `pal/`, `native/` for changed implementation. Running the repository build does not switch Creator's Engine Manager automatically.
4. If the symptom is a build hook or template, inspect project `extensions/` and `build-templates/[platform]` and consult the [3.8 build extension](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/custom-build-plugin.html) or [template](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/custom-project-build-template.html) page. The extension builder host is outside this engine repository.
5. Confirm a change by selecting the relevant Custom engine, compiling and restarting as the manual requires, rebuilding the exact target, then comparing new config paths and an identifiable output or runtime marker. Preserve before/after build evidence.

In the [stage 12 trace](../../traces/stage12-engine-provenance.jsonl), the existing Mac package uses built-in TS and Native engine paths; this is a proven negative case for the neighboring checkout, not a statement about future builds. See the [validation record](../editor-extension-diagnostics-validation.md).
