---
name: cocos2-asset-batch
description: Plan and verify a batch of PNG imports through Cocos Creator 2.4.15 AssetDB.
---

# Creator 2.4 PNG batch

Use this skill for an authorized 2.4.15 PNG batch import. Check the [2.4 resource workflow](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/index.html) and [batch contract](../../asset-batch-0.1.md).

1. Select the exact 2.4 project. Call `assets.batch.plan` with 2–16 absolute PNG source paths; resolve filename conflicts before execution.
2. Call `assets.batch.execute` with the same sources and preserve the returned `batchId`.
3. Inspect every item. Require `status=imported`, Creator `imported=true`, source/destination SHA-256 match, and generated `.meta` before using the asset.
4. On `needs-review`, call `assets.batch.get` and inspect AssetDB/disk state. Do not rerun an `importing` item without resolving its ownership.

2.4 uses `texture` as the imported PNG main resource. Its SpriteFrame is a separately identified subresource in `.meta`; use the correct UUID when creating scene references. The batch does not delete assets or place them in a scene.
