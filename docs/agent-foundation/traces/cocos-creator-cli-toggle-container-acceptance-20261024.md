# ToggleContainer CLI 验收轨迹（Creator 2.4.15）

## 环境与操作

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`；场景 `CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`；ToggleContainer 节点 UUID `885f082a-63b6-4ee8-baaf-922c343e12c0`。
- Cocos CLI 0.12.59、Creator 2.4.15、项目扩展 0.8.91。工程绝对路径、Creator 版本、活动场景和实例握手均由 CLI 核对；创建、读写、关闭、重开、预览和清理均通过 Cocos CLI 完成，没有使用桌面 UI 自动化或直接修改 `.fire`/`.meta`。
- 原场景 `.fire` SHA-256：`cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`；`.meta` SHA-256：`269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。ToggleContainer 原 `checkEvents=[]`，`allowSwitchOff=true`。

## 事件写入与重开读回

- `creator.scene.ui-events.set.plan/commit` 将 `checkEvents` 临时设为目标节点 `Canvas/Button`、组件 `CliAcceptanceButtonState`、handler `onUiEvent`、`customEventData=toggle-container-event-test`。apply operation `ab219e59-9904-4094-b493-369ee7f1b2bf`，plan hash `eadacd6ba11f8e529f31d112792c48018e35e6769ae41a8a333620fb77d10999`，状态 `completed`。
- 写入时 `.fire` 读回 SHA-256 为 `9f5ac83de61a4678f69e06d4dace06729f1122a828010cbdc57b02b668c747b3`，目标组件身份、完整事件字段和 `.meta` 哈希均匹配。随后 CLI 关闭进程并重新打开同一绝对路径，Creator 2.4.15 / 扩展 0.8.91 就绪；`creator.scene.ui.inspect` 和事件 reconcile 再次读到该完整事件列表，reconcile 为 `completed`。

## ToggleContainer 运行时行为

- 通过 `creator.scene.compose.plan/commit` 临时创建两个直接子节点和 `cc.Toggle`：Option A UUID `af8c1ca4-d4d6-4141-be11-e41fe34bcbbe`（`isChecked=true`），Option B UUID `e0e8b64a-cb2a-4685-9c98-68790609796b`（`isChecked=false`）。操作 `c26b5400-bd5b-4333-a437-bee62c36e2d1` 写入后 `.fire` 读回确认两个节点、父子关系、组件与属性。整工程 CLI 关闭/重开后再次核对节点 UUID、父节点、变换与组件身份。
- Preview session `1b645160-5e1d-4517-a09b-2ba3800cb2dc`，Canvas 960×640。归一化坐标 `(0.495, 0.172)` 点击 Option B 后，运行时断言通过：Option A `isChecked=false`、Option B `isChecked=true`、handler `lastValue=toggle-container-event-test`、无新增错误。再次点击已选中的 Option B 后，两个 Toggle 均为 `false`，验证 `allowSwitchOff=true`。
- 此夹具未配置 Sprite、Button 视觉状态或 Toggle `checkMark`，因此只证明运行时输入、排他切换、允许取消选中和事件派发，不证明 Toggle 的外观样式。

## 来源补偿、清理与最终读回

- 事件来源补偿 operation `4b5b363d-0bfe-4287-834a-e5b327447779` 从上述 apply 派生，恢复 `checkEvents=[]`；Creator 保存请求后精确 `.fire` 读回确认事件为空，补偿后临时场景哈希为 `1814f7d3d1b3ad19dda621030867a215d93f0678ae9d259014a6fe819200b609`。
- CLI 停止 Preview，并用 `creator.scene.node.delete.plan/commit` 分别删除 Option A（operation `6f404b55-facd-4651-ad34-3eb839315a50`）与 Option B（operation `43c888ee-034e-4cf8-b3c9-c688251eb64a`）。最终删除读回 SHA-256 为原始场景值 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 哈希仍为原值。
- 再次由 CLI 关闭并重开工程。最终 ToggleContainer 检查显示 `checkEvents=[]`；两个临时 UUID 均返回 `SCENE_NODE_NOT_FOUND`；补偿 reconcile 为 `completed`，读回的 `.fire`/`.meta` 哈希均与基线一致。

## 结论边界

Creator 2.4.15 下，场景 ToggleContainer 的 `checkEvents` 写入、重开持久化、运行时触发、来源补偿和排他/允许取消行为已通过 CLI 闭环。当前未验证多事件列表、空列表边界以外的清空策略差异、Prefab 内 ToggleContainer 事件、带 Sprite/checkMark 的视觉效果或其他平台运行时。
