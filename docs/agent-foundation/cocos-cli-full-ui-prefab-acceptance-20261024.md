# Cocos CLI 代表性 UI Prefab 闭环验收（Creator 2.4.15）

本记录验证一份包含 Button、Label、Widget 与事件的 Prefab 可由 Cocos CLI 创建和编辑，再实例化到场景、关闭并重开工程、预览交互，最后清除临时场景实例。所有 Creator 操作均通过 `tools/cocos-creator-agent-cli/cli.mjs` 完成；未使用桌面 UI 自动化。

## 环境与最终读回

- Creator：2.4.15；扩展：0.8.74；工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`。
- 验收场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。
- Prefab：`assets/Button.prefab`，AssetDB UUID `b657e4bb-78f2-4ba4-b066-600ffb10e4f2`。
- 最终 Prefab SHA-256：`145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd`；`.meta` SHA-256：`c926c945705ee5f8ef09f855d8b451392d8744cdb1238a3f8783f7098990a29a`。
- 最终验收结束后，场景 `.fire` SHA-256 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`，与验收前基线相同。
- CLI 关闭并重开工程后，实例 `03f97dde-9391-4d10-9dd5-83034bc287d8` 的 `creator.project.info` 返回上述绝对路径、Creator 版本和活动场景。随后 `creator.prefab.source.inspect` 返回 `available: true`、相同 Prefab UUID、3 个节点、上述源文件哈希和 `.meta` 哈希。

## CLI 编辑轨迹

1. `creator.prefab.create.plan/commit` 从场景 Button 创建 `assets/Button.prefab`：operation `cbd617e0-9d00-4099-bf32-6aff86c5c17d`，Prefab UUID 为 `b657e4bb-78f2-4ba4-b066-600ffb10e4f2`。首次 CLI 关闭/重开后，CLI 源检查读回 2 个节点、Sprite、Button、自定义状态脚本、Label 和 `clickEvents`。
2. `creator.prefab.source.patch` 为根节点添加 `cc.Widget`：operation `6e867415-524a-4b40-9ec1-8e25a066f63f`。一次包含四个 Widget 字段的组合写入被 Creator 拒绝（`SCENE_COMPONENT_PROPERTY_PRECONDITION_FAILED`）；未把失败写入计为成功。之后单字段计划分别设置左右对齐标志和边距，均逐次关闭/重开并读回。最终 `_alignFlags=40`、`_left=40`、`_right=40`。
3. `creator.prefab.source.patch` 追加 `Status` 子节点：operation `27c665d7-a1a0-4d83-b69f-34de5c3433a2`，节点 UUID `43EYbdw+NJmpYS0BQtf9kb`；追加 `cc.Label`：operation `9dc4b394-7f34-41ea-b968-afe9074097f9`；设置 `Label.string="Ready"`：operation `8b8e4274-0480-47e4-8418-08340072272a`；设置节点 y 为 -70：operation `0e8eadd0-5974-4767-895a-45b5a07c719b`。每项提交后均 CLI 关闭/重开并读回。
4. `creator.scene.compose.plan/commit` 将该 Prefab 实例化到 `Canvas`：operation `892d2147-d4c7-4459-8479-b01a22654c9d`，场景临时根节点 UUID `c3bc4911-521b-4575-ba55-2bcdbe1a9feb`。计划使用完整根 Transform；提交后 CLI 检查确认实例仍链接到 Prefab UUID `b657e4bb-78f2-4ba4-b066-600ffb10e4f2`，子树包含原 Label 和 Status。
5. 关闭并重开工程后，用 `creator.prefab.instance.inspect` 和 `creator.prefab.source.inspect` 读回实例链接、3 节点 Prefab 结构、事件目标与处理函数，以及 `.fire`、`.prefab` 和 `.meta` 文件状态。

## 运行时结果与清理

- `creator.preview.start` 在 Web Preview 启动会话 `8a19e040-67ef-4fcb-9189-8f4acf5cb15e`，尺寸 960×640；启动时错误数为 0。
- `creator.preview.interact` 的点击断言通过：`CliAcceptanceButtonState.clickCount` 预期 6、实际 6；Status 节点存在；无新增 Console 错误。
- `ui-refresh` 调用 Widget 对齐刷新后，根节点宽度断言 880 通过，状态 Label 的 y 为 -70，未新增运行时错误。
- 预览截图中可见原 Button 文本与 `Ready` 状态文本；SpriteFrame 未配置，截图没有 Button 背景图，因此本项不声称验证了有贴图时的视觉样式。
- 通过 `creator.scene.node.delete.plan/commit` 删除临时实例及其两个子节点，operation `643acb8b-1e39-4615-859c-af65f0b680c1`。磁盘读回确认节点不存在，场景 `.fire`/`.meta` 哈希恢复到上面的基线。CLI 停止 Preview 后再关闭、重开工程，并完成最终身份及 Prefab 读回检查。

## 结论边界

这项闭环证明上述代表性 UI Prefab 可通过 CLI 创建、添加内置组件/节点、写入单字段、设置 Button 事件、实例化、重开读回并在 Preview 中交互。组合写入四个 Widget 字段的尝试失败，需维持逐字段写入。Prefab 创建和本次持久化编辑是验收夹具；本记录未对本夹具的每个永久编辑操作逐一执行来源补偿，故不据此扩大“所有 Prefab 字段均已补偿验收”的结论。来源补偿能力的独立已验收范围见 [Prefab 子树验收](cocos-cli-prefab-subtree-acceptance-20261024.md)；后续仍需按矩阵逐字段验证补偿及更多组件、资源引用和 UI 事件。
