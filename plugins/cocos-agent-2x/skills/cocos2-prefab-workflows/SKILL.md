---
name: cocos2-prefab-workflows
description: Route Cocos Creator 2.4.15 Prefab requests to supported create, instantiate, scene-instance, inspect, or source-edit workflows.
---

# Cocos Creator 2.4.15 Prefab 工作流

处理 Prefab 请求前，先读取本 skill，再按用户想改的对象选择工作流。Prefab 资源源内容、场景里的 Prefab 实例，以及新建/实例化 Prefab 是不同目标，不得互相替代。

1. 调用 `cocos_2x_instances_list` 并选定唯一 `ready` 的 Creator 2.4.15 工程；再调用 `cocos_2x_capabilities_list`，核对本任务需要的精确命令当前为 `available`。
2. **新建 Prefab 或实例化已有 Prefab：** 读取 `cocos2-scene-node-operations`，用 `scene.node.create` 的 `prefabMode:"create"` 或 `prefabMode:"instantiate"`，按该 skill 验证实例 UUID、资源链接、磁盘读回及预览。
3. **修改场景里的一个 Prefab 实例：** 读取 `cocos2-scene-node-operations`，先用实时节点检查取得唯一节点路径、UUID 和字段当前值，再用 `scene.node.patch` 的显式 `before`/`after`。这只修改该场景实例，不等于更新 Prefab 源资源。
4. **修改已有 Prefab 源资源：** 读取 `cocos2-prefab-source-edit` 和其合同引用。必须同时确认 `prefab.source.inspect`、`prefab.source.patch` 为 `available`；以 UUID、节点路径/UUID、最新源哈希和逐字段前值为基线，按该 skill 检查保存、重开、读回与操作账本。
5. 若所需命令不可用，说明命令 ID 和实时目录返回的原因，停止该工作流；不得把 skill 的存在当作能力证明，不得直接编辑 `.prefab` JSON、调用任意脚本，或擅自把“更新 Prefab 源”改成“只改场景实例”。只有用户接受替代目标时，才切换到另一个工作流。

Creator 官方 [Prefab 手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/prefab.html)和 [扩展 FAQ](https://docs.cocos.com/creator/2.4/manual/zh/getting-started/faq.html)用于理解编辑器工作流，不替代 CocosAgent 命令合同、实时能力目录或操作回执。此 skill 只覆盖 Creator 2.4.15。
