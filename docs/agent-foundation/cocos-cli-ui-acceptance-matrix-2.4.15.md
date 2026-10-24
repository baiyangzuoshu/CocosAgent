# Cocos CLI UI 编辑验收矩阵（Creator 2.4.15）

本矩阵拆分 **Creator 引擎注册、CLI 接口覆盖、实机证据** 三种状态。引擎清单来自 `2.4.15engine/cocos2d/core/components/index.js`；CLI 场景 Inspector 名单来自 `creator-extension/scene.js` 的 `UI_COMPONENT_CLASS_NAMES`；UI 事件字段来自 `UI_EVENT_PROPERTIES`；Widget/Layout 运行时刷新来自 `bridge/runtime-preview.mjs`。静态注册或通用属性合同不等于该组件的写入已经实机验收。

状态：`实机基线` 表示既有 Tank 验收记录至少包含组件创建/挂载、读取或代表属性编辑，但不表示穷举属性；`字段往返` 表示已记录 Creator 保存、CLI 重开/读回及来源补偿；`接口具备` 表示 CLI 路径存在，尚缺该组件的实机闭环；`待补接口` 表示当前 UI 专用检查/运行时交互入口没有覆盖该组件。

## Creator 2.4.15 引擎注册组件

| 组件 | CLI UI 检查 | 属性编辑路径 | 事件/布局路径 | 当前证据 | 后续验收 |
| --- | --- | --- | --- | --- | --- |
| `cc.Canvas` | 有 | 通用 Inspector 属性 | 无专用刷新 | 实机基线 | 检查设计分辨率/渲染模式公开字段的写回 |
| `cc.Sprite` | 有 | 通用属性；专用 enabled/SpriteFrame 字段 | 无 | SpriteFrame AssetDB UUID 写入、重开读回、清空恢复和节点尺寸补偿通过；临时资源经 AssetDB 删除 | 检查实际渲染；继续验收其他 Sprite 字段和数组资源引用 |
| `cc.Widget` | 有 | 通用 Inspector 属性 | 预览可调用 `updateAlignment()` | 左右双锚父宽 960→1200 时子宽 100→340、x=-420；上下双锚父高 640→800 时子高 100→260、y=0；四边锚父节点 960×640→1200×800 时子节点 880×580→1120×740、中心不变；非对称左右边距 30/70 时父宽 960→1200，子宽 860→1100、x 始终 -20；单边右锚 right=60 时父宽 960→1200、子宽保持 100，x=370→490；Canvas 预览框 960×640→1280×720 后，Canvas 扩宽且左右边距 40 的子节点按新 Canvas 宽度拉伸并保持居中。各项均经预览内恢复、关闭/重开读回、清理和基线哈希核验。详见 Widget 轨迹 | 其他单边偏移组合 |
| `cc.Layout` | 有 | 通用 Inspector 属性；组合创建和单字段计划均接受 Creator 声明的枚举和值类型 | Preview 脚本可调用 `updateLayout()` | `spacingY`、水平 `type=HORIZONTAL`、`paddingLeft`、`spacingX` 已验收；`ResizeMode.CHILDREN` 下父宽 500→600 时子宽 225→275、位置 ±117.5→±142.5；`ResizeMode.CONTAINER` 下子宽 60→80 时容器宽 210→230、第二子 x 35→45。两项均通过重开读回、预览内恢复、精确删除补偿和 `.fire`/`.meta` 基线恢复。详见 Layout 轨迹 | 子节点缩放系数、网格尺寸模式、右向左布局、非左侧 padding 方向 |
| `cc.Label` | 有 | 通用属性；专用 enabled | 无 | `fontSize` Prefab apply/compensate 已往返 | 文字、尺寸/对齐、颜色/溢出字段代表项 |
| `cc.RichText` | 有 | 通用 Inspector 属性 | 无 | 实机基线 | 文本、图片标签及相关序列化字段代表项 |
| `cc.LabelOutline` | 无 | 通用属性入口可按实例尝试 | 无 | 接口具备 | 专用检查与挂载/字段实机验证 |
| `cc.LabelShadow` | 无 | 通用属性入口可按实例尝试 | 无 | 接口具备 | 专用检查与挂载/字段实机验证 |
| `cc.Button` | 有 | 通用 Inspector 属性 | `clickEvents` | 场景点击业务行为通过；独立 Prefab 子树新增 Button、`zoomScale`、`clickEvents` 均经 CLI 关闭/重开读回和来源补偿通过；详见 [Prefab 子树验收](cocos-cli-prefab-subtree-acceptance-20261024.md) | 状态颜色/Sprite 引用字段代表项；Widget/Layout几何与运行效果仍单独验收 |
| `cc.Toggle` | 有 | 通用 Inspector 属性 | `clickEvents`、`checkEvents` | 实机基线；事件仅接口 | checked 与事件往返及运行时切换 |
| `cc.ToggleContainer` | 有 | 通用 Inspector 属性 | `checkEvents` | 实机基线；事件仅接口 | 排他切换与事件往返 |
| `cc.ToggleGroup` | 无 | 通用属性入口可按实例尝试 | 无 | 接口具备 | UI 检查覆盖、挂载关系和组内行为 |
| `cc.Slider` | 有 | 通用 Inspector 属性 | `slideEvents` | 实机基线；事件仅接口 | progress、handle、事件和拖动行为 |
| `cc.ProgressBar` | 有 | 通用 Inspector 属性 | 无 | `progress` 0.5→0.75→0.5，预览属性断言、关闭重开读回、来源补偿和基线恢复通过；该夹具未挂 `barSprite`，未验收可视填充效果 |
| `cc.EditBox` | 有 | 通用 Inspector 属性 | 四种编辑事件 | 实机基线；事件仅接口 | text、输入类型、限制和事件的预览验证 |
| `cc.ScrollView` | 有 | 通用 Inspector 属性 | `scrollEvents` | 实机基线；事件仅接口 | View/Content/惯性字段与滚动/事件验证 |
| `cc.Scrollbar` | 有 | 通用 Inspector 属性 | 无 | `autoHideTime` 0.5→0.75→0.5，关闭重开读回、来源补偿和基线恢复通过；测试节点无 handle/ScrollView 关联，未验收滚动条行为 |
| `cc.PageView` | 有 | 通用 Inspector 属性 | `scrollEvents`、`pageEvents` | 实机基线；PageView.direction 有预览读回 | 页面滑动及两类事件往返 |
| `cc.PageViewIndicator` | 有 | 通用 Inspector 属性 | 无 | 实机基线 | Sprite/分页状态字段和预览行为 |
| `cc.Mask` | 有 | 通用 Inspector 属性 | 无 | `inverted` false→true→false，关闭重开读回、来源补偿和基线恢复通过；夹具无子节点和 SpriteFrame，未验收裁切效果 |
| `cc.BlockInputEvents` | 有 | 通用 Inspector 属性 | 无 | `enabled` Prefab apply/compensate 已往返 | 遮挡输入的预览行为和兄弟节点点击断言 |
| `cc.SafeArea` | 无 | 通用属性入口可按实例尝试 | 无 | 接口具备 | 专用检查覆盖及目标平台差异验证 |
| `cc.SubContextView` | 无 | 通用属性入口可按实例尝试 | 无 | 接口具备 | 专用检查覆盖；若需平台运行时则单独标注限制 |

