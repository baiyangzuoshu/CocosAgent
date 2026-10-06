---
name: cocos3-native-profiler-diagnostic
description: Diagnose Cocos Creator 3.8 native Profiler instrumentation and compile failures, separating its C++ macros from the game runtime FPS overlay and checking the engine actually used by the build.
---

# Diagnose the 3.8 native Profiler

Use for a 3.8 native target when `CC_PROFILE*` instrumentation fails to compile or expected C++ statistics do not appear. Read the [3.8 native Profiler manual](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/profiler.html) and this workspace's [source map](../../../3.x/12-editor-extension-and-diagnostics.md).

1. Identify the target and symptom. `cocos/profiler/profiler.ts::showStats` is the game runtime overlay; `native/cocos/profiler/Profiler.h` defines the C++ instrumentation macros. A Web preview cannot validate the latter.
2. For a native instrumentation compile error, record `CC_USE_PROFILER`, platform predefines, the exact macro invocation and first compiler diagnostic. Check `native/cocos/base/Config.h` and expand the relevant macro in `Profiler.h` before investigating the broader build. The 3.8.7 checkout contained a `C_PROFILER` typo in `CC_PROFILE_OBJECT_INC`; it was fixed here and checked with the [focused fixture](../../probes/stage12-profiler-object-inc.cpp).
3. Reproduce with the smallest translation unit and both macro states. Use the [recorded Clang command and result](../../traces/stage12-profiler-macro.jsonl) as the Mac example; adapt include paths and platform definitions to the actual native target. A syntax pass does not establish linking or on-screen statistics.
4. If compilation passes but statistics are absent, verify the project's Debug Renderer feature, the actual Native engine path in the **same build**, and whether that engine was rebuilt with `CC_USE_PROFILER=1`. Then run the native target and collect an observed counter or frame block. The existing 3.8 Mac package used Creator's built-in native engine, as shown in the [provenance trace](../../traces/stage12-engine-provenance.jsonl); changes to the neighboring checkout will not reach that old package automatically.
5. Report separately: manual setup, source-level macro behavior, focused compile result, build provenance and native runtime observation. Mark any unobserved layer as pending.

The current validation covers macro syntax with `CC_USE_PROFILER=1/0`. It does not cover a full native rebuild, linkage, Debug Renderer configuration or performance numbers.
