# 场景节点补丁与 Prefab 操作 0.1（2.4.15）

本切片为 Creator 2.4.15 增加受约束的既有场景节点修改，并为 `scene.node.create` 增加 Prefab 创建、实例化模式。它把每项写入记录为显式预期差异，先检查 before 值，再由编辑器写入并保存，随后读回运行态与磁盘状态；补偿和重放必须引用原操作记录并使用新操作 ID。

## 输入边界

`scene.node.patch` 仅接受唯一、精确的场景节点路径与 Creator 节点 ID，以及 1–16 个不重复的 `{ path, before, after }` 字段差异。当前字段白名单为：

- 节点：`name`、`active`、二维 `position` 与 `scale`。
- 组件：`cc.Sprite.enabled`、`cc.Sprite.spriteFrameUuid`、`cc.Label.enabled`。
- SpriteFrame 引用可显式清空为 `null`；新 UUID 必须由 Creator AssetDB/资源检索得到。

不接受任意组件字段、脚本调用、旋转/三维变换或序列化文本写入。暂不允许 `Label.string`：2.4 在变更文本时会自动调整节点宽度，单独恢复文本不会恢复原宽度，无法保证补偿无残留。

`scene.node.create` 在 Creator 2.4.15 接受两种新增 `prefabMode`：

- `create`：按受限节点合同先创建场景节点，再通过 Creator `scene:create-prefab` IPC 创建 Prefab 资源；等待 `.meta` 与 AssetDB UUID 一致，确认场景实例链接和 `.prefab` 内容哈希后保存场景。
- `instantiate`：只接受 AssetDB 已登记的 Prefab UUID；运行时加载为 `cc.Prefab`，通过 `cc.instantiate` 创建场景实例，并按请求设置名称和有限变换。

Prefab 创建的 expected diff 同时包含场景节点和资源文件；UUID 生成前使用占位值，导入后用实际 UUID 覆盖。补偿先移除由本次操作创建的场景节点，再核对 Prefab URL、UUID、文件哈希和全项目序列化引用后才请求 AssetDB 删除。实例化补偿只移除精确匹配的实例，保留原 Prefab 资源。失败结果不确定时保留 `needs-review`，不自动重试。

## Prefab 资源编辑边界

场景中的 Prefab 实例节点补丁属于场景实例修改，不等于更新原 Prefab。CLI 现在提供独立的 `creator.prefab.source.patch.plan/commit/reconcile` 命令，在 Creator Prefab 编辑模式下对已有源资源执行受限字段修改；该命令不属于本场景节点合同。它通过场景进程探测 `scene://edit-mode` 的 `curMode/save/pop`，只在接口存在时发布能力，并要求保存、退出、重新打开和磁盘读回。内部编辑器接口的完整时序以及修改对场景实例的影响仍需 Creator 2.4.15 实机验收。

官方依据：[2.4 Prefab 手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/prefab.html)、[2.4 FAQ：插件控制 Prefab](https://docs.cocos.com/creator/2.4/manual/zh/getting-started/faq.html)。Prefab 手册说明修改场景实例属性只保存为实例差异，不会更新 Prefab 源资源；源资源需要在 Prefab 编辑模式显式保存。

## 当前状态与验收

- Host、2.4 扩展、JSONL/MCP schema、能力目录和操作记录已加入对应合同实现。
- 自动合同、调度、对账、MCP schema/路由测试已通过；Prefab expected diff 覆盖创建、实例化和补偿 UUID。
- 2026-10-10 已从 Dashboard 打开 2.4 工程并重载扩展。真实 MCP 已验证临时 Sprite 节点创建；节点改名、位置、缩放和红→蓝 SpriteFrame 替换；补丁补偿与新 ID 重放。运行态自动预览核对后置字段，实际本地预览显示蓝色矩形，视觉证据见 `traces/visual/cocos-agent-patch-replay-2.4-web.jpg`。陈旧 before 值及兄弟节点重名均在写入前拒绝。
- Prefab 首次尝试 `e98a93d5-9707-45a6-88f6-50a40a1511f4` 超时并返回 `needs-review`。没有盲目重试：重开场景后活动场景和 `.fire` 均确认节点未保存，Prefab 文件及 `.meta` 也不存在；`operation.reconcile` 记为 `WRITE_RECONCILED_NO_EFFECT`。编辑器日志证明 Creator 2.4.15 将 `scene:create-prefab` 第二参数解释为目标目录并追加 `<node.name>.prefab`，与 FAQ 文件 URL 示例不一致。
- 修正后的接线为：只对本次新建根节点临时改成操作 ID 唯一名称 → IPC 传 `db://assets` 目录 → 以 UUID、生成路径和文件哈希核对资源及实例链接 → 恢复请求节点名称并保存。Host 的磁盘校验按生成 Prefab 文件内的根名称验证，不要求它等于恢复后的场景实例名。
- 真实 MCP 操作 `952f1ec7-668b-4e12-b45c-11090e1c1f67` 完成 Prefab 创建、AssetDB UUID/文件与场景链接读回及预览；`62f4dd95-46db-41ba-ab3a-c58cfe28d42b` 完成实例化和预览。对实例执行补偿、新 ID 重放、再补偿；对 Prefab 创建执行补偿，随后从已补偿记录重放创建、预览并再次补偿。重放的 Prefab 生成新 UUID，实例化时使用当前回执 UUID。首次 Prefab 创建补偿暴露了 AssetDB 删除回调无返回被误报失败的问题；修正为按 UUID 映射、文件和 `.meta` 缺失及序列化引用为零验证后，重放补偿的编辑器与磁盘阶段均通过。Prefab/实例预览画面见 `traces/visual/cocos-agent-prefab-instance-2.4-web.jpg`。
- 测试后所有临时节点和本次 Prefab 资源均已补偿移除。活动场景快照只包含原有内容；`assets/Scene/helloworld.fire` 的 SHA-256 与操作前备份完全一致：`0cdc7dd5424e2c4414f6b58caff1cd74142f77a7caaa075df08df280d7a4df94`。完整调用摘要及最终清理回执见 `traces/cocos-agent-scene-patch-prefab-2.4-web.jsonl`。
- 本切片验证的是场景实例属性修改、创建 Prefab 资源、实例化 Prefab 及其补偿/重放；不包含在 Prefab 编辑模式中修改已有 Prefab 源内容。后者仍需单独验证进入/退出编辑模式、保存后的 UUID 与文件差异、关联场景实例行为及失败恢复。

测试入口：`node tools/cocos-agent-bridge/scene-patch-contract.test.js`、`node tools/cocos-agent-bridge/scene-node-create-contract.test.js`、`node tools/cocos-agent-bridge/agent-dispatch.test.js`、`node tools/cocos-agent-bridge/operation-reconcile.test.js`、`node tools/cocos-agent-bridge/catalog-extension-contract.test.js` 与 `tools/cocos-agent-bridge/mcp/` 下的 `npm test`。
