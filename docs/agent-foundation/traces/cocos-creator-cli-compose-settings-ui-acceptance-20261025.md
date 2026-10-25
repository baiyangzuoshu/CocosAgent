# Creator CLI 组合设置面板验收

## 环境

- Creator：2.4.15
- 工程：`tank`，`/Users/youjunmao/WORK/Cocos_Engine/tank`
- CLI 扩展：0.8.124
- 场景：`db://assets/CliAcceptanceScene.fire`
- 样例操作：`34e3dbef-bfea-4235-9221-0228c3e93135`
- 计划哈希：`4dfb1919ca181f522a1b04e4d27b8a46d1cb81aebeac7d186f265280d73ff5cd`

## 组合内容

一次 `creator.scene.compose.plan/commit` 创建 20 个场景节点、20 个组件、5 组通用 UI 事件（共 5 项）和一个现有 `Button.prefab` 实例。结构覆盖 Canvas 子节点、Widget 锚定、Label、Toggle 与 checkMark Sprite 引用、Slider 与 handle Button 组件引用、ScrollView、Content 上的纵向 Layout、Button 保存回调及 Prefab 资源引用。Pref​ab 内部没有被改写。

提交后 `.fire` 语义读回通过，`.meta` SHA-256 保持基线。CLI 关闭并重开 Creator 后，`creator.scene.compose.reconcile` 返回 `completed`，并重新确认场景及组件、事件、Prefab 引用。

## Preview 验收

- Web Preview 画布为 960×640；CLI 截图 SHA-256：`4b631edacc66e6a174387a6250e39fe1c4bd35243d918486cd13605b632ab678`。截图文件：`/Users/youjunmao/.cocos-creator-agent/captures/98d6f035-bfae-4353-9aee-1a803bd1a30a/capture-1792915021939-904c8a.png`。
- Save 点击后 handler 的 `lastValue` 为 `settings-save`；无新增 Console 错误。
- Toggle 点击后 `isChecked` 在 true/false 间切换，`checkEvents` handler 收到 `settings-music-check`；无新增 Console 错误。
- Slider 从 `(0.34, 0.27)` 拖到 `(0.47, 0.27)` 后，handler 收到 `settings-volume-slide`，没有命中 ScrollView；无新增 Console 错误。

截图中仍能看到验收工程原有的黑底与其他测试夹具文字，因此该截图证明布局节点和控件可见、交互命中，不作为最终美术样式验收。

## 来源补偿与恢复

来源补偿操作 `1175ba1a-4149-4545-afe0-58362d2b19bf` 只删除样例创建的 22 个节点（包含 Prefab 实例内部 Creator 节点），没有修改 Prefab 资源。补偿回执 `baselineRestored=true`。关闭/重开前后确认：

- 场景 `.fire` SHA-256：`6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`
- 场景 `.meta` SHA-256：`269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`

## 边界

Web Preview 结果不代表设备安全区、原生键盘或触摸惯性验证。设备依赖项目按 UI 验收矩阵继续标记为未验收；本轨迹仅证明上述 Creator 2.4.15 Web Preview 样例操作。
