# Creator 2.4 Prefab 源内容受约束编辑 0.1

## 目标

支持对**已有 Prefab 资源源内容**做连续、可核验的小幅修改。它与 `scene.node.patch` 的活动场景实例编辑分开：此命令进入指定 Prefab 的编辑模式，保存源资源，退出后重新打开，再比较活动对象与磁盘序列化结果。

本能力当前只面向 Creator **2.4.15**。3.8.7 没有新增 Prefab 源编辑命令。

## 命令

- `prefab.source.inspect`：只读解析 `.prefab` 和 `.meta`，以 Prefab UUID 定位唯一资源，返回源 SHA-256、节点路径/UUID、层级、有限组件摘要和受支持字段当前值。
- `prefab.source.patch`：针对一个节点的一组白名单字段执行 `apply`、`compensate` 或 `replay`，并写入持久操作记录。

字段白名单沿用 `scene.node.patch`：节点名称、激活状态、二维位置/缩放、Sprite 或 Label 的启用状态、SpriteFrame UUID。Label 文本暂不开放；节点增删、组件增删、材质及任意序列化字段也不开放。

## 一轮写入的合同

`apply` 必须携带最近一次 `prefab.source.inspect` 返回的 Prefab UUID、目标节点路径和 UUID、当前 `sourceSha256`，以及每个字段明确的 `before` / `after`。执行前 Host 会再次核对唯一 `.meta` UUID、AssetDB URL 映射、源 SHA-256、目标节点身份、完整层级索引和字段前值；扩展进入指定 Prefab 编辑模式后还会再核对一次活动节点状态。

写入只经过 Creator 扩展和 Prefab 编辑模式。保存回调及 `scene:saved` 信号完成后，Host 检查源文件哈希和 UUID；扩展退出并重新进入同一 Prefab，按 UUID 与路径读回活动对象；最后 Host 重新解析磁盘 Prefab，核对字段差异、UUID、子父索引及组件反向关联。只有这些读回全部一致，操作才达到 `disk: passed`。

下一轮必须重新调用 `prefab.source.inspect`，读取新的源哈希和字段值。旧哈希用于新一轮写入会被 `PREFAB_SOURCE_STALE` 拒绝。这样同一 Prefab 的每一轮修改都链接到新状态，不把前一轮的 before 值套用到后续内容。

只读检查反映磁盘上已保存的 Prefab。若 Creator 正在 Prefab 编辑模式且有未保存修改，先保存或退出并检查；写入命令会拒绝从现有 Prefab 子模式开始，避免把未保存状态当作磁盘基线。

`compensate` 通过已完成操作的 `sourceOperationId` 派生逆向差异；执行前要求当前 Prefab 哈希等于源操作的 after 哈希，且活动与磁盘字段仍匹配。完成补偿后，`replay` 必须基于该已完成的补偿操作和新的 operation ID。禁止直接重发旧 apply 或用旧哈希覆盖更新后的 Prefab。

## 编辑器 API 边界

2.4 官方[Prefab 手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/prefab.html)描述了进入 Prefab 编辑模式、保存和关闭编辑模式的工作流。官方 [FAQ](https://docs.cocos.com/creator/2.4/manual/zh/getting-started/faq.html)列出通过 `Editor.Ipc.sendToAll('scene:enter-prefab-edit-mode', assetUuid)` 进入模式的扩展用法。

扩展 0.3.14 把 `scene://edit-mode` 的加载、`curMode` 查询、`save` 和 `pop` 调用移到 `scene.js`。主进程通过 `Editor.Scene.callSceneScript` 调度，按官方[场景脚本机制](https://docs.cocos.com/creator/2.4/manual/zh/extension/scene-script.html)跨进程收取结果，避免主进程未注册 `scene://` 协议的错误。安装包中可确认模块位于 `editor/page/scene-utils/edit-mode/`；本轮没有读取加密 `.ccc` 模块的方法实现，不据此推断完整运行时行为。

能力目录采用场景端的实际探测结果：必须处于非主进程，且 `curMode`、`save`、`pop` 都存在、当前模式可读。进入仍用官方 IPC；保存必须收到场景端保存回调与 `scene:saved`，退出必须收到场景端回执与 `scene:ready`，并读回原场景 UUID。保存、退出、预检、修改和重开读回均重验 Prefab 模式及 UUID；资源加载后写入前再次核对节点身份、路径、字段前值和同名冲突。场景脚本调用有 20 秒超时且只完成一次回调；修改后超时或读回不一致按可能有副作用上报，继续走现有操作账本恢复。

`save/pop` 是内部接口，并非手册或 FAQ 承诺的公开 API。存在性探测不能证明完整时序正确；真实 2.4.15 编辑器验收必须覆盖进入、保存、退出、重新打开和磁盘读回。若任一步不匹配，操作必须失败或停在 `needs-review`，不能标记成功。

## 当前验证状态

- 完成扩展消息、Host 持久操作记录、JSON Schema、MCP 命令目录、只读源检查和序列化层级校验。
- 2026-10-13：0.3.14 场景进程桥接已实现，移除主进程固定返回 `null` 的入口；本轮构建与语法检查结果另行记录，未运行新的自动测试或真实 Prefab 写入。
- 通过 Prefab 合同、差异逆转、目标节点路径/UUID、序列化父子关系与只读资源检查测试。Host 模拟扩展通道完成同一 Prefab 两轮修改、陈旧哈希拒绝、第二轮补偿/重放及首轮补偿，并逐轮检查哈希和父子、组件、SpriteFrame 引用关系；模拟通道只验证 Host 编排和持久记录，不验证 Creator 内部编辑模式时序。仓库内 Host 回归、双版本目录、多实例 Catalog Host 和 MCP schema/routing 测试均通过。
- **真实 Creator 2.4.15 Prefab 多轮修改、保存/重开、SpriteFrame 引用改换、补偿与重放尚未验收。** 实机验收需在 Creator 窗口可交互时运行；内部 `scene://edit-mode.save/pop` 时序是主要待证据项。
- 在实机验收完成前，不把此命令描述成已验证能力，也不在 `AGENTS.md` 中登记为完成项。

## 入口

工作流见 [cocos2-prefab-source-edit skill](skills/cocos2-prefab-source-edit/SKILL.md)。
