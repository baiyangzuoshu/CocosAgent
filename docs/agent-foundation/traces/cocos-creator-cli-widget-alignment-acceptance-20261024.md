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

## 2026-10-24 后续：上下双锚随父高度变化

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15 / 扩展 0.8.73，场景 `CliAcceptanceScene` UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。创建前场景及 `.meta` 基线分别为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74` 和 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
- CLI `creator.scene.compose.plan/commit` 创建临时父子节点：operation `bad0fe98-4d45-4cdd-8eeb-d5350d1b5507`，plan hash `6ea9d37843f7b53cdf3305ce396399622ef23bdf4d77920cdc6e929678cc84eb`。父 UUID `25e2fd1e-656e-4c82-a73e-ac7f048187a2`，Canvas 子节点、尺寸 960×640；子 UUID `fc8dc297-19f6-4f07-b998-d43d887bc886`，初始变换 `(x=0,y=0,width=100,height=100)`，Widget 实例 ID `77eyREeHJMiKzxZVWmeLJB`，`isAlignTop=true`、`isAlignBottom=true`、`top=270`、`bottom=270`。提交结果 `completed`，场景磁盘读回 `verified=true`，新增 `.fire` 哈希 `e33569544cd6b2dda07ba8daa05c6064e174b1a65c4ad6007b1ad50082079546`，`.meta` 未变。
- 按流程关闭创建实例 `ae11e0b6-94ef-4a22-a9c9-6e19894b07a4` 后，CLI 重开返回 `editorReady=true`，实例 `0fd51d0c-6245-4343-9c6c-661f30ef9c04`。`creator.project.info` 确认路径、工程名、Creator/扩展版本和活动场景；父子 `creator.scene.node.read` 确认 UUID、层级和变换，`creator.scene.ui.inspect` 确认两个垂直锚开启、上下边距均为 270，序列化键为 `_alignFlags`、`_top`、`_bottom`。
- 预览前 `creator.diagnostics.read` 到序号 2，只有两条既存 `CliAcceptanceButtonState` warning，`latestCompile=null`。CLI Preview session `9c70ffc5-51b5-42b0-ab27-6d992fbf30da`、Creator session `bbfebfb2-15d6-4f16-9223-240f2d1b1d85` 与工程/场景身份一致，启动时 `consoleErrorCount=0`。运行临时脚本 `.cocos-agent/preview-tests/widget-vertical-resize-widget-acceptance.js`，SHA-256 `3da97372fa5fdce7a29282a72ec60e557dc0d433cfef6d557e2cb3e62138081b`：断言初态父高 640、子高 100、`y=0`；将预览内父高改为 800 并调用 `Widget.updateAlignment()` 后，子高变为 260、`y` 仍为 0；`finally` 恢复父高 640 后，子节点回到高 100、`y=0`。测试 `widget-vertical-stretch-resize` 通过，`requiresManualReview=false`、`newErrors=[]`。预览由 CLI 停止，临时脚本已删除。
- CLI 来源清理 operation `9c48a671-e602-4340-8b47-620a119dfe93`，plan hash `db6c366fc1e8a1afeb5211d3a21b9129260e17fe0befb18f7144aa5f97353463`；磁盘读回验证两个 fixture UUID 均消失，`.fire` 与 `.meta` 哈希回到上述基线。之后 CLI 关闭实例 `0fd51d0c-6245-4343-9c6c-661f30ef9c04`，确认旧实例列表为空，再重开得到 `editorReady=true` 的新实例 `18e3098c-e2d0-485e-bbf6-234b0867d4ef`。重开后项目路径、Creator 2.4.15、扩展 0.8.73 和场景身份匹配，场景快照仍为 23 节点，找不到 fixture UUID/名称；本地只读哈希与 CLI 删除回执一致。全程只使用 Cocos CLI 和临时 Preview 脚本，没有桌面自动化。
- 本项证明 Creator 2.4.15 中 Widget 上下双锚可随父高度 640→800 将子节点高度 100→260，并在预览内恢复；结合前一项左右双锚测试，四边同时锚定、窗口/Canvas 分辨率变化及 `creator.preview.interact` 的 `ui-refresh` 动作仍未验收。

## 2026-10-24 后续：四边锚定同时响应父节点宽高

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15 / 扩展 0.8.73，场景 UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。本次开始前 `.fire` / `.meta` 基线与 Widget 前两项相同：`cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74` / `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
- CLI `creator.scene.compose.plan/commit` 创建临时父子节点：operation `95ad310c-e760-4df6-af45-db914dbc49e5`，plan hash `ea2e28c38de27bddeae67544302ee8215cf78647b940d3e0cb377db23897c713`。父 UUID `9419f9b9-9816-44a2-bed7-a3f03086bb3d`，初始 960×640；子 UUID `b6685227-8ed3-4c40-b9d1-25907aeffca6`，初始 880×580、`x=y=0`；Widget 实例 `e1PVuoPKxKxI/BksgY/it4`，四个锚点均启用，边距 left/right=40、top/bottom=30。提交 `completed`，磁盘场景读回 `verified=true`，新 `.fire` 哈希 `18e101e95fd0af425177d51b6b4aac2301d4678ec8baae0bef87891c81e0e726`。
- CLI 关闭创建实例 `18e3098c-e2d0-485e-bbf6-234b0867d4ef` 后重开，实例 `84606878-84a2-451d-9000-4d294a606d87` 的工程信息与 Creator/扩展版本匹配。`creator.scene.node.read` 和 `creator.scene.ui.inspect` 读回父子 UUID、960×640 / 880×580 变换、左右上下四个标记为 true，边距 40/40/30/30。
- 预览前 diagnostics 序号 2，只有两条既存 `CliAcceptanceButtonState` warning，`latestCompile=null`。CLI Preview session `3b404992-d0f4-410c-a08e-82ce4cd4696c`、Creator session `254ee6d3-f0c3-4bc2-8414-7b2c0a47e700` 对应正确工程和场景，启动 `consoleErrorCount=0`。预览脚本 `.cocos-agent/preview-tests/widget-four-edge-widget-acceptance.js`，SHA-256 `a4d9c1dc0d90261445155dbda2da299f61ca9ea46c6989b6165e191b57d824da`：断言初始父/子为 960×640 / 880×580、子中心 `(0,0)`；父节点在预览中改为 1200×800 并调用 `Widget.updateAlignment()` 后，子节点为 1120×740、中心仍 `(0,0)`；`finally` 恢复父尺寸后子节点恢复 880×580。测试 `widget-four-edge-resize` 通过，`requiresManualReview=false`、`newErrors=[]`；CLI 随后停止预览并删除临时脚本。
- CLI 来源清理 operation `2ffce992-19d3-46a2-a90d-1d4136cb2706`，plan hash `ddaf14156a71a88f1a354b4a0a0ecfe0b027f49823ab5d84f638573d8ac5fc61`；保存文件读回确认两个 fixture UUID 消失，`.fire` / `.meta` 恢复上述基线。随后 CLI 关闭实例 `84606878-84a2-451d-9000-4d294a606d87`、确认实例列表为空并重开，获得 `editorReady=true` 新实例 `b908ebce-1f66-44cd-8b36-dab204035e55`。`creator.project.info` 与场景快照确认工程和活动场景一致、节点数回到 23，测试节点 UUID/名称不存在；独立文件哈希与 CLI 回执吻合。全程只用 Cocos CLI，没有桌面自动化。
- 本项通过证明 Creator 2.4.15 的 Widget 四边同时锚定可在父宽高同时变化时保持四边距并保留子节点中心；只覆盖对称边距和父节点尺寸变化，不代表不同 Canvas 分辨率、非对称边距或 `creator.preview.interact` 的 `ui-refresh` 已验收。

