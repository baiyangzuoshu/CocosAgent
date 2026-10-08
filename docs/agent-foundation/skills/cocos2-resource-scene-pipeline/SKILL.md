---
name: cocos2-resource-scene-pipeline
description: Import new PNGs, verify Creator 2.4.15 AssetDB metadata and UUID relationships, place them in the active scene, verify the local Web preview, and compensate this pipeline's own writes safely.
---

# Creator 2.4 Resource-to-Scene Pipeline

Use this skill only for an authorized PNG-to-Canvas-Sprite task in Cocos Creator **2.4.15**. Read the [resource pipeline contract](../../cocos-agent-resource-scene-pipeline-0.1.md), the [2.4 image workflow](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/sprite.html), and the [AssetDB main-process API](https://docs.cocos.com/creator/2.4/manual/en/extension/api/asset-db/asset-db-main.html). Do not route this workflow through Creator 3.8.7.

1. Confirm the exact Creator 2.4.15 project and intended active scene. Call `assets.scene.plan` with the project in `targets` exactly once, 2–16 absolute PNG source paths, and one Canvas-local `{x,y}` position per image where needed. Stop on filename/destination conflicts, missing Canvas, node conflicts, or invalid source data. Planning must not import or change the scene.
2. Call `assets.scene.execute` with the same source list and positions and the returned `pipelineId`. Preserve that ID and every returned item `operationId`. Require `needs-preview`; verify each item's SHA-256 and Creator Texture/SpriteFrame UUID chain before trusting the scene reference. Do not fabricate or edit `.meta` files.
3. Observe the same scene in the active Creator 2.4 Web preview. For each visible Sprite, call `assets.scene.preview.accept` with that item's operation ID and actual local HTTP preview URL, observation timestamp and a short visual note. Do not accept a preview for an item that is missing, clipped, or obscured. Query `assets.scene.get`; require `completed` only after all item previews pass.
4. For an authorized undo or a deterministic failure, use `assets.scene.compensate` or the pipeline's automatic rollback. The pipeline removes scene references first, then requests `Editor.assetdb.delete` only for resources whose file hash, `.meta`, Texture UUID, SpriteFrame UUID and no-serialized-reference scan still match. Confirm `rollbackStatus=passed` and `outcome=compensated` (explicit undo) or `outcome=failed` (automatic rollback). A `needs-review` result blocks further writes/deletes: inspect the pipeline, asset batch, scene batch, operation records, disk files and Creator before proceeding.

The no-reference check is bounded to serialized files under the project's `assets/` tree; it cannot discover dynamically constructed UUID references or external consumers. If a scan cannot establish the condition, preserve the asset for review. Never use this pipeline to remove user-created resources.
