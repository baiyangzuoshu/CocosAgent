---
name: cocos2-prefab-source-edit
description: Inspect and make constrained, recoverable edits to existing Cocos Creator 2.4.15 Prefab source assets through CocosAgent.
---

# Creator 2.4 Prefab 源内容编辑

仅用于 Creator 2.4.15 已注册项目的**已有 Prefab 源内容**。先查 [合同和验证状态](../../references/agent-foundation/prefab-source-edit-0.1.md)。不要把它用于 3.8、场景实例编辑、Prefab 创建或不在白名单内的序列化改动。

1. 调用 `cocos_2x_instances_list`，按用户目标选择唯一 `ready` 项目，再读 `cocos_2x_capabilities_list`。只有 `prefab.source.inspect` 和 `prefab.source.patch` 当前可用时继续。
2. 用 `prefab.source.inspect` 读取目标 Prefab 的 UUID、源哈希、节点路径/UUID 和字段当前值。路径和 UUID 必须同时唯一匹配；不得凭名字猜节点。
3. 每轮只提交用户要求的白名单字段，并为每个字段提供明确的 `before` 和 `after`。`apply` 必须传刚读到的 `expectedPrefabSha256`。Label 文本、节点/组件增删及任意 JSON 编辑不受支持。
4. 检查回执要求保存、退出/重开、活动对象读回和磁盘序列化读回全部通过。改名时输入路径的末段必须等于 `node.name.before`；写后路径仅将末段替换为 `after`，UUID 与父级保持一致。成功后再次调用 `prefab.source.inspect`，把新路径、哈希和字段值作为下一轮基线；补偿/重放也使用当前路径和对应逆向差异。
5. 如需撤销，只用已完成操作的 `sourceOperationId` 调用 `compensate`，并提供合同要求的逆向差异。补偿完成后如需重放，基于补偿记录和新的 operation ID 调用 `replay`。每轮都必须检查回执。
6. 出现 `needs-review`、编辑器模式不匹配、保存超时、哈希变化或读回不一致时，停止后续写入。先读 `cocos_2x_operation_get` 和 `prefab.source.inspect`；不要盲目重试、直接改 `.prefab` 文件或推断写入没有发生。

扩展 0.3.14 在场景进程加载 `scene://edit-mode`，通过场景脚本桥接保存和退出。内部 `save/pop` 尚未经过真实 2.4.15 Prefab 多轮验收；目录可用状态仅代表场景端探测通过，不代表该时序已经证明稳定。核验能力和限制时以合同文档的状态为准。

扩展 0.3.16 修正改名后的重开和磁盘读回路径，并校验输入路径与改名前值一致。该修复仍待原生面板实机验收，不代表已验证连续改名或补偿。
