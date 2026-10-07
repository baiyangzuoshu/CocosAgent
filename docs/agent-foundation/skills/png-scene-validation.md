# PNG 入场景 skill 验收

两份版本专属 skill 为 [`cocos2-png-to-scene`](cocos2-png-to-scene/SKILL.md) 和 [`cocos3-png-to-scene`](cocos3-png-to-scene/SKILL.md)。它们只描述各自版本的场景前置条件和 UI 结构，统一通过 `agent-dispatch.js` 查询实例、能力、执行命令、读取操作状态，并在实际看过本次 Web 预览后录入证据。skill 不直接向 Creator 发送内部消息。

| 验收点 | 2.4.15 | 3.8.7 |
| --- | --- | --- |
| `quick_validate.py` 结构校验 | 通过 | 通过 |
| 精确实例与命令目录 | 真实编辑器通过 | 真实编辑器通过 |
| 调度入口放置、磁盘读回、补偿 | `helloworld.fire` 通过 | `main.scene` 通过 |
| 本次 Web 预览与持久 `visual-preview` 回执 | `needs-preview → completed`，一条回执 | `needs-preview → completed`，一条回执 |
| Host 中断后新进程恢复磁盘读回 | 真实编辑器通过 | 真实编辑器通过 |

两版已导入的 `cocos-agent-smoke.png` 可用于复跑。3.8 可以创建 `CocosAgentCanvas`，2.4 要求原场景已有 Canvas。放置和补偿后均应检查各自操作 ID 的回执；预览结论只能来自当次可见画面。实验后两份示例场景已恢复至原 SHA-256。证据见[目录验收](../catalog-readonly-acceptance.md)、[操作持久轨迹](../traces/cocos-agent-operation-persistence-0.1.jsonl)、[调度画面轨迹](../traces/cocos-agent-dispatch-0.1.jsonl)与[预览回执轨迹](../traces/cocos-agent-preview-receipt-0.1.jsonl)。

目前 skill 只覆盖单张 PNG 到 Sprite 节点；批量资源、预制体和其他组件需要新的版本专属命令及实机验收。`preview=passed` 是带来源的人工视觉观察，不是 Host 自动识图。
