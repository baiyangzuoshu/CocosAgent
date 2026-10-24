# Creator CLI SpriteFrame 引用验收（2026-10-24）

## 目标与身份

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15；扩展：0.8.71
- 场景：`CliAcceptanceScene`，scene UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`CliSpriteTest`，node UUID `98b06a8e-b138-495f-9a9f-e411b40a6c42`
- Sprite：component UUID `46UtKj7o1MmYHyjvCPMcWI`
- SpriteFrame 子资源 UUID：`e3735c2e-c9f0-4bd5-a69c-818daefde19e`

## 资源与场景往返

1. Tank 原来没有图片资源。CLI `creator.asset.import.plan/commit` 将一张 74 字节的临时 PNG 导入 `db://assets/CliSpriteFrameAcceptance.png`：operation `52fe4589-ad8b-4c3c-b196-d43523a27ad5`，主资源 UUID `ad4c1c73-35ce-48a0-a2d4-4bb0e2cbe229`，AssetDB 随后返回 SpriteFrame 子资源 UUID `e3735c2e-c9f0-4bd5-a69c-818daefde19e`。
2. CLI `creator.scene.ui.inspect` 确认 Sprite 原 `spriteFrame` 为空。属性计划/提交将 `cc.Sprite.spriteFrame` 指向上述子资源：operation `aa175c5d-4654-4af0-b3e2-345596918ccf`，plan hash `b2017537fa176ef2bd9f20bfa1365f9f8966e9e56f94a2393780cdcc99fbe5b9`。Creator 保存回执核对 `.fire` 中组件 UUID 与 `_spriteFrame` 子资源 UUID，并观察到 Sprite 内容尺寸从 100×100 变为 2×2。
3. CLI 关闭并重开工程。新实例 `891e0793-acb7-4fe8-bbd7-f05a5f285cca` 返回 `editorReady=true`，项目路径、Creator 版本和扩展版本匹配；CLI 读回 SpriteFrame UUID 仍为 `e3735c2e-c9f0-4bd5-a69c-818daefde19e`，节点尺寸为 2×2。
4. CLI 计划/提交清空同一 Sprite 的 SpriteFrame：operation `9e15c278-c71f-4118-8a3a-474388e04e99`，plan hash `1ee175a97f5f89c548b8cb0370c7ae873321bf8a669a5248b329fc27f4735bc4`。Creator 保持了 2×2 尺寸，因此 CLI 再以 `creator.scene.node.set-transform.plan/commit` 把宽高补偿到 100×100：operation `f873b231-22de-49d8-8548-164a4c47686f`，plan hash `b7e728257ac0ec3644f7b6ec4c82e4fe3145c2954534539a49b85523345393eb`。
5. CLI 关闭并重开后，实例 `88f99955-8569-4900-b04b-ebe9cb0e2795` 返回 Creator 2.4.15 / 扩展 0.8.71；SpriteFrame 为空、节点尺寸为 100×100、`Widget.left=10`。AssetDB UUID 引用扫描完整，目标子资源没有场景引用。
6. CLI `creator.asset.delete.plan/commit` 删除临时 PNG：operation `7f61e7cf-82b1-4abd-938b-83ddde7cfac2`，plan hash `ceb1c51453837e8a1c395a6f3575a83ba13d89e90bb133bd31bc4816d747ae3b`。计划绑定主资源 UUID、文件和 `.meta` 哈希、完整子资源列表以及零入站引用；提交回执确认文件、`.meta`、主资源和 SpriteFrame 子资源均不存在。
7. 最终 CLI 关闭并重开。实例 `c7ba7253-171e-46b0-a14e-8c4198c99e34` 的 AssetDB 搜索没有临时资源；场景 UUID 不变，SpriteFrame 为空，节点尺寸恢复 100×100。`.fire` SHA-256 回到验收前的 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` SHA-256 保持 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

## 结果边界

Creator 2.4.15 中 SpriteFrame 子资源 UUID 的写入、AssetDB 类型校验、`.fire` 保存读回、工程重开、清空引用和场景尺寸恢复已通过纯 Cocos CLI。临时图通过 AssetDB 导入和删除，未手写项目 `.meta`。本轮未启动预览，因此 SpriteFrame 的实际渲染效果仍待运行时验收；组件数组中的 AssetDB 引用也未覆盖。