## 2026-10-24 后续：非对称左右边距随父宽变化

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，CLI 0.12.56、Creator 2.4.15、扩展 0.8.74；场景 UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。开始时 CLI 确认项目路径、版本与活动场景。场景 `.fire` 基线 SHA-256 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
- CLI 组合操作 `b3478429-59c2-4391-80f9-ee119df623b1`，plan hash `357d58fff1153314321c84404a968d946877330475d46533681ea1e8a2fbd737`，创建父节点 `CliWidgetAsymmetricAcceptance` UUID `17dead12-55cc-4afd-896c-eec6f635b4ba`（960×300）和子节点 `WidgetAsymmetricItem` UUID `627fe6d4-3dae-44ee-83cc-e66941520915`。子节点 `cc.Widget` 实例 ID `0ffjYjmcZJCYx0gDstlgVR`，左右锚开启，left=30、right=70；保存变换 width=860、x=-20。CLI Inspector 和场景快照均读到这些值。
- CLI 关闭并重开后，实例 `ea4398a5-c880-4f11-af97-20f03fc7afcb` 返回 `editorReady=true`；工程信息与场景快照确认路径、Creator/扩展版本、场景 UUID 和组件字段不变。CLI 预览 session `18b6c9b8-4c4f-44c0-8845-3d7035a6c8b4` 对应相同工程/场景，启动时 consoleErrorCount=0。临时脚本 `.cocos-agent/preview-tests/widget-asymmetric-margins-acceptance.js` SHA-256 `ef9e584b960963529e86492165b6f0903d087365320442c4390e338dc1f41086` 断言初态 width=860、x=-20；预览中父宽 960→1200 后，子宽变为 1100、x 仍为 -20；`finally` 恢复父宽 960 并确认子节点恢复 width=860、x=-20。测试 `widget-asymmetric-margins` 通过，`requiresManualReview=false`、`newErrors=[]`。CLI 停止预览并删除临时脚本。
- CLI 来源补偿删除两个测试节点：operation `9866deb7-6e3a-4f7f-8e70-dbea5fdfbb00`，plan hash `8bb82b856c86afb4d96382c205d0e1a2174119c601978b06bbf74d4ae7463206`。回执确认两个 UUID 均从保存场景中消失，`.fire` / `.meta` 回到上述基线哈希。
- 补偿后通过 CLI 关闭 Creator 实例 `ea4398a5-c880-4f11-af97-20f03fc7afcb`，确认进程退出；CLI 重开返回 `editorReady=true`，新实例 `62d24944-49d8-4c9e-9b02-a30a0fec8596`。`creator.project.info` 核对工程 tank、路径、Creator 2.4.15、扩展 0.8.74 和活动场景；快照为 23 个节点且不含两个测试 UUID。只读文件哈希再次匹配基线，全程使用 Cocos CLI 和临时预览脚本。
- 本项通过证明 Widget 非对称左右边距会在父宽变化时保持两边距：父宽 960→1200、子宽 860→1100，子中心偏移保持 -20。不同 Canvas 设计分辨率及单边偏移组合仍未验收。

