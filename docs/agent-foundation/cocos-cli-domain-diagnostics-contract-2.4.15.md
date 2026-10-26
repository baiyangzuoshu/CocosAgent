# Creator 2.4 domain diagnostics contract

This document defines the read-only `diagnostics check` interface owned by `cocos-creator-agent-cli`. The implementation contract is validated against Creator 2.4.15. The CLI may advertise the repository's supported Creator patch range, but that does not extend the editor/runtime evidence beyond 2.4.15.

## Command

```text
cocos-creator-agent diagnostics check --instance <id> [--domain physics|audio|font|render|all] [--session <preview-session-id>] [--platform web-mobile|web-desktop|android|ios|mac|win32]
```

`--domain` defaults to `all`. `all` expands to `physics`, `audio`, `font`, and `render`. `--session` may name only an already-running Preview session bound by the bridge to the same Creator instance, project, and active scene. The command never starts Preview, plays audio, interacts with the game, or writes project files. Without a Preview session, checks needing live state return `inconclusive`.

The CLI composes two private catalog commands:

| Command | Owner | Input | Evidence |
| --- | --- | --- | --- |
| `creator.diagnostics.snapshot` | Creator extension | `domains`, `maxNodes` | Active authoring scene, component properties and referenced AssetDB identities |
| `creator.diagnostics.runtime` | Bridge Preview host | `previewSessionId`, `domains`, `includeScreenshot` | Runtime scene/component facts, bounded Preview Console entries, and optionally a PNG capture |

Both commands are read-only. The runtime command evaluates a fixed diagnostic expression; it does not accept or execute project-provided JavaScript. Existing `creator.diagnostics.read` remains the source for compile/import/editor Console events.

The Editor snapshot collects referenced UUIDs from its bounded scene snapshot and queries each with Creator 2.4 AssetDB `assetInfoByUuid`. It does not enumerate the whole project asset tree. UUID collection is capped at 512 references, 20,000 visited objects, depth 6, 256 array entries, and 128 object keys; any cap or failed lookup marks the index incomplete so absence is not treated as proof that an asset is missing.

## JSON report

