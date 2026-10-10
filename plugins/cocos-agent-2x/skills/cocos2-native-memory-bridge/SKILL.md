---
name: cocos2-native-memory-bridge
description: Build and verify a Creator 2.4.15 Mac JSB C++ bridge for process-memory diagnostics; use when measuring native resource workloads or adding a narrow platform capability to the 2.x host.
---

# Creator 2.4 Mac native JSB bridge

Use this skill only for the CocosAgent Creator 2.4.15 Mac JSB path. It covers an experimental process-memory read API and its reproducible build; it does not establish Android, iOS, arm64, GPU-memory, or Creator 3.8 support.

## Source and build

- Read [the native bridge case](../../references/agent-foundation/native-jsb-memory-bridge-2.4.md) for provenance, measured results, and evidence limits.
- The Creator installation supplies `cocos2d-x-lite` 2.4.15 native sources and prebuilt Mac dependencies. The installation source has no Git metadata, so do not claim an upstream commit.
- Keep authored C++ in the repository. The build helper creates a disposable native-source overlay under the ignored project `build/` directory, points the generated Xcode project at it temporarily, and restores generated project files after the build.
- Build with `python3 docs/agent-foundation/probes/build-cocos-agent-memory-bridge-2.4.py`. The installed Mac libraries are x86_64; keep `ARCHS=x86_64` unless the dependency set is replaced and revalidated.

## Measure a native workload

Run the same workload against the stock app and the bridge-built app:

```sh
python3 docs/agent-foundation/probes/cocos-native-content-stress-2.4.py --cycles 24 --size 1024
python3 docs/agent-foundation/probes/cocos-native-content-stress-2.4.py \
  --cycles 24 --size 1024 \
  --app-path 2.4.15NewProject/build/cocos-agent-native-memory-bridge/Build/Products/Debug/hello_world-desktop.app
```

The probe serves temporary PNGs from loopback, samples the exact app process RSS, logs load latency/cache/refcount state, and restores the generated app's `main.js` by hash. The bridge exposes `jsb.getProcessMemoryInfo()` with `residentBytes` and `virtualBytes`; it is registered only in the Mac native target.

Compare equivalent runs. Asset Cache count includes unrelated engine and scene assets; compare start/end in one run and individual object validity. Process resident memory is not GPU memory and does not identify which allocation remains resident. RSS differences between runs are not evidence that the bridge caused a leak or improved memory.

The loopback probe requires permission to bind `127.0.0.1`; run it only where local listening is allowed. Do not modify the installed Creator app bundle. Do not port the Mach implementation to another platform without implementing and separately validating that platform's memory source.