## 2026-10-24 后续：单边右锚偏移随父宽变化

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，CLI 0.12.56、Creator 2.4.15、扩展 0.8.74；场景 UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。操作前 CLI `creator.project.info` 确认工程路径、版本与场景身份；`.fire` / `.meta` 基线为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74` / `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
- CLI 计划并提交父子夹具和单个 `cc.Widget`：operation `5367b84a-701d-4fb7-b446-b1520c3e6a25`，plan hash `ad0e7ee6b8cd7e02ea940f3d01bbf98b101027fcd85f3af1e704a74abec8bce1`。父节点 `CliWidgetRightAnchorAcceptance` UUID `7110c281-2c67-4fc1-8e1e-b7ad77fcde43`，尺寸 960×200；子节点 `WidgetRightAnchorItem` UUID `8e122516-cba0-4cb8-9dc9-435407bd2874`，尺寸 100×80；Widget 实例 `b4wOV+2V9HVpYoMsftj277`，仅 `isAlignRight=true`、`right=60`。Creator 保存文件语义读回 `verified=true`，`.meta` 未变。
- CLI 关闭原实例 `62d24944-49d8-4c9e-9b02-a30a0fec8596` 并重开，`editorReady=true` 的新实例 `676201e4-18e6-49d9-a6fc-b3943638a635`。`creator.project.info` 确认工程和场景；`creator.scene.ui.inspect` 读到右锚和 right=60，场景快照读到父宽 960、子宽 100、x=370。启动预览 session `c18a4abf-36e7-4b93-95ec-f629c417e261` 时 `consoleErrorCount=0`。
- 临时预览脚本 `.cocos-agent/preview-tests/widget-right-anchor-acceptance.js` 最终 SHA-256 `e1f43068f7356153a5b1faae8990195dc6661f733fe603ac8ea3b31f9a1a74f3`。首次测试的右边距断言误把局部坐标当作从左边缘起算，测试失败但 `finally` 已恢复运行时变更；修正为 `parent.width/2 - (child.x + child.width/2)` 后重跑通过。父宽 960→1200 后子宽仍为 100、x 从 370→490、右边距为 60；恢复父宽后子节点回到 width=100、x=370。测试 `widget-right-anchor` 通过，`requiresManualReview=false`、`newErrors=[]`。预览由 CLI 停止，临时脚本删除。
- CLI 来源补偿删除精确测试子树：operation `72e53d77-0cfb-4bf8-a0bc-97835989a29c`，plan hash `b8ba4b3d43b70f757df0a806567f322b229a74b18fa7fed773cdef6a445c3805`；回执确认两个 UUID 从保存场景移除、`.fire` / `.meta` 恢复基线。随后 CLI 关闭进程 `9029` 并重开，实例 `00afa00c-8c82-4909-b022-fbe3352047ad` 返回 `editorReady=true`。`creator.project.info` 确认路径、Creator 2.4.15、扩展 0.8.74、场景 UUID；快照为 23 节点且无测试 UUID；文件哈希再次匹配基线。
- 本项通过证明 Creator 2.4.15 单边右锚在父宽 960→1200 时保持 right=60、子宽 100 不变，并将局部 x 从 370 调整为 490。不同 Canvas 设计分辨率及其他单边偏移组合仍未验收。
