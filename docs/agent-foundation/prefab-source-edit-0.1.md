# Creator 2.4 Prefab 源内容受约束编辑 0.1

> 当前实现由 `tools/cocos-creator-agent-cli/` 独立拥有；仓库不再提供 Creator 原生 CocosAgent 产品。本文保留设计与历史验证依据，旧版 0.3.x 扩展记录不代表当前 CLI 的实机验收。

## 目标

支持对**已有 Prefab 资源源内容**做连续、可核验的小幅修改。它与 `scene.node.patch` 的活动场景实例编辑分开：此命令进入指定 Prefab 的编辑模式，保存源资源，退出后重新打开，再比较活动对象与磁盘序列化结果。

本能力当前只面向 Creator **2.4.15**。3.8.7 没有新增 Prefab 源编辑命令。

## 当前 CLI 范围（0.12.55 / 扩展 0.8.63）

当前 `creator.prefab.source.patch` 除节点名称、激活状态、二维位置/缩放，以及 Sprite/Label 的启用状态和 SpriteFrame 外，还支持通过 Creator Inspector 元数据读取和写入**已声明、公开、可序列化的组件属性**。值类型包括受限标量/枚举、向量、Size、Rect、Color、最多 32 项的声明类型数组、AssetDB 资源，以及有稳定身份的 Prefab 内节点/组件引用；赋值仍由 Creator Prefab 编辑模式执行，并须完成保存、退出、重开和磁盘读回。它不接受任意原始序列化字段或任意 JS 对象。