The CLI prints one JSON object with `schemaVersion: 1`:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-26T00:00:00.000Z",
  "project": {
    "instanceId": "...",
    "root": "/absolute/project/path",
    "name": "project-name",
    "creatorVersion": "2.4.15"
  },
  "scene": { "name": "Main", "uuid": "..." },
  "domains": ["physics", "audio", "font", "render"],
  "targetPlatform": "web-mobile",
  "evidence": {
    "editorSnapshot": { "source": "creator-editor", "capturedAt": "...", "truncated": false },
    "preview": null,
    "screenshot": null
  },
  "summary": { "pass": 0, "finding": 0, "inconclusive": 0 },
  "checks": [
    {
      "ruleId": "physics.manager-disabled",
      "domain": "physics",
      "severity": "error",
      "status": "finding",
      "title": "Physics components are present while the runtime physics manager is disabled.",
      "evidence": [
        { "source": "preview-runtime", "nodeUuid": "...", "nodePath": "Root/Body", "component": "cc.RigidBody", "property": "enabled", "value": false }
      ],
      "recommendation": "Enable the 2D physics manager for this runtime, or remove the unused physics components.",
      "applicability": {
        "creatorVersions": ["2.4.15"],
        "targetPlatform": "web-mobile",
        "requiresPreview": true,
        "limitations": ["Preview evidence applies only to this session and active scene."]
      }
    }
  ]
}
```

`status` is `pass`, `finding`, or `inconclusive`. `severity` is `error`, `warning`, or `info`; severity describes the rule if it is a finding. A check may repeat a `ruleId` for separate affected nodes. Evidence is an array of source-bound facts: `creator-editor`, `assetdb`, `preview-runtime`, `preview-console`, or `preview-screenshot`. Every check includes a recommendation and applicability limits. `targetPlatform` is `unknown` when omitted; Preview results are not treated as evidence for another platform.

Asset sizes or memory costs are not reported by this contract. If a later rule adds an estimate, it must include `estimate: true`, units, assumptions, and the data source. Exact device memory requires a target-device profiler.

## Stable initial rule IDs

| Rule ID | Evidence and behavior |
| --- | --- |
| `physics.manager-disabled` | Preview state of the 2D rigid-body physics manager when physics components exist. |
| `physics.collision-manager-disabled` | Preview state of the separate simple 2D collision manager when `cc.BoxCollider`, `cc.CircleCollider`, or `cc.PolygonCollider` components exist. |
| `physics.collider-without-body` | Collider and same-node rigid-body configuration; a collider that cannot create a body is a finding. |
| `physics.collision-group-unmatched` | Runtime group list/matrix and physics/simple-collision node group indices; only reports groups with no enabled collision pair. |
| `physics.contact-listener-without-handler` | Runtime `enabledContactListener` and contact method presence on components on that node. |
| `physics.collision-callback-missing` | Preview callback presence on active simple-collider nodes; does not prove that a collision occurs. |
| `audio.clip-missing` | AudioSource Clip UUID and expected `cc.AudioClip` type against AssetDB. |
| `audio.play-on-load-over-limit` | Preview count of active one-shot and looping `playOnLoad` sources per Clip compared with the runtime per-Clip instance limit. Actual dynamic overlap remains unknown. |
| `audio.release-unverified` | Always inconclusive: scene AudioSource preload/play-on-load state is reported, but project script usage of dynamic audio APIs and clip ownership are not scanned, so absence of scene sources cannot prove release behavior. |
| `font.label-font-missing` | Label system-font flag, expected `cc.TTFFont`/`cc.BitmapFont` type, and AssetDB resolution. |
| `font.bitmap-glyph-missing` | Preview BitmapFont glyph dictionary for the current Label string; other locale strings and device font fallback remain unverified. |
| `font.shrink-reduced-size` | Preview Label configured and actual font sizes when shrink overflow is active. |
| `font.visual-review` | Label rendering requires review of the attached Preview screenshot; no automatic pixel-level pass is claimed. |
| `render.sprite-frame-missing` | SpriteFrame reference, expected type, and AssetDB resolution. |
| `render.component-hidden` | Sprite and Label component/node enabled state, authored ancestor visibility, and Sprite visibility property. |
| `render.material-reference-unresolved` | Serialized render-material references checked against AssetDB and, when present, same-scene Preview Material instances. Preview resolution also recognizes built-in materials that are not project AssetDB assets; missing both sources stays inconclusive. |
| `render.material-effect-reference` | Runtime Material-to-EffectAsset references; does not prove cross-GPU shader compatibility. |
| `render.camera-culls-active-node` | Preview camera culling masks, active renderable nodes, and node groups. |
| `render.preview-console-errors` | Errors captured from the exact Preview session. |
| `render.visual-review` | Screenshot supplied as visual evidence; a human must judge visual correctness. |

Rules may return `inconclusive` when required evidence is unavailable, truncated, or belongs to a different target platform. They must not convert a missing Preview or unavailable AssetDB index into a pass.

The Creator 2.4.15 live acceptance receipt and its observed limitations are recorded in [the domain diagnostics acceptance trace](traces/cocos-cli-domain-diagnostics-acceptance-20261026.md).

## Identity and error handling

Before combining evidence, the CLI verifies the instance ID, absolute project root, Creator version, active scene UUID, and—when supplied—the Preview session's bridge-bound project and scene. Identity mismatches fail closed with `DIAGNOSTICS_PROJECT_IDENTITY_MISMATCH`, `DIAGNOSTICS_CREATOR_VERSION_MISMATCH`, or `DIAGNOSTICS_SCENE_IDENTITY_MISMATCH`. Invalid domains/platforms fail before contacting Creator. An unavailable authoring snapshot fails with `DIAGNOSTICS_EDITOR_SNAPSHOT_UNAVAILABLE`; an unavailable AssetDB index remains explicit in evidence and makes affected asset-reference checks inconclusive. Existing bridge Preview errors such as `PREVIEW_SESSION_ID_INVALID`, `PREVIEW_SESSION_NOT_FOUND`, `PREVIEW_BROWSER_EXITED`, and `PREVIEW_SCENE_IDENTITY_MISMATCH` are preserved.