`components/index.js` 还注册了 Animation、AudioSource、MotionStreak 等非 UI 组件；它们不计入本 UI 矩阵。组件被 Creator 注册也不保证当前安装版编辑器菜单、目标平台或具体工程提供相同能力，执行时仍需通过当前实例的 CLI 读回确认。

## CLI 跨组件能力和证据

| 编辑能力 | CLI 当前入口 | 范围/限制 | 实机证据状态 |
| --- | --- | --- | --- |
| 节点与组件挂载 | `creator.scene.compose.*`、`creator.scene.node.add-component.*` | 单次计划受节点数、层级、已注册类和组件依赖约束 | 18 个验收夹具组件的挂载有累计记录；本表不声称组件组合全覆盖 |
| Prefab UI 子树 | `creator.prefab.source.patch.*` | `node.subtree` 插入最多 16 个无组件节点，随后逐节点追加一个注册内置组件；结构删除只允许按原操作来源补偿；自定义脚本组件创建和已有组件直接删除不支持 | Creator 2.4.15 已对两层子树 + 子 Button + 标量属性 + Button 事件完成保存、整工程 CLI 重开、读回、逐层来源补偿和临时资产清理 |
| UI 属性检查 | `creator.scene.ui.inspect` | 当前专用名单为上表标“有”的 18 个；逐项读取声明的公开 Inspector 属性，并返回 unsupported 原因 | Label.fontSize、BlockInputEvents.enabled 有 Prefab 字段往返；其余仅按历史代表覆盖记录 |
| 通用组件属性 | `creator.scene.node.set-component-property.*`、Prefab `source.patch.*` | 依赖 Creator 的公开、可序列化声明属性和 CLI 支持值类型；不接受任意对象/字段 | 属性类型与组件的组合尚未穷举 |
| UI 事件 | `creator.scene.ui-events.set.*`；Prefab 同源 patch | Button、Toggle、ToggleContainer、Slider、ScrollView、PageView、EditBox 的白名单事件；绑定精确节点/组件/handler | 场景 Button 运行时点击通过；Prefab Button clickEvents 往返通过；其余组件/事件缺实机往返 |
| UI 几何刷新 | `creator.preview.interact` 的 `ui-refresh`；`creator.preview.test-script` 可执行有界页面内断言 | `ui-refresh` 只对精确节点上的 `cc.Widget.updateAlignment()`、`cc.Layout.updateLayout()`；Preview 脚本运行于 live `cc` 页面且不隔离，必须约束并恢复副作用 | Layout 纵向间距和水平 padding/spacing 几何断言通过；Widget 双轴双锚和四边锚父尺寸变化的数值断言通过；CLI `ui-refresh` 动作自身仍未单独验证 |
| 资源引用 | 组件属性 AssetDB UUID 值；Sprite 专用字段 | UUID、资源类和目标属性声明类型须匹配 | SpriteFrame 子资源 UUID 写入、重开、清空与 AssetDB 清理通过；数组资源引用未实机往返；`cc.Label.materials` 空数组写入已被 Creator 拒绝，源文件未变 |

