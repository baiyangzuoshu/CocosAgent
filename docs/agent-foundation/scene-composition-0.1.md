# 场景节点组合 0.1

计划输入结构见 `tools/cocos-agent-bridge/scene-composition.schema.json`。

本切片将多个 `scene.node.create` 写入组合为一份持久计划。支持 2–8 个有序节点步骤；后续步骤可用 `{ "ref": "先前步骤 id" }` 指向新建父节点。Creator 2.4.15 的每一步可选包含一个 `cc.Sprite`（已导入 SpriteFrame UUID）或一个 `cc.Label`（最多 256 字文本），并可设置 2D `position`/`scale`；每个节点仍限一个白名单组件，Sprite 与 Label 应作为不同子节点。3.8.7 仍只接受空节点步骤，Host 会拒绝组件或变换输入。2.4 与 3.8 的节点编辑由各自扩展执行，组合器只负责排序、记录、执行与逆序补偿。公开节点层级行为以 [2.4 节点层级手册](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/node-tree.html)及 [3.8 场景编辑手册](https://docs.cocos.com/creator/3.8/manual/zh/concepts/scene/scene-editing.html)为准。

入口为 `tools/cocos-agent-bridge/agent-jsonl.js` 的 `workflow.plan`、`workflow.execute`、`workflow.get`、`workflow.compensate`、`workflow.replay`。`workflow.plan` 只读检查外部父节点路径和 UUID、目标名称、活动场景与实例。`workflow.execute` 为每一步持久保存独立的操作 ID，并在写入前再次检查父节点身份和当前编辑器实例。写入完成要求单步操作记录 `phases.disk=passed`；有组件的 2.4 步骤还要求自动运行时预览 `phases.preview=passed`。任一步明确返回 `sideEffect=none` 时，已创建节点逆序补偿；写入结果、组件预览或补偿结果不明时返回 `needs-review`，停止后续写入。若某步通过 `operation.reconcile` 明确确认为无副作用，恢复后续执行会把该步标记为拒绝并逆序补偿此前成功步骤。操作记录位于项目 `.cocos-agent/compositions/<workflowId>.json`。

输入示例：

```json
{
  "targets": [{"creatorVersion":"2.4.15","projectRoot":"/absolute/project"}],
  "projectRoot":"/absolute/project",
  "creatorVersion":"2.4.15",
  "steps":[
    {"id":"root","name":"AgentRoot","parent":{"path":"helloworld/Canvas","uuid":"从 scene.node.inspect 取得"}},
    {"id":"sprite","name":"Sprite","parent":{"ref":"root"},"components":[{"classId":"cc.Sprite","spriteFrameUuid":"<已导入 SpriteFrame UUID>"}],"transform":{"position":{"x":0,"y":0},"scale":{"x":2,"y":2}}},
    {"id":"label","name":"Label","parent":{"ref":"root"},"components":[{"classId":"cc.Label","text":"Hero"}],"transform":{"position":{"x":0,"y":-40}}}
  ]
}
```

重复的 `workflowId` 只读取或继续原记录，不生成另一组节点。`workflow.compensate` 对已完成计划逆序移除其创建的节点；`workflow.replay` 仅接受完整补偿后的源计划，并保留组件与变换规格，生成新计划与操作 ID。编辑器重启导致实例 ID 变化时，未完成计划停止在 `needs-review`；此版本没有自动跨实例续写。组件步骤的运行时预览是结构读回，不是像素级视觉验收。

2026-10-07 在两版 Creator 示例中分别创建 `CocosAgentFlowRoot/CocosAgentFlowChild`，确认两个操作的磁盘读回 `passed`，再逆序补偿成功；随后按 Git HEAD 恢复示例场景序列化文件。模拟测试覆盖成功、明确失败回滚、重放和路径长度。实机未模拟进程中断后的人工核查，也未验证批量资源或动态热更。

2026-10-08 在 2.4 `helloworld` 中实测 `AgentCharacterP2` 根节点及 Sprite、Label 两个子节点。应用和重放中的每个步骤均有磁盘回执；Sprite 与 Label 各自的自动 Web 运行时结构预览通过，读回组件/资源 UUID 和二维变换。两轮均逆序补偿；最终活动场景三条目标路径均为 `not-found`，磁盘无残留，并把 `.fire` 按字节恢复到提交版本。第一轮曾在 Host 本地预检遇到已修复的 `manifest is not defined`，Creator 未收到写入请求，记录为 `sideEffect=none`，随后用新 workflow ID 完成。

随后用新的临时 workflow `d9c55b30-0c51-4a0c-9d52-cdc5789e0ca1` 完成组合重开验收：Creator UI 从 `helloworld` 切到 `stage4-empty`，再重新打开 `helloworld`；层级面板重新读到根节点与 Sprite、Label 子节点。属性面板读回 Sprite 的 SpriteFrame 与位置/缩放 `(-180,0)/(50,50)`，以及 Label 文本 `CocosAgent UI Reopen` 与位置/缩放 `(0,-100)/(2,2)`；同一编辑器实例的 `scene.node.inspect` 读回精确 UUID、组件和变换。工作流逆序补偿后，层级面板与 Host 均确认目标节点消失。Creator 重开时重写了 `.fire` 序列化格式；测试结束后将原先干净的场景文件按 Git HEAD 字节恢复，SHA-256 为 `0963cd0a52e25cdfa3edda47a6e998053885d2b93753da7a5c0da2562728d1a8`。实机轨迹见[组合验收记录](traces/cocos-agent-scene-composition-live-0.1.jsonl)。

实机操作 ID 与节点身份见[结构化记录](traces/cocos-agent-scene-composition-live-0.1.jsonl)。

2026-10-09 增加 Creator 2.4.15 专属 MCP 入口：`cocos_2x_workflow_plan/execute/get/compensate/replay` 与 Resource `cocos://2x/skills/scene-composition`。任务 skill 要求查询实例、能力和场景身份，按顺序创建父节点及多个 Sprite/Label 子节点，核对磁盘与运行态读回，再检查实际 Web 预览；发现裁切时先补偿，不接受截图。

同日由本地 CocosAgent 经 MCP 发起四步组合：`AgentCompositionOct09` 父节点、红蓝 `cc.Sprite` 子节点和 `cc.Label`。Agent 的首轮布局实际截图显示两张 Sprite 被左右边缘裁切；未记录视觉接受，随后逆序补偿，所有目标路径读为 `not-found`。随后 MCP stdio 验收客户端把 Sprite 子节点位置调整为 ±210、缩放 0.6，标题放在父节点上方；四步 Host/磁盘读回通过，红蓝图与标题在 `http://127.0.0.1:7456/` 的实际预览中均完整可见，未被现有样本或 Cocos logo 遮挡。三个带组件操作分别登记了视觉验收。再补偿源 workflow 并逐路径确认缺席，以全新 workflow 与操作 ID 重放、再次检查画面并登记视觉验收；最终补偿重放，四个节点均缺席且 `.fire` 文件字节恢复为原 SHA-256 `0cdc7dd5424e2c4414f6b58caff1cd74142f77a7caaa075df08df280d7a4df94`。操作 ID、UUID、截图结论和时间见[结构化轨迹](traces/cocos-agent-scene-composition-live-0.1.jsonl)。

此验收覆盖 Creator 2.4.15 Web 预览、既有 `assets/resources/` 红蓝 PNG、父子节点组合、磁盘读回、像素可见性、逆序补偿与新 ID 重放；不代表 Creator 3.8、构建包或原生运行时能力。工作流返回的组件 `phases.preview=passed` 仍是结构性运行时读回；像素级结论以单独打开的预览截图和 `preview.accept` 回执为准。
