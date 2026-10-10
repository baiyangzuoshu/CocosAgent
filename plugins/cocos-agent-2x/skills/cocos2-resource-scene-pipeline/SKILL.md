---
name: cocos2-resource-scene-pipeline
description: Import user-selected PNG files into a Cocos Creator 2.4.15 project, verify AssetDB metadata and SpriteFrame dependencies, place them in the active Canvas, inspect the Web preview, validate or repair the narrow stale AssetDB mapping case, and compensate the pipeline.
---

# Creator 2.4.15 PNG resource-to-scene workflow

Use only with the `cocos-agent-2x` MCP tools and an explicitly selected Creator **2.4.15** project. Read the [pipeline contract](../../../../docs/agent-foundation/cocos-agent-resource-scene-pipeline-0.1.md) and the official [2.4 sprite workflow](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/sprite.html) when making resource-format or editor-behavior claims. This workflow currently supports PNG → Texture → SpriteFrame → Canvas Sprite on the local Web preview; it does not imply support for arbitrary formats, native builds, Asset Bundle delivery, or Creator 3.8.

## Import and place

1. Select the exact ready Creator 2.4.15 instance with `cocos_2x_instances_list/get`; query `cocos_2x_capabilities_list` and require the resource pipeline commands to be available. Confirm the intended active scene and Canvas using read-only scene tools.
2. Call `cocos_2x_assets_scene_plan` with 2–16 explicit absolute PNG paths and, when multiple images need distinct placement, one Canvas-local `{x,y}` position per image. Check the reported source digest, PNG signature/IHDR, size limits, destination-name conflicts, Canvas, node-name conflicts, project root and scene before executing.
3. Execute exactly once with `cocos_2x_assets_scene_execute`, the returned `pipelineId`, and the same source paths/positions. On timeout or uncertain result, query `cocos_2x_assets_scene_get`; do not retry the write.
4. Require Creator AssetDB import and disk readback for each item. In 2.4, confirm the Texture UUID and its unique SpriteFrame sub-asset UUID; SpriteFrame `.meta` `rawTextureUuid` must point back to that Texture. Confirm the SpriteFrame UUID in the serialized `.fire` scene and the active scene. Never generate UUIDs or edit `.meta` by hand.
5. Inspect the exact local Web preview for every Sprite. Only after seeing each intended image at the expected position, call `cocos_2x_assets_scene_preview_accept` with its item `operationId`, actual preview URL, observation time and concise visible result. Then require `cocos_2x_assets_scene_get` to report `completed`.

## Validate and repair

Call `cocos_2x_assets_scene_validate` before relying on an existing pipeline asset. It checks source bytes/hash and dimensions, Texture/SpriteFrame `.meta` UUID relationships, AssetDB URL mapping, active and serialized scene references, Canvas hierarchy, and the pipeline record.

Call `cocos_2x_assets_scene_repair` only when validation reports the sole issue `ASSETDB_MAPPING_STALE` and every source, `.meta`, UUID, scene and pipeline identity still matches. Reuse the persisted `repairId` after interruption. The repair may call Creator `Editor.assetdb.refresh(url)` and must verify the mapping and identities afterward. `already-valid` is a no-op; it does not exercise or prove the refresh branch. Stop on UUID/hash/meta changes, missing references, ambiguous state, refresh error, or `needs-review`. Never hand-edit `.meta` to manufacture a repair case.

## Compensation

For an explicitly requested undo, or after a deterministic failed pipeline, call `cocos_2x_assets_scene_compensate`. It removes the pipeline's scene references before asking AssetDB to delete its imported files, and only when ownership hashes, UUIDs and the bounded serialized-reference scan still match. Require `compensated` and `rollbackStatus=passed`; stop at `needs-review` and reconcile records, disk, AssetDB and scene state before any further mutation. The scan cannot see dynamically assembled UUIDs or references outside `assets/`.

Do not stage a release or build unless the user requested that next step. See the contract's evidence section for the presently verified Creator build, metadata, validation, preview and repair boundaries.
