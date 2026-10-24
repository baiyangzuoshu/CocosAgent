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

## 2026-10-24 后续：右锚属性往返与缓存恢复

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`；CLI **0.12.55**、Creator **2.4.15**、扩展 **0.8.72**。活动场景和节点仍为本记录所列 UUID；组件身份仍为 `111E79JVBIT4ld3jT6EmIh`。
- 原始 Widget 值为 `isAlignLeft=true`、`isAlignRight=false`、`left=10`、`right=0`；节点变换为 `x=-420`、`width=100`。原始 `.fire` SHA-256 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
- CLI 将 `isAlignRight` 从 false 改为 true（operation `a992a84e-3f14-44de-831e-2d2308063c32`）。关闭并重开后，`creator.scene.ui.inspect` 读到左右锚均为 true、`left=10`、`right=850`；节点尺寸和位置未变。来源补偿将右锚恢复为 false（operation `216c52b6-95d0-4a3d-82db-31f874ca748c`），随后将非活动右边距恢复为 0（operation `a5361722-b1a6-4696-9416-07f9bcbae0f8`）。
- 该 setter 往返曾将 Widget 的隐藏序列化缓存 `_originalWidth` 从 0 变为 100。没有直接编辑 `.fire`；通过 Creator 的公开属性 setter 和 CLI 变换操作把节点宽度临时设为 0、再次启用/关闭右锚，再恢复原边距、`x=-420` 和宽度 100。修复操作依次为：宽度设 0 `56bd14e2-bf6a-4d37-9f38-b923d2e66649`；右锚 true `9e449c31-4fee-426e-a9cb-40d269ee1755`、false `f66008fd-d74a-4499-84cc-d0758bdecd69`；左边距恢复 10 `02ec20bf-7f44-4895-b461-4740c8e58e27`；右边距恢复 0 `8c8a8958-437d-4c1b-8a63-fdbb30e8dc92`；节点 x/宽度恢复 `8b055d44-93e8-4de1-ae3c-cb9ac6685419`。每次写入均为 CLI 计划和显式提交，回执的保存文件读回通过。
- 最后一次 CLI 关闭确认进程退出；CLI 重开返回 `editorReady=true`，新实例 `d7c93e24-2130-4a7d-8483-32df324f572d`。`creator.project.info` 确认路径、Creator 2.4.15、扩展 0.8.72；`creator.scene.node.read` 读到相同节点和 Widget 组件身份、`x=-420`、`width=100`；`creator.scene.ui.inspect` 读到 `isAlignLeft=true`、`isAlignRight=false`、`left=10`、`right=0`。最终 `.fire` 和 `.meta` 哈希均与原始基线一致。
- 本项通过证明右锚公开属性可写入、关闭重开读回、来源补偿并恢复源文件基线；没有启动预览，本记录不声称四边布局或不同父尺寸下的运行效果已验收。`_originalWidth` 残留及其恢复路径也记录为 Creator 2.4.15 的 setter 副作用观察。

## 2026-10-24 后续：组合锚序列化修复与父尺寸变化预览

- 工程仍为 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15；本轮更新后的项目扩展为 0.8.73。验收场景 UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。
- 第一次用 `creator.scene.compose.*` 创建临时 Widget 夹具时，编辑器属性和 `.fire` 中的 `_alignFlags=40`、`_left=10`、`_right=850` 均正确，但组合操作回执因验收器把 `isAlignLeft` / `isAlignRight` 当作独立字段而标记 `save-unconfirmed`。没有重放该创建操作；先用 CLI 删除该两节点夹具（operation `d56adbc3-f809-4d81-aca2-aac0ded019a2`），场景哈希恢复基线。修复 CLI 序列化候选映射，并在磁盘回读中按 Creator 的 `_alignFlags` bitfield 验证锚属性及互斥规则；新增单测。定向测试 21/21 通过，完整 CLI 测试套件在允许本机回环监听的环境中 349/349 通过。
- CLI 将修复更新到 Tank 扩展 0.8.73，并以新实例 `957e7783-3c31-4917-9024-6e6073d7df19` 重跑组合创建：operation `1fbfba39-cc2b-4655-b771-602e6869e006`，plan hash `f1e20f94c722aff6552a50825e8031b5135ffa7400c3563aa4e9d853038e7c20`。测试父节点 UUID `11bdaf86-0650-472e-b946-f3e5179a98e0`，子节点 UUID `76ce3449-1d76-432d-a8d8-55024315cb4c`，Widget 实例 ID `e6QTaUVCtGJKcUKYhyCbpE`。组合回执 `completed`、磁盘读回 `verified=true`；关闭重开后，新实例 `1fa2a7b3-0495-4c15-b7b3-95346a707f22` 读到左右锚开启、`left=10`、`right=850`，父宽 960、子节点 `x=-420` / `width=100`。该时点 `.fire` 哈希为 `467d4513d2101f21ff4e3f12a074ae227131d10e88aea7941dff60ef21805e84`，`.meta` 与初始基线相同。
- 预览前通过 `creator.diagnostics.read` 读取到序号 2；有两条既存 `CliAcceptanceButtonState` Creator Console warning，无编译错误。CLI `creator.preview.start` 返回 Preview session `8d304f8d-fe9f-4088-85cd-665e84a6e587`，Creator session `72919ec5-fa59-46cc-947e-93c72ef9d388`，场景/UUID 与工程匹配，启动时 `consoleErrorCount=0`。由 CLI 执行一次性 Preview 脚本 `.cocos-agent/preview-tests/widget-resize-widget-acceptance.js`（SHA-256 `8f0b872eba196a9377f5c75398b652f18173fbfc6829416f8b0cf9f00197bece`）：在运行页中只把夹具父节点宽度从 960 改为 1200，调用 `Widget.updateAlignment()`，断言子宽 100→340 且 `x=-420`，再在 `finally` 恢复父宽 960 并断言子节点宽度/位置回到 100/-420。测试 `widget-horizontal-stretch-resize` 通过，`requiresManualReview=false`、`newErrors=[]`；预览会话随后由 CLI 停止，临时测试文件已删除。该证据是 live Creator Web Preview 的几何数值断言，不是像素截图验收，也不覆盖上下锚、四边组合或不同 Canvas 分辨率。
- CLI 删除夹具的 operation `b54ae494-b2b3-4ca1-ba3f-9344fcb264cc`，plan hash `0a3d9653f2e2a1e053fc5790622ad63c4b7ff5210f9bdd8e3f78de1e5ffa3a42`；回执 `scenePersistenceConfirmed=true`，两个夹具 UUID 均从磁盘 `.fire` 消失，读回 `.fire` 哈希回到 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。然后 CLI 关闭实例 `1fa2a7b3-0495-4c15-b7b3-95346a707f22`（进程正常退出），`instances list` 返回空；CLI 重开同一绝对路径并返回 `editorReady=true`，新实例 `ae11e0b6-94ef-4a22-a9c9-6e19894b07a4`，Creator 2.4.15 / 扩展 0.8.73。`creator.project.info` 和重开后的 `creator.scene.snapshot` 核实工程身份及夹具节点名/UUID 均不存在。全程使用 Cocos CLI，没有桌面自动化。
