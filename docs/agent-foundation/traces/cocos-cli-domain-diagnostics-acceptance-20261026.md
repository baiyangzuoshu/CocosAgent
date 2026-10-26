# Creator 2.4.15 domain diagnostics acceptance

## Environment

- CLI: `cocos-creator-agent-cli` 1.0.3.
- Creator: 2.4.15, extension 0.8.129.
- Project: `/private/tmp/NewProject` (`NewProject`).
- Active scene: `Main`, UUID `efd6d871-cda2-43f8-8bd1-062ca9c47b84`.
- The test project extension was synchronized with the bundled extension and reloaded. `extension status` then reported `matchesBundle: true`. No scene or asset was changed.

## Live receipts

- Editor/AssetDB snapshot: available, `truncated: false`, AssetDB available and complete. Asset references are queried by UUID through the Creator 2.4 `assetInfoByUuid` API, not by enumerating the project asset tree.
- Preview session: `af9b03f0-4906-4c6f-8690-13d612cf8a00`, bound to the same Creator instance, project, and scene UUID. The final `diagnostics check --domain all --platform web-mobile` report returned **17 pass, 0 finding, 3 inconclusive**.
- The three inconclusive rules are `audio.release-unverified`, `font.visual-review`, and `render.visual-review`. The screenshot shows the score and both Chinese button labels legibly, without obvious clipping; the visual rules remain inconclusive because the report does not claim an automated pixel-level judgment.
- Screenshot: `/Users/youjunmao/.cocos-creator-agent/captures/af9b03f0-4906-4c6f-8690-13d612cf8a00/capture-1793027376762-edc62c.png` (SHA-256 `06344f70dd9cad23f600308b85c427e65aefac6c6be6eb12a31d4c2b9352798b`, 65,316 bytes).
- Creator runtime smoke receipt: request `d79dd8d3-5ac4-4af4-b812-deb6bb5ce834`, same Preview session, **4/4 assertions passed**: scene identity, ScoreLabel existence, Label text `0`, and no Console errors. The only action was a `cc.Widget.updateAlignment()` refresh on `Main/Canvas`.
- `preview stop` closed the Agent-owned browser. It returned `creatorPreviewServerStopped: false`; Creator retains control of its Preview server on port 7456.

## Automated checks

- Domain and AssetDB tests: **19/19 passed**, including normal/fault fixtures, identity/error boundaries, AssetDB UUID/type resolution, missing-evidence behavior, scene-root visibility, one-shot concurrency, BitmapFont glyph/shrink checks, MaterialVariant handling, and `watch --affected` selecting and rerunning only the diagnostics suite after a diagnostics-source change.
- Full CLI suite: `npm test -- --test-reporter=tap` — **427 passed, 0 failed**.
- `git diff --check` and JavaScript syntax checks passed.

## Limits

- Live Editor/Preview evidence is from Creator 2.4.15 only. It does not establish behavior for other supported 2.4 patch versions.
- The acceptance project contains no physics colliders or AudioSource. Physics faults, audio clip/concurrency faults, BitmapFont glyph absence, and render faults are covered by synthetic normal/fault test fixtures, not by this live scene.
- The release rule remains inconclusive because the diagnostic does not scan project scripts for dynamic audio APIs or ownership. It reports known `AudioSource` preload/play-on-load state but does not infer cache release or device memory. Exact memory requires a target-device profiler.
- Preview evidence is Web runtime evidence, not a mobile-device or other native-platform result. BitmapFont glyph checks cover the current strings only; localization alternatives and supplementary-plane glyphs remain unchecked.
- Font/render visual rules require human review. The screenshot was visually inspected, but this does not prove pixel-perfect output across devices or target resolutions.
