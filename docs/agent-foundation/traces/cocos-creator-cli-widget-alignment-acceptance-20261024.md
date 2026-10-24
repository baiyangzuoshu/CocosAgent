# Creator CLI Widget 对齐验收（2026-10-24）

## 目标与身份

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15
- 验收场景：`CliAcceptanceScene`，scene UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`CliSpriteTest`，node UUID `98b06a8e-b138-495f-9a9f-e411b40a6c42`
- 组件：`cc.Widget`，serialized/component UUID `111E79JVBIT4ld3jT6EmIh`
- 扩展：最终重开实例使用 0.8.71

## 写入、重开与补偿

1. CLI `creator.scene.ui.inspect` 读到 `left=10`、`isAlignLeft=true`；节点保存位置为 `x=-420`。CLI 计划 `left=20`：operation `f3ae8e97-5d35-41fa-865a-b05ea4984b9d`，plan hash `d4d8bc4b87d8cc4d193aa4510b062b828e9cd6136748129fcfb08d357d628fa4`。
2. CLI 提交后确认 `.fire` 中同一组件 `_left=20`，scene UUID 不变，`.meta` SHA-256 保持 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
3. CLI 关闭并重开后，Creator 读到 `left=20`，运行时节点位置变为 `x=-410`；已保存 `.fire` 的节点位置仍是 `x=-420`。因此原 CLI 前置检查拒绝了补偿计划 `SCENE_DISK_STATE_DIFFERS_FROM_EDITOR`。拒绝原因是 Widget 在重开时计算出的布局位置不同于保存位置，不是组件字段或 UUID 不匹配。
4. 修复将位置差异容忍范围限定到 `cc.Widget` 的对齐相关公开属性。计划仍精确核验保存文件中的组件 UUID、序列化字段和值，并继续核验尺寸、锚点、旋转和缩放。`sceneDiskTransformMatches` 新增对应单测；`scene-persistence.test.mjs` 与 `script-modify.test.mjs` 共 69 项通过。
5. CLI 将 Tank 扩展更新至 0.8.71。一次重开先命中仍在退出过程中的旧 0.8.70 实例并被版本握手拒绝；CLI 清理该失效实例后再次打开成功，`editorReady=true`，路径、Creator 版本和扩展版本均匹配。
6. CLI 补偿计划将同一 Widget 的 `left` 从 20 改回 10：operation `69c716f0-c750-42bb-add1-d0a458c60d26`，plan hash `c58cff0279efd4b813e61d18efac56c9c8d4da70c6535446abb8bd07b815aeb1`。提交回执确认 `_left=10`、位置 `x=-420`、scene UUID 与 `.meta` 哈希不变。
7. CLI 再次关闭并重开。新实例 `54e5fa7d-13bb-40d9-ba0a-7f20cbc82840` 的 `creator.project.info` 确认工程路径、Creator 2.4.15 和扩展 0.8.71；`creator.scene.ui.inspect` 读到 `left=10`，`creator.scene.node.read` 读到 `x=-420`。保存 `.fire` SHA-256 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，与验收开始前一致；`.meta` SHA-256 仍为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

## 结果边界

Widget 单字段写入、重开读回和恢复基线已由 Creator 2.4.15 / Cocos CLI 实机通过。对齐导致的运行时位置变化有 Creator 读回证据；本轮没有启动预览来验收 `ui-refresh` 或不同 Canvas 尺寸，因此 Widget 预览刷新和响应式覆盖仍未通过验收。所有编辑、关闭、重开和 Creator 状态读取均由 Cocos CLI 完成；本机文件仅用于只读核对保存的 `.fire` / `.meta` 字节和哈希。
