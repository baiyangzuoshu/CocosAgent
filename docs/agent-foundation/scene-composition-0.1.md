# 场景节点组合 0.1

计划输入结构见 `tools/cocos-agent-bridge/scene-composition.schema.json`。

本切片将多个 `scene.node.create` 写入组合为一份持久计划。只支持 2–8 个空节点步骤；后续步骤可用 `{ "ref": "先前步骤 id" }` 指向新建父节点。2.4 与 3.8 的节点编辑仍分别由各自扩展执行，组合器只负责排序、记录、执行与逆序补偿。公开节点层级行为以 [2.4 节点层级手册](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/node-tree.html)及 [3.8 场景编辑手册](https://docs.cocos.com/creator/3.8/manual/zh/concepts/scene/scene-editing.html)为准。

入口为 `tools/cocos-agent-bridge/agent-jsonl.js` 的 `workflow.plan`、`workflow.execute`、`workflow.get`、`workflow.compensate`、`workflow.replay`。`workflow.plan` 只读检查外部父节点路径和 UUID、目标名称、活动场景与实例。`workflow.execute` 为每一步持久保存独立的操作 ID，并在写入前再次检查父节点身份和当前编辑器实例。写入完成以单步操作记录 `phases.disk=passed` 为准；任一步明确返回 `sideEffect=none` 时，已创建节点逆序补偿；写入结果或补偿结果不明时返回 `needs-review`，停止后续写入。操作记录位于项目 `.cocos-agent/compositions/<workflowId>.json`。

输入示例：

```json
{
  "targets": [{"creatorVersion":"2.4.15","projectRoot":"/absolute/project"}],
  "projectRoot":"/absolute/project",
  "creatorVersion":"2.4.15",
  "steps":[
    {"id":"root","name":"AgentRoot","parent":{"path":"helloworld/Canvas","uuid":"从 scene.node.inspect 取得"}},
    {"id":"child","name":"AgentChild","parent":{"ref":"root"}}
  ]
}
```

重复的 `workflowId` 只读取或继续原记录，不生成另一组节点。`workflow.compensate` 对已完成计划逆序移除其创建的节点；`workflow.replay` 仅接受完整补偿后的源计划，并生成新计划与操作 ID。编辑器重启导致实例 ID 变化时，未完成计划停止在 `needs-review`；此版本没有自动跨实例续写。它也不处理组件、属性、资源引用或可视预览。

2026-10-07 在两版 Creator 示例中分别创建 `CocosAgentFlowRoot/CocosAgentFlowChild`，确认两个操作的磁盘读回 `passed`，再逆序补偿成功；随后按 Git HEAD 恢复示例场景序列化文件。模拟测试覆盖成功、明确失败回滚、重放和路径长度。实机未模拟进程中断后的人工核查，也未验证批量资源或动态热更。

实机操作 ID 与节点身份见[结构化记录](traces/cocos-agent-scene-composition-live-0.1.jsonl)。
