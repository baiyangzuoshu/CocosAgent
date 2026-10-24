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

初次引用往返验收通过 Creator 2.4.15 的 CLI 写入、AssetDB 类型校验、关闭重开读回、清空和尺寸恢复；当时尚未检查实际渲染。后续的“SpriteFrame 实际渲染”记录已补充像素级预览证据。组件数组中的 AssetDB 引用仍未覆盖。

## 2026-10-24 后续：SpriteFrame 实际渲染

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，CLI 0.12.56、Creator 2.4.15、扩展 0.8.74；场景 UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。现有节点 `CliSpriteTest` UUID `98b06a8e-b138-495f-9a9f-e411b40a6c42`，Sprite 组件 `46UtKj7o1MmYHyjvCPMcWI`；开始时 `spriteFrame=null`、节点 100×100，Widget.left=10。场景/`.meta` 基线 SHA-256 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74` / `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
- 用 Node 在 `/private/tmp/cocos-cli-sprite-render-test.png` 生成 64×64 红/绿/蓝/黄四象限测试 PNG，166 字节，SHA-256 `c9ad61b6de9024c27046639bd9e7165412b77f83e14cb6b892210a662561e1f3`。CLI AssetDB 导入 operation `880a6bb8-604e-4f78-a97b-330c8e35c1eb`，目标 `db://assets/CliSpriteRenderAcceptance.png`；主资源 UUID `36b6b20c-8817-40e1-b6ac-7213bd520825`、SpriteFrame 子资源 UUID `d32db7e8-6757-4f0f-92ad-954940549feb`、生成 `.meta` SHA-256 `3f6c4eb476db315e7e4b4c3f29db4453fc8340ce127b47b453552f93e0125e72`。CLI AssetDB 搜索返回纹理和 SpriteFrame 两条记录。
- CLI 计划/提交将 SpriteFrame 赋给同一 `cc.Sprite`：operation `37876f7f-4908-4444-a1d5-350f5a5c8cdd`，plan hash `08ddb313a248f2c74f0533eea8960f17bcdd4e57374b695ba74c85a9386b6a4d`。Creator 保存回执确认 `_spriteFrame` UUID、组件 UUID，并因 `sizeMode=TRIMMED` 将节点 100×100 调为 64×64。CLI 关闭实例 `5708ba81-9e92-40b2-acef-6876c6dc3276` 后重开，实例 `698fe6d9-4ca5-4b57-90ac-28b621015dba` 返回 `editorReady=true`；场景快照读回 SpriteFrame UUID 和节点 64×64，AssetDB 搜索仍有准确两个资源记录。
- 预览前 Creator diagnostics sequence=2，只有两条既存 `CliAcceptanceButtonState` 配置 warning，`latestCompile=null`；没有把这些 warning 当成本次新增错误。CLI Preview session `fa27443f-9479-478b-be9f-b3369427333e` 对应同一工程/场景，启动 `consoleErrorCount=0`。CLI 截图路径 `/Users/youjunmao/.cocos-creator-agent/captures/fa27443f-9479-478b-be9f-b3369427333e/capture-1792828240917-c75622.png`，SHA-256 `10ba14f53229ec108a80e3df760c5aac3b927017743b27347bed9dddc25efc87`；像素中可见 64×64 红、绿、蓝、黄四块，确认 SpriteFrame 实际绘制。相同 session 的 `creator.preview.observe` 从 sequence 4 读取到 `consoleErrorCount=0`、无新增 Console 项。CLI 停止预览。
- CLI 补偿清空 `spriteFrame`：operation `e7a2c0f5-345c-4994-b47d-50b8ddbb1c1d`，plan hash `16756d00fdae1eb9a06bbe82855888df2d2ed68fca692db9d8aeec73e6ff955f`，磁盘读回为 null。随后将节点尺寸恢复 100×100：operation `e92faf32-0a63-4a44-bf43-0fa2686eeaae`，plan hash `2b1f30bbdb81943406be0d877c4554eabf622ddd79bc082997953f0ede2bf81c`；Creator 的 Widget 尺寸补偿同时恢复 left=10，保存 `.fire` 已回到基线 SHA-256 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`。
- CLI 对 SpriteFrame UUID 的完整引用扫描确认没有场景入站引用；AssetDB 删除计划 operation `4add6dff-32e1-4cdb-aad9-a4bfe468467a`，plan hash `e5785e94a4c4c04672400dca3451271087f0d63310707a26058708a050759565`，扫描完整、入站引用为 0，绑定 PNG/SpriteFrame UUID、源文件哈希和 `.meta` 哈希。Creator AssetDB 删除提交确认 PNG、`.meta`、主资源和 SpriteFrame 子资源均不存在；外部临时 PNG 也已删除。
- 最终由 CLI 关闭实例 `698fe6d9-4ca5-4b57-90ac-28b621015dba` 并重开，实例 `25b18686-e9f5-43cb-a1a2-dff955f6a916` 返回 `editorReady=true`。`creator.project.info` 确认 Tank / Creator 2.4.15 / 扩展 0.8.74 / 场景 UUID；场景快照 23 个节点，`CliSpriteTest` 读回 `spriteFrame=null`、100×100、Widget.left=10。AssetDB 搜索无测试资源，PNG 与 `.meta` 均不存在，`.fire` / `.meta` 哈希恢复基线。

本项完成 SpriteFrame 引用写入、关闭重开读回、可视像素确认、来源补偿和 AssetDB 清理。未覆盖 Sprite 其他属性和数组资源引用。
