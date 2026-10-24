# Creator CLI Layout 间距与重开验收（2026-10-24）

## 目标与身份

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15；扩展：0.8.72
- 场景：`CliAcceptanceScene`，scene UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 布局节点：`CliLayoutTest`，node UUID `d77e9d7e-5b73-4bb1-88d4-df5654ccc3a3`
- 组件：`cc.Layout`，component UUID `edg9tFEsROhr/mNDQ2QvsK`
- 子节点 A：UUID `5946bc1d-c19e-43b3-82ef-271db36f5e6d`；子节点 B：UUID `32545051-677f-4759-9d59-e6a391eaa391`

## 写入、运行时检查与补偿

1. 原始状态为 `spacingY=10`，纵向 top-to-bottom，A=`y85`、B=`y45`。保存场景基线 SHA-256 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
2. CLI 计划并提交 `spacingY=10→20`：operation `6a46f174-c891-49a2-841a-abb2bf25fd48`，plan hash `1584b74abfc754b7cf35b15634339378776c9146700aa780634d560df05746d6`。Creator 保存后序列化 `_N$spacingY=20`，场景哈希变为 `73a7d620645ec5f57a22d03c78e5a611f0d4ef127e7bcf48c2e8216c8ab3b392`，`.meta` 不变。
3. CLI 预览会话 `73494c24-86ac-4373-8424-b1585218a5a6` 对 `CliLayoutTest` 调用 `cc.Layout.updateLayout()`，并断言无运行时错误、场景身份、`spacingY=20`、A=`y85`、B=`y35`，断言全部通过。显式刷新回执的 `changed:false`；Creator 在预览启动时已应用保存的布局，所以该次调用没有再改变几何。此记录只证明预览状态和断言通过，不声称显式刷新改变了位置。
4. CLI 关闭并重开后，Creator 2.4.15 / 扩展 0.8.72 握手成功。CLI 场景快照读回 `_N$spacingY=20`、A=`y85`、B=`y35`。
5. CLI 补偿计划/提交 `spacingY=20→10`：operation `d07a7e28-935c-4c6f-ace8-4cbe9a5fa34a`，plan hash `9c1876e61956758840ea620e2f2fc082b717c8f31b1155739685b24b7adc2392`。`creator.scene.node.set-component-property.reconcile` 确认状态 `completed`，磁盘属性为 10，场景和 `.meta` 哈希恢复到原基线。
6. 补偿后再次由 CLI 关闭工程，确认进程退出；CLI 重开返回 `editorReady=true`，新实例 `f560af24-60f4-4057-b030-53043654df96`。`creator.project.info` 核对工程路径、Creator 2.4.15、扩展 0.8.72 和场景 UUID；场景快照读回 `spacingY=10`、A=`y85`、B=`y45`。只读文件哈希再次等于基线值。

## 结果边界

`cc.Layout.spacingY` 单字段写入、预览属性/几何断言、关闭重开读回、来源补偿和基线恢复已通过 Creator 2.4.15 / 纯 Cocos CLI 验收。显式 `ui-refresh` 执行时布局几何已由预览启动阶段应用，故 `changed:false`；后续需设计可观察的运行时输入变化来单独验证刷新调用会触发布局。横向布局、padding、Resize Mode 和其它布局字段仍未验收。

