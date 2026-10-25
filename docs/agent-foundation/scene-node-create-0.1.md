# `scene.node.create` 0.1：2.4 节点、组件与资源引用

此切片把通用节点操作从空节点扩展到 **Cocos Creator 2.4.15** 的 Sprite、Label 与 2D 变换。3.8.7 暂时保留原有空节点合同；组件与资源输入只向 2.4.15 声明，Host 会在执行前拒绝将其发给 3.8。入口是 `2.4.15NewProject/packages/cocos-agent-bridge/` 和 `tools/cocos-agent-bridge/`；场景公开操作以 [2.4 节点树手册](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/node-tree.html)为基准。

## 2.4 输入范围

先通过 `scene.node.inspect` 取得父节点路径和 UUID，再调用 `scene.node.create`。父节点路径从活动场景名开始，路径与 UUID 必须共同命中唯一节点。

```json
{
  "parentPath": "helloworld/Canvas",
  "parentUuid": "<已读回的父节点 UUID>",
  "nodeName": "Example",
  "action": "apply",
  "components": [{ "classId": "cc.Sprite", "spriteFrameUuid": "<已导入 SpriteFrame UUID>" }],
  "transform": { "position": { "x": -180, "y": 120 }, "scale": { "x": 40, "y": 40 } }
}
```

- `components` 可省略或包含一个已验证类型：`cc.Sprite` 加已导入的 SpriteFrame UUID，或 `cc.Label` 加最多 256 字符的文本。资源只接受 UUID，不接受任意磁盘路径。
- `transform` 当前只接收 2D `position` 与 `scale`，坐标分量范围为 ±4096；省略字段沿用 Creator 默认值。
- Creator 2.4.15 的 `cc.Sprite` 与 `cc.Label` 都继承 `RenderComponent`，该基类禁止同一节点挂载多个渲染组件。Host 和扩展在写入前拒绝 Sprite+Label 组合；需要两者时，用父子节点分别挂载。源码证据为 `engine/2.4.15engine/cocos2d/core/components/CCRenderComponent.js` 的 `disallowMultiple` 与 `core/utils/base-node.js::addComponent`。
- 任意组件类、脚本组件、Prefab 内部节点、材质属性、旋转、锚点和 3D 变换尚未开放。未知类型不会被动态解析执行。

`apply` 创建并保存；`compensate` 仅依据已通过磁盘校验的来源记录和目标 UUID 删除；`replay` 引用补偿记录重新创建并接受新 UUID。每次动作使用独立 `operationId`。Host 保存意图后核对 Creator 回执、`.fire` 序列化对象、组件数据、资源 UUID 和变换，再用活动场景快照交叉检查。

## 场景重开与自动预览

对含组件的 2.4 写入，Host 自动请求 Creator `scene:play-on-device`，再启动隔离的无头 Chrome 检查本地 Web 预览。预览读回活动场景、节点路径与 UUID、白名单组件数据、SpriteFrame UUID、位置和缩放；只有全量匹配才将 `preview=passed` 写入操作记录。此项是运行时结构验收，**不代表像素级截图比对或游戏画面审美检查**。空节点和补偿操作的预览为 `skipped`。

编辑器场景重开是另一个验收动作：真实 2.4 编辑器中切到 `stage4-empty.fire`，再双击 `helloworld.fire` 重新打开；之后调用 `scene.node.inspect`，从重新加载的编辑器场景读回 UUID、组件、资源引用和变换。这个 UI 重开目前由测试流程执行，不由 Host 自动关场景或调用未公开的编辑器内部 API。`operation.get` 仍只从磁盘恢复未完成记录，不会代替场景重开。

## 本轮验收

2026-10-08，在示例 `helloworld.fire` 中分别完成 Sprite 与 Label 单组件写入：Host 的 `capability → preflight → editor → disk → preview` 均通过。Sprite 测试读回 SpriteFrame UUID `4c38c7d8-6a02-48cc-885a-c42bf6136365`、位置 `(-180, 120)`、缩放 `(40, 40)`；Label 测试读回文本 `CocosAgent P1`、位置 `(-180, 120)`、缩放 `(2, 3)`。两项都切到空场景后重新打开 `helloworld.fire`，`scene.node.inspect` 仍读到原节点 UUID、组件/资源和变换。

一次 Sprite+Label 组合尝试在编辑器报告 `RenderComponent` 冲突，现场确认没有节点进入活动场景或磁盘。随后把集合大小限制为每个节点最多一个白名单渲染组件，并实测调度入口在目标选择前返回 `INVALID_ARGUMENT`、无操作 ID、`sideEffect=none`。该负测促成了执行前限制，不能把它写成正常写入失败。

该负测的历史操作 `e13826fa-5d36-4104-9d9b-dfbd79e53d01` 最初因编辑器回执带 `sideEffect=possible` 而进入 `needs-review`。之后新增 `operation.reconcile`：它在一个 2.4 Creator 会话内确认 `helloworld/Canvas` 的 UUID、精确目标路径缺席，再核对 `helloworld.fire` 中该父节点没有同名子节点。两处均缺席后记录磁盘 SHA-256，恢复阶段通过；原编辑器失败和磁盘 pending 回执仍保留，最终状态明确为 `failed` 且 `sideEffect=none`，没有重试或写入场景。协议示例：

```json
{"id":1,"method":"operation.reconcile","params":{"targets":[{"projectRoot":"<2.4 项目绝对路径>","creatorVersion":"2.4.15"}],"projectRoot":"<2.4 项目绝对路径>","creatorVersion":"2.4.15","operationId":"e13826fa-5d36-4104-9d9b-dfbd79e53d01"}}
```

实际轨迹与磁盘哈希见 [`scene-node-component-p1-2.4.jsonl`](traces/scene-node-component-p1-2.4.jsonl)。

两项测试随后均按操作 UUID 补偿，并把示例场景文件恢复到测试前提交内容；再次重开后探针节点为 `not-found`。完整操作与重开读回轨迹见 [`scene-node-component-p1-2.4.jsonl`](traces/scene-node-component-p1-2.4.jsonl)。这一验收只覆盖 2.4.15 Web 预览和示例项目；3.8 组件合同、原生预览、多组件相容矩阵与视觉截图验收留待后续。
