---
name: cocos2-scene-node-create
description: 在 Cocos Creator 2.4.15 中用 CocosAgent 创建、检查、补偿或重放场景节点；Sprite、Label、SpriteFrame 引用和 2D 变换仅限此版本已验证的输入。
---

# Creator 2.4 场景节点与组件操作

先用 `scene.node.inspect` 确认活动场景、父节点完整路径与 UUID，再用 `scene.node.create` 写入。2.4 场景是 `.fire` 文件，不能把 3.8 的 `.scene` 序列化或组件 API 套进来。

当前白名单是空组件节点、一个 `cc.Sprite`（已导入 SpriteFrame UUID）或一个 `cc.Label`（文本），以及 2D position/scale。Sprite 与 Label 同属 `RenderComponent`，不能挂在同一个节点；Host 会在选择编辑器前拒绝该组合。不要动态调用用户给出的组件类名，不要把资源文件路径伪装成 UUID。

成功写入后检查 `capability`、`preflight`、`editor` 与 `.fire` 磁盘读回；含组件操作还会自动启动本地 Web 预览，并读回运行时场景节点、组件值、资源 UUID 和变换。若结果为 `needs-review`，先用原 `operationId` 调 `operation.get`。只有当记录属于 `scene.node.create`、编辑器阶段明确失败且 `sideEffect=possible`、没有创建 UUID，并且记录场景仍是当前场景时，才调用 `operation.reconcile`。对账要求活动场景中父路径与 UUID 匹配、目标路径不存在，且 `.fire` 中同一父节点下也没有目标子节点；成功后原操作仍是 `failed`，恢复阶段记录 `no-effect`，不得把它报告成成功。条件不满足就保留 `needs-review` 并停止，绝不换新 ID 重发。

需要验证编辑器场景重开时，在 Creator UI 中切到另一个已保存场景，再重新打开目标 `.fire`，然后执行只读 `scene.node.inspect`。`operation.get` 只做磁盘恢复，不能代替 UI 重开。完成测试后按来源操作 ID 补偿，并检查示例场景没有残留探针；Creator 保存可能重写无关序列化字段，核对并恢复已确认干净的样例文件。

命令合同、自动预览证据、实测范围与局限见 [`scene.node.create 0.1`](../../scene-node-create-0.1.md)。源码研究要结合 [Creator 2.4 节点树手册](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/node-tree.html)、`engine/2.4.15engine/cocos2d/core/components/CCRenderComponent.js` 与 `core/utils/base-node.js`；版本边界和运行证据见 [P1 轨迹](../../traces/scene-node-component-p1-2.4.jsonl)。
