# Creator 2.4 Prefab 源内容受约束编辑 0.1

> 当前实现由 `tools/cocos-creator-agent-cli/` 独立拥有；仓库不再提供 Creator 原生 CocosAgent 产品。本文保留设计与历史验证依据，旧版 0.3.x 扩展记录不代表当前 CLI 的实机验收。

## 目标

支持对**已有 Prefab 资源源内容**做连续、可核验的小幅修改。它与 `scene.node.patch` 的活动场景实例编辑分开：此命令进入指定 Prefab 的编辑模式，保存源资源，退出后重新打开，再比较活动对象与磁盘序列化结果。

本能力当前只面向 Creator **2.4.15**。3.8.7 没有新增 Prefab 源编辑命令。

## 当前 CLI 范围（0.12.62 / 扩展 0.8.111）

当前 `creator.prefab.source.patch` 除节点名称、激活状态、二维位置/缩放，以及 Sprite/Label 的启用状态和 SpriteFrame 外，还支持通过 Creator Inspector 元数据读取和写入**已声明、公开、可序列化的组件属性**。值类型包括受限标量/枚举、向量、Size、Rect、Color、最多 32 项的声明类型数组、AssetDB 资源，以及有稳定身份的 Prefab 内节点/组件引用；赋值仍由 Creator Prefab 编辑模式执行，并须完成保存、退出、重开和磁盘读回。它不接受任意原始序列化字段或任意 JS 对象。

