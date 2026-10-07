---
name: cocos3-asset-batch
description: Plan and verify a batch of PNG imports through Cocos Creator 3.8.7 AssetDB.
---

# Creator 3.8 PNG batch

Use this skill for an authorized 3.8.7 PNG batch import. Check the [3.8 resource workflow](https://docs.cocos.com/creator/3.8/manual/zh/asset/asset-workflow.html) and [batch contract](../../asset-batch-0.1.md).

1. Select the exact 3.8 project. Call `assets.batch.plan` with 2–16 absolute PNG source paths; resolve filename conflicts before execution.
2. Call `assets.batch.execute` with the same sources and preserve the returned `batchId`.
3. Inspect every item. Require `status=imported`, Creator `imported=true`, source/destination SHA-256 match, and generated `.meta` before using the asset.
4. On `needs-review`, call `assets.batch.get` and inspect AssetDB/disk state. Do not rerun an `importing` item without resolving its ownership.

3.8 reports the imported PNG main resource as `cc.ImageAsset`; texture and SpriteFrame are separate subresources. The sample PNGs use a `Texture2D` subresource at `name/texture`. Check each asset's importer and `.meta` before choosing a runtime type or path. The batch does not delete assets or place them in a scene.
