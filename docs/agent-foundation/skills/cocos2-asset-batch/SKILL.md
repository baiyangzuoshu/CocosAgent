---
name: cocos2-asset-batch
description: Plan and verify a batch of PNG imports through Cocos Creator 2.4.15 AssetDB.
---

# Creator 2.4 PNG batch

Use this skill for an authorized 2.4.15 PNG batch import. Check the [2.4 resource workflow](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/index.html) and [batch contract](../../asset-batch-0.1.md).

1. Select the exact 2.4 project. Call `assets.batch.plan` with 2–16 absolute PNG source paths and a `targets` list containing that project/version exactly once; resolve filename conflicts before execution. PNGs must have a valid IHDR and dimensions from 1–4096 pixels and be no larger than 10 MiB.
2. Call `assets.batch.execute` with the same sources and preserve the returned `batchId`.
3. Inspect every item. Require `status=imported`, Creator `imported=true`, source/destination SHA-256 match, and generated `.meta` before using the asset. For 2.4, verify the import receipt's `texture` UUID matches the `.meta` main UUID and the SpriteFrame subasset's `rawTextureUuid` points back to it. This link is required before creating a scene Sprite; Type=Raw textures do not produce a SpriteFrame subasset.
4. On `needs-review`, call `assets.batch.get` and inspect AssetDB/disk state. Do not rerun an `importing` item without resolving its ownership.

2.4 uses `texture` as the imported PNG main resource. When Type=Sprite, its SpriteFrame is a separately identified subresource in `.meta`; use that UUID, not the main texture UUID, when creating scene references. The batch does not delete assets or place them in a scene. The 2.4 image-resource behavior follows the [official manual](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/sprite.html).