## 2026-10-24 后续：水平 Layout、左 padding 与 spacingX

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15 / 扩展 0.8.73，活动场景 UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。开始前 `.fire` / `.meta` 基线为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74` / `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
- 先尝试用 `creator.scene.compose.plan` 一次创建节点并传 `cc.Layout.type=1`、`horizontalDirection=0`、`paddingLeft=20`、`spacingX=10`；计划器返回 `SCENE_COMPOSE_PROPERTY_TYPE_UNSUPPORTED`，未产生场景写入。改用 CLI 组合创建父子节点和空的 `cc.Layout`：operation `5f73515d-d9f6-446c-9c19-81e15fc7d644`，plan hash `7603ee78cc49b3eacf8fbc7dd35685c187b31708b84e318ee81435420c46fcc2`。父 UUID `052cefda-db27-490d-8e70-c8f4c2611657`，尺寸 500×120；三个子 UUID 依次为 `c98fbd30-aef3-4f0d-92b8-01ec8717b274`、`363b8315-02b1-49c0-bab1-f2bb33a599ee`、`c26627f9-546f-42b8-8cfc-65dcfa54aae9`，宽度分别 40/60/80。Layout 组件 ID `82JmVwKKVC+L3CQJThE0IB`。
- 通过 `creator.scene.node.set-component-property.plan/commit` 分别设置 `type=1`、`paddingLeft=20`、`spacingX=10`。对应 operation / plan hash：`1c3da859-743f-4ddd-8e22-4007d2b55808` / `ee8d8b295e3d8555850731421fc336a5df9ec8d19e23af9b472ffa202a0ccfb3`；`9f9300a3-3325-4cc6-805e-85338d918fdc` / `3feba518bab403391d03ba70c5210f469148c13aff896288b7a03627c620f7c4`；`c6a403c5-dd3f-4268-ac56-99735e316813` / `cf00e7295ebef4341c2f0f2598b8ce5977d73ca7aaf45c41afbb362b21258ce0`。三个提交均 `completed` 且磁盘属性读回 `verified=true`；`type` 序列化为 `_N$layoutType=1`，两个数值字段分别为 `_N$paddingLeft=20`、`_N$spacingX=10`。按 Creator 2.4.15 源码，默认 `resizeMode=NONE`、`horizontalDirection=LEFT_TO_RIGHT`，均为 0。
- CLI 关闭创建实例 `b908ebce-1f66-44cd-8b36-dab204035e55` 并重开，实例 `e49d70ed-8873-49fc-ac33-22a3f285c42b` 返回 `editorReady=true`。`creator.project.info`、场景快照和 `creator.scene.ui.inspect` 确认工程/场景、父子 UUID、尺寸、属性及组件 ID。重开后的子节点 x 为 `[-210,-150,-70]`，y 均为 0。
- 预览前 diagnostics 序号 2，只有两条既存 `CliAcceptanceButtonState` warning，`latestCompile=null`。Preview session `8cb1c4c8-1336-4b4e-9b47-a34d478206fa`、Creator session `d850e34c-ea32-4790-9dbb-93eae58174bb` 匹配正确场景，启动 `consoleErrorCount=0`。临时脚本 `.cocos-agent/preview-tests/layout-horizontal-acceptance.js`，SHA-256 `0aff57b2bc32e05f802ceae34866083b4b41c0df9e39b939644d78c5ee6d2321`，先调用 `Layout.updateLayout()` 断言 x 为 `[-210,-150,-70]`；将 live Preview 中的 `paddingLeft` 从 20 改为 40 后再次更新，断言 x 变为 `[-190,-130,-50]`；`finally` 恢复为 20 并确认 x 回到初值。测试 `layout-horizontal-padding-spacing` 通过，`requiresManualReview=false`、`newErrors=[]`；预览停止且临时脚本删除。
- CLI 来源清理 operation `49e7867b-d4fa-40c0-8bce-7c3202a10401`，plan hash `668a7f873c0ae8727a3727fe05093a6d7223f9ce4cec8d6bbae2a506d54d0865`；四个 UUID 从保存场景消失，`.fire` / `.meta` 回到基线。CLI 关闭实例 `e49d70ed-8873-49fc-ac33-22a3f285c42b`，确认 instances 为空，再开同一工程得到 `editorReady=true` 实例 `150d7b4f-73a1-4c64-8298-562714534270`。重开后 `creator.project.info` 与场景快照确认路径、Creator 2.4.15、扩展 0.8.73、活动场景和节点数 23 一致，测试 UUID/名称不存在；本地只读哈希与 CLI 删除回执一致。
- 本项通过证明水平 Layout 的 enum `type` 可用通用单字段属性计划写入并重开读回，左 padding 和水平 spacing 可影响运行时子节点位置并可恢复。组合创建命令直接接收 enum 属性目前拒绝 `SCENE_COMPOSE_PROPERTY_TYPE_UNSUPPORTED`，后续应修复该路径或明确收紧其合同；本项不覆盖 `resizeMode`、子节点尺寸模式、右向左方向或 `ui-refresh` 命令自身。
