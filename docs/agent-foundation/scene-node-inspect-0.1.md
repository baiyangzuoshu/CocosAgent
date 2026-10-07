# 场景节点精确定位 0.1

`scene.node.inspect` 是空节点创建前的只读能力切片。按当前活动场景的完整节点路径查询，例如 2.4 的 `helloworld/Canvas/label` 或 3.8 的 `main/Main Light`。路径区分大小写，以场景名开头；同级重名返回 `ambiguous`，不存在返回 `not-found`。`found` 返回节点 UUID、名称、活动状态、子节点数和最多 32 个组件类名。该命令不修改场景，也不生成操作记录。当前路径语法不支持节点名称本身含 `/` 的情况。

两版分别以官网的[2.4 节点层级](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/node-tree.html)和[3.8 场景编辑](https://docs.cocos.com/creator/3.8/manual/zh/concepts/scene/scene-editing.html)为公开行为基准。具体读取来自各自扩展的 Scene Script；Host 验证项目、版本、活动场景、命令目录与返回结构后，才向 Agent 返回结果。

两版 Creator 实机已分别读到 `cc.Label` 与 `cc.DirectionalLight`，并记录 UUID。3.8 经 JSONL 接口测试不存在路径，返回 `not-found`。目录、调度与本地接口测试通过；源场景未修改。证据见[轨迹](traces/cocos-agent-scene-node-inspect-0.1.jsonl)。

下一写入切片为 `scene.node.create`：需单独定义节点名/父节点身份、写入前冲突检查、持久操作记录、磁盘读回、补偿和重放，不能把 `scene.pngSprite` 的 SpriteFrame 假设套到空节点。