目前 Prefab patch 新增受限 UI 事件列表写入：Button、Toggle、ToggleContainer、Slider、ScrollView、PageView 和 EditBox 的白名单事件字段；事件目标必须是同一 Prefab 内具有稳定 ID 的节点，且目标组件与安全 handler 方法必须唯一可解析。Creator 2.4.15 Tank 中 `cc.Button.clickEvents` 已通过 apply 与 source-linked compensate 实机往返，保存、退出/重开、同 UUID 及 `.prefab`/`.meta` 读回均通过；其他 UI 事件属性仍待代表性实机验收。同父节点范围内的 sibling index 编辑也已通过实机 apply/compensate 验收，计划绑定父节点稳定 ID 和前后索引，不允许重挂父级或重排根节点。子节点新增/删除、改变父子层级、新增/删除组件仍不支持。Creator 2.4.15 Tank 工程已实测 `cc.BlockInputEvents.enabled` 与 `cc.Label.fontSize` 的 apply/compensate 往返；其他组件和值类型仍需代表性实机验收。声明类型数组中的 AssetDB 引用可以通过合同校验并生成计划，但本轮把 `cc.Label.materials` 设为空数组时被 Creator 属性读回拒绝，磁盘源文件未变，不能据此宣称数组资源写入已通过。实机细节见 [2026-10-24 Prefab UI 事件列表和同级重排验收记录](traces/cocos-creator-cli-editing-acceptance-20261023.md#2026-10-24-后续prefab-ui-事件列表写入)。

## 命令

- `creator.prefab.source.inspect`：只读解析 `.prefab` 和 `.meta`，以 Prefab UUID 定位唯一资源，返回源 SHA-256、节点路径/UUID、层级、有限组件摘要和受支持字段当前值。
- `creator.prefab.source.patch.plan/commit/reconcile`：针对一个节点的一组白名单字段执行 `apply`、`compensate` 或 `replay`，并写入持久操作记录。除节点和声明属性外，可编辑受支持组件的 UI 事件列表；事件目标和 handler 都必须解析到当前 Prefab 内的精确身份。

节点字段使用有限白名单，含同一父节点内的 sibling index；该字段还必须绑定父节点 ID，且索引必须落在当前子节点列表范围内。组件字段由 Creator 实时 Inspector 元数据约束，并绑定组件实例、序列化类、属性名和 before/after 值；受支持类型见上面的当前 CLI 范围。UI 事件列表使用单独的事件字段白名单，并绑定组件身份、事件属性、Prefab 内目标节点、目标组件及 handler。子节点增删、父子层级调整、组件增删和任意原始序列化字段仍不开放。

## 一轮写入的合同

`apply` 必须携带最近一次 `prefab.source.inspect` 返回的 Prefab UUID、目标节点路径和 UUID、当前 `sourceSha256`，以及每个字段明确的 `before` / `after`。执行前 Host 会再次核对唯一 `.meta` UUID、AssetDB URL 映射、源 SHA-256、目标节点身份、完整层级索引和字段前值；扩展进入指定 Prefab 编辑模式后还会再核对一次活动节点状态。

写入只经过 Creator 扩展和 Prefab 编辑模式。保存回调及 `scene:saved` 信号完成后，Host 检查源文件哈希和 UUID；扩展退出并重新进入同一 Prefab，按 UUID 与路径读回活动对象；最后 Host 重新解析磁盘 Prefab，核对字段差异、UUID、子父索引及组件反向关联。只有这些读回全部一致，操作才达到 `disk: passed`。

下一轮必须重新调用 `prefab.source.inspect`，读取新的源哈希和字段值。旧哈希用于新一轮写入会被 `PREFAB_SOURCE_STALE` 拒绝。这样同一 Prefab 的每一轮修改都链接到新状态，不把前一轮的 before 值套用到后续内容。

改名时 `targetNodePath` 的末段必须等于差异中 `node.name.before`。预检使用该 before 路径；保存重开和磁盘读回仅将末段派生为 `node.name.after`，仍要求同一节点 UUID、相同父级路径、唯一层级及所有字段一致。补偿和重放使用当次 manifest 的 before/after 路径规则；不会只凭 UUID 跳过路径校验。

只读检查反映磁盘上已保存的 Prefab。若 Creator 正在 Prefab 编辑模式且有未保存修改，先保存或退出并检查；写入命令会拒绝从现有 Prefab 子模式开始，避免把未保存状态当作磁盘基线。

`compensate` 通过已完成操作的 `sourceOperationId` 派生逆向差异；执行前要求当前 Prefab 哈希等于源操作的 after 哈希，且活动与磁盘字段仍匹配。完成补偿后，`replay` 必须基于该已完成的补偿操作和新的 operation ID。禁止直接重发旧 apply 或用旧哈希覆盖更新后的 Prefab。

## 编辑器 API 边界

2.4 官方[Prefab 手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/prefab.html)描述了进入 Prefab 编辑模式、保存和关闭编辑模式的工作流。官方 [FAQ](https://docs.cocos.com/creator/2.4/manual/zh/getting-started/faq.html)列出通过 `Editor.Ipc.sendToAll('scene:enter-prefab-edit-mode', assetUuid)` 进入模式的扩展用法。

扩展 0.3.14 把 `scene://edit-mode` 的加载、`curMode` 查询、`save` 和 `pop` 调用移到 `scene.js`。主进程通过 `Editor.Scene.callSceneScript` 调度，按官方[场景脚本机制](https://docs.cocos.com/creator/2.4/manual/zh/extension/scene-script.html)跨进程收取结果，避免主进程未注册 `scene://` 协议的错误。安装包中可确认模块位于 `editor/page/scene-utils/edit-mode/`；本轮没有读取加密 `.ccc` 模块的方法实现，不据此推断完整运行时行为。

能力目录采用场景端的实际探测结果：必须处于非主进程，且 `curMode`、`save`、`pop` 都存在、当前模式可读。进入仍用官方 IPC；保存必须收到场景端保存回调与 `scene:saved`，退出必须收到场景端回执与 `scene:ready`，并读回原场景 UUID。保存、退出、预检、修改和重开读回均重验 Prefab 模式及 UUID；资源加载后写入前再次核对节点身份、路径、字段前值和同名冲突。场景脚本调用有 20 秒超时且只完成一次回调；修改后超时或读回不一致按可能有副作用上报，继续走现有操作账本恢复。

`save/pop` 是内部接口，并非手册或 FAQ 承诺的公开 API。存在性探测不能证明完整时序正确；真实 2.4.15 编辑器验收必须覆盖进入、保存、退出、重新打开和磁盘读回。若任一步不匹配，操作必须失败或停在 `needs-review`，不能标记成功。

## 当前验证状态

当前 CLI（0.12.55 / Creator 扩展 0.8.63）已有 Prefab 源编辑合同、Creator 场景进程实现、受限 UI 事件列表写入和同父节点顺序变更。Creator 2.4.15 Tank 的节点字段及 `cc.BlockInputEvents.enabled`、`cc.Label.fontSize` apply/compensate 实机往返是在扩展 0.8.55 下完成；随后 reconciliation 分类修复随扩展 0.8.56 更新并经 CLI 退出/重开确认加载。0.8.59 的 `cc.Button.clickEvents` 和 0.8.63 的同父节点 sibling index apply/compensate 已通过 Creator CLI 实机验收；其他支持的 UI 事件属性尚无实机写入证据。组件属性全类型和其他 Prefab 结构编辑仍未完成。不能把部分实机覆盖写成任意 Prefab 编辑已完成。

以下 0.3.x 扩展记录是历史原型验证，不代表 CLI 的当前运行时证据：

- 完成扩展消息、Host 持久操作记录、JSON Schema、MCP 命令目录、只读源检查和序列化层级校验。
- 2026-10-13：0.3.14 场景进程桥接已实现，移除主进程固定返回 `null` 的入口；本轮构建与语法检查结果另行记录，未运行新的自动测试或真实 Prefab 写入。
- 2026-10-13：0.3.16 修正场景端重开及 Host 磁盘读回沿用改名前路径的问题，并拒绝末段与改名前值不一致的输入。构建/语法检查不替代原生改名、二次改名、补偿和重放的实机验收。
- 通过 Prefab 合同、差异逆转、目标节点路径/UUID、序列化父子关系与只读资源检查测试。Host 模拟扩展通道完成同一 Prefab 两轮修改、陈旧哈希拒绝、第二轮补偿/重放及首轮补偿，并逐轮检查哈希和父子、组件、SpriteFrame 引用关系；模拟通道只验证 Host 编排和持久记录，不验证 Creator 内部编辑模式时序。仓库内 Host 回归、双版本目录、多实例 Catalog Host 和 MCP schema/routing 测试均通过。
- **仍待补齐**：数组资源引用的实际写入与补偿、更多 Inspector 类型、其他 UI 事件属性、节点/组件结构编辑、SpriteFrame 引用改换及其恢复。每类必须在 Creator 2.4.15 中按 CLI 计划→提交→关闭/重开→同一 UUID 与磁盘 `.prefab`/`.meta` 读回流程逐项验收；源码模拟或合同测试不能替代实机证据。
- 在实机验收完成前，不把此命令描述成已验证能力，也不在 `AGENTS.md` 中登记为完成项。

## 入口

工作流见 [cocos2-prefab-source-edit skill](skills/cocos2-prefab-source-edit/SKILL.md)。
