---
name: cocos2-dynamic-content-performance
description: Measure repeated runtime texture swaps, node updates, load/parse/release timings, cache and references in a Creator 2.4.15 Web-Mobile build; use when establishing or checking explicit performance budgets.
---

# Creator 2.4 dynamic content performance

Use only for the CocosAgent 2.4.15 Web-Mobile path. This skill runs an external probe against an already-built package. It does not add support for Creator 3.8, native builds, mobile devices, remote bundles, or the live Editor preview.

## Run the probe

From the repository root on the current macOS setup (with Google Chrome at `/Applications/Google Chrome.app`), use a completed Creator 2.4.15 `web-mobile` build record whose build contains the two verified stress PNGs:

```sh
node docs/agent-foundation/probes/cocos-content-stress-2.4-live.mjs --cycles 48 --node-count 32 --packable true
```

The probe refuses to write into the project build, scene, or release pointer. It creates temporary nodes in the running browser, swaps the two textures, samples each phase, injects HTTP 503 for the inactive candidate, checks that the old SpriteFrame and reference remain, then destroys the temporary nodes and verifies cache cleanup. It writes a JSON trace and screenshots under `docs/agent-foundation/traces/`.

Optional flags set caller-selected P95 budgets: `--target-fps`, `--max-resource-load-p95-ms`, `--max-import-parser-p95-ms`, `--max-png-parser-p95-ms`, and `--max-release-call-p95-ms`. Do not invent a target. With no gates the result must say `completed-without-budget-gate`; with configured gates only report pass when every one passes.

## Read results carefully

- Compare runs from the same build and browser setup. Use explicit Sprite counts and `packable` values; the repository's red and blue sample textures are only 2×2 pixels.
- `resourceLoadTotalMs` is end-to-end `cc.resources.load`. Parser `import` time covers Creator 2.4 `deserialize()`; `.png` parser time covers the image parse/decode callback. Read them alongside HTTP requests and statuses before attributing time to network, deserialization, or image decoding.
- `releaseCallMs` is the synchronous `releaseUnusedAssets()` call. `releaseObservedMs` includes waiting for the next `EVENT_AFTER_DRAW`, so it is not pure release CPU time. Wait for deferred node destruction before the release readback.
- Check the per-cycle texture `refCount`, `valid`, `cached`, and Asset Cache count. Cache count includes unrelated scene and engine assets. `performance.memory`, when present, is a non-standard JS heap sample, not GPU/native memory or a peak.
- The 2026-10-10 baseline and its limits are in [dynamic-content-pressure-2.4.md](../../../../docs/agent-foundation/dynamic-content-pressure-2.4.md). A baseline without a product device, asset scale, and chosen thresholds is not a shipping performance verdict.