既有累计证据见[CLI 编辑验收追踪](traces/cocos-creator-cli-editing-acceptance-20261023.md)。本矩阵在新增逐组件 operation ID、保存/重开/读回/补偿记录后更新状态；只有静态合同或单测时，不把“接口具备”升级为“实机通过”。

## 下一批操作顺序

1. **其他组件属性与资源数组**：继续从 `Scrollbar`、`Mask` 等事件/布局依赖少的组件开始；每次一个字段，验证写回、重开和补偿，再进入 Slider/Toggle/ScrollView/PageView/EditBox。单独验收含 AssetDB UUID 的数组字段往返。
2. **Widget/Layout 几何扩展**：补 Widget 不同 Canvas 分辨率、非对称边距及单边偏移；Layout Resize Mode/子节点尺寸模式、右向左布局和其他 padding 方向仍待覆盖。
3. **UI 事件**：保留原事件列表，逐组件增加一个目标明确的事件，预览触发并核对业务状态；关闭重开后检查 `.fire` 事件目标、组件和 handler，再补偿回基线。
4. **补全专用检查**：对 `LabelOutline`、`LabelShadow`、`ToggleGroup`、`SafeArea`、`SubContextView` 先核对运行时类和 Inspector schema，再决定纳入 UI 专用名单或明确保持通用组件入口；不可只凭类名推断字段。
5. **Sprite 渲染验收**：SpriteFrame 引用保存/恢复已通过，用 CLI 预览确认目标帧实际渲染。

每个单项均遵循 CLI 计划 → CLI 提交 → 必要时 CLI 关闭/重开 → 同实例核验工程路径和 Creator 版本 → 活动对象及磁盘 `.fire`/`.meta` 读回 → 来源补偿 → 再次关闭/重开及哈希读回。当前范围只推进 Creator 2.4.15；不使用桌面 UI 自动化。
