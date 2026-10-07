---
name: cocos3-scene-node-create
description: 在 Cocos Creator 3.8.7 活动场景中，通过 CocosAgent 安全创建、补偿或重放空节点；适用于已连接的 3.x 示例或同版工程。
---

# Creator 3.8 空节点写入

使用 `scene.node.inspect` 读取目标父节点的完整路径和 UUID，再向 `scene.node.create` 提交两者、节点名与 `action=apply`。3.8 的场景文件是 `.scene`；场景根节点本身也可作父节点。先核对当前活动场景，不能用 2.4 的 `.fire` 结构或 `cc.Class` 规则解释结果。

重名直接子节点是冲突，不能当作幂等成功。补偿时使用已通过 `disk=passed` 的创建/重放操作 ID 作为 `sourceOperationId`；扩展只删除 UUID 与来源记录相同的节点。重放引用已通过磁盘校验的补偿操作 ID，并接受新 UUID。结果不确定时先调用 `operation.get`，不要换新操作 ID 盲目重做。

空节点没有可见画面；验收看编辑器层级快照与 `.scene` 的父子 UUID 读回。Creator 保存会重写无关序列化字段，临时探针完成后核对并恢复示例场景文件。输入、回执与已验范围见 `docs/agent-foundation/scene-node-create-0.1.md`。