目前 Prefab patch 新增受限 UI 事件列表写入：Button、Toggle、ToggleContainer、Slider、ScrollView、PageView 和 EditBox 的白名单事件字段；事件目标必须是同一 Prefab 内具有稳定 ID 的节点，且目标组件与安全 handler 方法必须唯一可解析。Creator 2.4.15 Tank 中 `cc.Button.clickEvents` 已通过 apply 与 source-linked compensate 实机往返，保存、退出/重开、同 UUID 及 `.prefab`/`.meta` 读回均通过；其他 UI 事件属性仍待代表性实机验收。同父节点范围内的 sibling index 编辑已通过实机 apply/compensate 验收。扩展 0.8.65 新增同一 Prefab 内的节点换父级：差异绑定原/目标父级稳定 ID、路径和子节点索引，只允许当前 Prefab 内非根节点移动，拒绝跨 Prefab、循环和失配索引；Creator 2.4.15 Tank 的 apply/compensate、退出重开和源文件读回均通过。扩展 0.8.66 新增单个空叶子子节点插入/删除：绑定父节点完整的直接子节点列表，只允许没有后代和组件的子节点，并用 Creator Prefab 编辑模式保存、退出、重开和磁盘读回；Tank 实机 apply `911a6526-0eb4-42ea-a54b-1825ec71703f` 与 source-linked compensate `d1ca9ba7-5134-48c1-b2fe-c536339c1638` 均通过，源哈希精确恢复且 Prefab UUID 与 `.meta` 哈希保持不变。扩展 0.8.69 实现并修复实机发现的序列化 ID 与延迟销毁回退：`component.structure`：一次追加一个 Creator 已注册的内置 `cc.*` 组件，ID 在计划阶段生成；直接移除既有组件、用户脚本组件创建和多组件操作不支持。移除仅由 source-linked compensate 派生，且只能删除此次操作添加的精确组件，并检查组件依赖。该能力的 Creator 2.4.15 Tank 实机 apply 与 source-linked compensate 已通过，测试中发现并修复了 Creator 为未序列化 `_id` 生成 Prefab 合成稳定 ID，以及已进入延迟销毁队列时 `destroy()` 返回 `false` 的行为。详见[组件增删验收记录](traces/cocos-creator-cli-editing-acceptance-20261023.md#2026-10-24-后续prefab-内置组件追加与补偿删除)、[空叶子子节点验收记录](traces/cocos-creator-cli-editing-acceptance-20261023.md#2026-10-24-后续prefab-空叶子子节点增删)及[换父级验收记录](traces/cocos-creator-cli-editing-acceptance-20261023.md#2026-10-24-后续prefab-节点换父级)。Creator 2.4.15 Tank 工程已实测 `cc.BlockInputEvents.enabled` 与 `cc.Label.fontSize` 的 apply/compensate 往返；其他组件和值类型仍需代表性实机验收。声明类型数组中的 AssetDB 引用可以通过合同校验并生成计划，但本轮把 `cc.Label.materials` 设为空数组时被 Creator 属性读回拒绝，磁盘源文件未变，不能据此宣称数组资源写入已通过。实机细节见 [2026-10-24 Prefab UI 事件列表和同级重排验收记录](traces/cocos-creator-cli-editing-acceptance-20261023.md#2026-10-24-后续prefab-ui-事件列表写入)。

## 命令

- `creator.prefab.source.inspect`：只读解析 `.prefab` 和 `.meta`，以 Prefab UUID 定位唯一资源，返回源 SHA-256、节点路径/UUID、层级、有限组件摘要和受支持字段当前值。
- `creator.prefab.source.patch.plan/commit/reconcile`：针对一个节点的一组白名单字段执行 `apply`、`compensate` 或 `replay`，并写入持久操作记录。除节点和声明属性外，可编辑受支持组件的 UI 事件列表；事件目标和 handler 都必须解析到当前 Prefab 内的精确身份。

节点字段使用有限白名单，含同一父节点内的 sibling index；该字段还必须绑定父节点 ID，且索引必须落在当前子节点列表范围内。换父级使用 `node.parent`，精确绑定 before/after 父节点 UUID、Prefab 内路径与 siblingIndex；一次只移动一个非根节点，目标必须在同一 Prefab 内且不能构成循环，插入索引不得超出目标父级子节点范围。`node.child` 精确绑定父节点完整的直接子节点列表，一次只插入或移除一个没有组件、没有后代的叶子节点。`node.subtree` 可一次插入至多 16 个节点、深度至多 4 的无组件子树；各节点 ID 在计划阶段生成，删除仅允许由 source-linked compensate 精确移除本次添加的整棵子树。该路径已通过 Creator 2.4.15 Tank 实机插入、补偿、保存、退出重开和源哈希往返验收。`component.structure` 一次只向一个节点追加一个注册的内置或项目脚本组件，并绑定组件类、索引和计划阶段生成的组件 ID；source-linked compensate 仅删除该源操作新建的精确组件，且要求没有组件依赖。已有组件可通过 `apply` 删除，但仅限末尾、无依赖的注册内置 `cc.*` 组件；计划必须捕获 enabled、稳定/合成身份和所有公开 Inspector 可序列化字段，字段类型限受支持的标量、向量、Size、Rect、Color，且组件不得含未捕获事件列表。来源补偿按捕获身份重新添加组件，并经 Creator setter 恢复字段；已在 Creator 2.4.15 实机覆盖 `cc.BlockInputEvents.enabled` 与 `cc.ToggleGroup.allowSwitchOff`。引用、数组、不支持的字段类型、组件依赖、非末尾组件和不满足读回约束的情况继续拒绝。组件字段由 Creator 实时 Inspector 元数据约束，并绑定组件实例、序列化类、属性名和 before/after 值；受支持类型见上面的当前 CLI 范围。UI 事件列表使用单独的事件字段白名单，并绑定组件身份、事件属性、Prefab 内目标节点、目标组件及 handler。任意原始序列化字段仍不开放。

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

当前 CLI 0.12.62 / Creator 扩展 0.8.111 包含 Prefab 源编辑合同、Creator 场景进程实现、受限 UI 事件列表写入、同父节点顺序变更、同 Prefab 节点换父级、空叶子节点增删、有限子树插入、公开属性写入和组件结构编辑。Creator 2.4.15 Tank 已验收的 Prefab 闭环包含节点字段、Button clickEvents、组件追加与来源补偿、`cc.BlockInputEvents.enabled`、`cc.Label.fontSize`、`cc.ToggleGroup.allowSwitchOff`、兄弟顺序、换父级、空叶子节点和子树插入。既有组件删除在 0.8.108 下通过 `cc.BlockInputEvents` 和 `cc.ToggleGroup` 实机删除、来源补偿、Creator 关闭/重开、字段读回与哈希核验；默认值已等于恢复值时的 setter 无变化冲突也有自动化回归。扩展 0.8.109 修正 Prefab 组件属性数组新增资产引用时磁盘读回丢失元素 Inspector 类型元数据的问题，并已在 Creator 2.4.15 对 `cc.Sprite.materials` 的 Material UUID 做追加、来源补偿、整工程 CLI 关闭/重开及 Prefab/`.meta` 精确哈希恢复验收。扩展 0.8.110 将磁盘 `null` 按 Inspector 声明恢复为 typed empty node/component reference；Tank 的 `cc.Button.target` 已通过 Prefab 内节点引用写入、Creator 读回、来源补偿和整工程 CLI 关闭/重开，Prefab 与 `.meta` 哈希恢复。扩展 0.8.111 为未序列化 `_id` 的 Prefab 组件引用生成稳定身份，并在 Creator 实机通过 `cc.Slider.handle` 指向同 Prefab 根 `cc.Button`、Inspector 读回、来源补偿、整工程 CLI 关闭/重开和精确哈希恢复。详见[Prefab 资源数组轨迹](../../docs/agent-foundation/traces/cocos-creator-cli-prefab-asset-array-acceptance-20261025.md)、[Prefab 空引用轨迹](../../docs/agent-foundation/traces/cocos-creator-cli-prefab-null-reference-acceptance-20261025.md)和[Prefab 组件引用轨迹](../../docs/agent-foundation/traces/cocos-creator-cli-prefab-component-reference-acceptance-20261025.md)。其他 UI 事件属性、数组资源引用的更多组件/资源组合、全部 Inspector 类型、非叶子子树及任意多组件编辑仍待逐项验收。不能把部分实机覆盖写成任意 Prefab 编辑已完成。

以下 0.3.x 扩展记录是历史原型验证，不代表 CLI 的当前运行时证据：

- 完成扩展消息、Host 持久操作记录、JSON Schema、MCP 命令目录、只读源检查和序列化层级校验。
- 2026-10-13：0.3.14 场景进程桥接已实现，移除主进程固定返回 `null` 的入口；本轮构建与语法检查结果另行记录，未运行新的自动测试或真实 Prefab 写入。
- 2026-10-13：0.3.16 修正场景端重开及 Host 磁盘读回沿用改名前路径的问题，并拒绝末段与改名前值不一致的输入。构建/语法检查不替代原生改名、二次改名、补偿和重放的实机验收。
- 通过 Prefab 合同、差异逆转、目标节点路径/UUID、序列化父子关系与只读资源检查测试。Host 模拟扩展通道完成同一 Prefab 两轮修改、陈旧哈希拒绝、第二轮补偿/重放及首轮补偿，并逐轮检查哈希和父子、组件、SpriteFrame 引用关系；模拟通道只验证 Host 编排和持久记录，不验证 Creator 内部编辑模式时序。仓库内 Host 回归、双版本目录、多实例 Catalog Host 和 MCP schema/routing 测试均通过。
- **仍待补齐**：数组资源引用的实际写入与补偿、更多 Inspector 类型、其他 UI 事件属性、节点/组件结构编辑、SpriteFrame 引用改换及其恢复。每类必须在 Creator 2.4.15 中按 CLI 计划→提交→关闭/重开→同一 UUID 与磁盘 `.prefab`/`.meta` 读回流程逐项验收；源码模拟或合同测试不能替代实机证据。
- 在实机验收完成前，不把此命令描述成已验证能力，也不在 `AGENTS.md` 中登记为完成项。

## 入口

工作流见 [cocos2-prefab-source-edit skill](skills/cocos2-prefab-source-edit/SKILL.md)。
