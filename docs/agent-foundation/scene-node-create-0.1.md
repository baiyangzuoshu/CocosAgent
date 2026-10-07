# `scene.node.create` 0.1：双版本空节点写入

此切片在 Creator 2.4.15 与 3.8.7 中创建**空节点**。它服务于后续场景组合命令，不写组件、资源引用或节点属性。两版入口分别位于 `2.4.15NewProject/packages/cocos-agent-bridge/` 和 `3.8,7NewProject/extensions/cocos-agent-bridge/dist/`；共用命令入口为 `tools/cocos-agent-bridge/agent-dispatch.js`，持久记录合同为 `node-create-operation.schema.json`。公开场景/层级操作仍以 [2.4 手册](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/node-tree.html)与[3.8 手册](https://docs.cocos.com/creator/3.8/manual/zh/concepts/scene/scene-editing.html)为基准。

## 输入与执行边界

```json
{"parentPath":"helloworld/Canvas","parentUuid":"a286bbGknJLZpRpxROV6M94","nodeName":"Example","action":"apply"}
```

先调用 `scene.node.inspect` 取得当前父节点路径和 UUID，再调用 `scene.node.create`。`parentPath` 从当前场景名开始；路径与 UUID 必须同时定位到唯一节点。节点名目前只接受 1–64 个英文、数字、空格、下划线或连字符，不支持含 `/` 的名称。已有同名直接子节点时拒绝创建，返回 `SCENE_NODE_CONFLICT`，不会认领用户节点。

`apply` 不需要来源。`compensate` 必须提供此前通过磁盘校验的 `apply` 或 `replay` 的 `sourceOperationId`，并要求被删除节点 UUID 与来源记录一致。`replay` 必须引用已通过磁盘校验的 `compensate` 操作；重放会新建节点和新 UUID。三种动作都生成独立 `operationId`；同一 ID 再次执行由持久记录拒绝。Host 在编辑器脚本执行前记录写入意图，保存后比对场景文件中的节点 UUID、父节点 UUID 和空组件表，并用编辑器内存快照交叉检查。空节点没有可见画面，因此预览阶段标为 `skipped`，成功结果为 `completed`。

`operation.get` 可在新进程中读取记录；若 Host 在编辑器成功回执之后、磁盘读回之前中断，只在磁盘确实满足记录中的节点身份时补记 `disk=passed`。读回不自动重放写入。编辑器已写入但回执丢失且无法确定 UUID 时，结果保持 `needs-review`，应先检查现场。

## 本轮实测

2026-10-07，两版真实编辑器均完成：目录可用性查询、父节点精确定位、创建并保存、磁盘 UUID 读回、重复名拒绝、按来源 UUID 补偿、引用补偿记录重放（产生新 UUID）、再次补偿，以及保存回执后主动中断 Host、新进程 `operation.get` 从磁盘恢复、再按恢复记录补偿。另一次创建后完整重开两版编辑器，层级树与 `scene.node.inspect` 都读到原 UUID、空组件表，随后按来源记录补偿。2.4 父节点是 `helloworld/Canvas`；3.8 父节点是 `main` 场景根节点。两版补偿后场景中均无测试节点，示例场景文件已恢复到测试前的 Git 内容。Creator 保存会重写大量无关序列化字段，不能仅靠文本差异判断节点操作的实际效果。

已验证范围为上述两套示例中的当前活动场景。含 `/` 的节点名、Prefab 内部节点、锁定节点、并发人工编辑、原生发布包、断电写入均未纳入此切片。3.8 场景脚本经编辑器消息转发的错误曾变成数值 `-1`；扩展按自身已知错误文案映射后，经重载并以已有 `Main Light` 为目标复测，回执为 `SCENE_NODE_CONFLICT`、`preflight=failed`、`sideEffect=none`。
