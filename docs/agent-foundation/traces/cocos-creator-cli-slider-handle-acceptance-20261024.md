# Cocos CLI Slider.handle 组件引用验收（Creator 2.4.15）

本记录验证场景 `cc.Slider.handle` 通过 Cocos CLI 指向一个精确 `cc.Button` 组件实例，在 Creator 重开后保持引用，并能按来源 operation 清空。验收完成后 CLI 删除临时节点并确认场景恢复原始 SHA。

## 工程与版本

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15，CLI 0.12.57，扩展 0.8.88。
- 场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。
- Slider：`CliAcceptanceScene/Canvas/CliSliderTest`，UUID `07762af0-78a7-4529-9cff-846c1a39d6e0`，组件实例 `b6IBIFAiJDYpWDT9COncUZ`。
- Button handle 夹具：临时 Slider 子节点 `CliSliderHandleFixture`，UUID `5d56b94d-1575-40f5-aa3b-e8b5d3bcc49d`，Button 实例 `0aQ1LOfCJLtKcxVZhdftBk`。

## 验收过程

1. 开始时 `.fire` SHA 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` SHA 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。CLI Inspector 确认 Slider `handle=null`，`progress=0.25`。
2. 初次把 Slider 指向现有 `Canvas/Button`（UUID `96907646-d467-4b3b-8870-e0bc076a31fb`）后，Creator 2.4.15 的 `CCSlider.js` `handle.notify` 调用 `_updateHandlePosition()`，将这个 Button 从 Canvas 局部位置 `(0,0)` 移到 `(-345,100)`。这表明 handle 引用 setter 会改变目标 Button 节点位置，CLI 属性计划当前不会预先显示该目标节点副作用。CLI 随后以 operation `ebc7d400-fb72-41e4-86a3-eef92a3ba1e9` 将按钮位置恢复为 `(0,0)`，Creator `.fire` SHA 精确回到初始基线；此共享 Button 不作为最终 handle 验收目标。
3. CLI 创建临时 Slider 子节点及 Button，节点 UUID `5d56b94d-1575-40f5-aa3b-e8b5d3bcc49d`，初始局部位置 `(-45,0)`。此位置与 Slider 宽度 180、中心锚点和 progress 0.25 对应。设置 `handle` 的 operation `66805624-7e01-4c1e-b125-6d10dc917f6d`（plan hash `e8d7c9ff0c08944c209edb8a7c9d7e00b5d59db26e5439476844880ae0928314`）成功；Creator 磁盘读回 `_N$handle` 精确指向该节点和 Button 组件。
4. CLI 关闭并重开整个工程。新 Creator 实例 `263d7ae5-bcc3-4430-9907-4e2cfee27b6b` 的 `creator.project.info` 和 `creator.scene.ui.inspect` 确认工程、Creator 版本、场景、Slider、Button 组件 ID 及引用均一致。来源补偿 operation `3291a075-e7f8-4818-89fd-9fe50f2240e9`（plan hash `e9e86c806a52facf005af78c9a84689d10cce3775efd818f13f01df29791641d`）仅将 handle 恢复至原空引用，Creator 磁盘读回 `_N$handle=null`。
5. CLI 删除临时子树，删除 operation `e60851aa-2d29-491a-aecb-7efb356f673a` 返回 `completed`，`.fire` SHA 精确恢复到 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 哈希不变。再关闭/重开后，CLI 确认夹具 UUID 不存在、Slider.handle 为空、Canvas/Button 位置恢复为 `(0,0)`；删除 reconcile 在新实例返回 `completed` 且磁盘 SHA 仍为基线。

## 边界

`handle` 组件引用的序列化往返、重开、来源补偿和临时结构清理通过。运行时拖动、可视手柄（本夹具未挂 Sprite）和 `slideEvents` 尚未验收。Creator 会自动定位所设 Button；调用者必须检查 handle 节点的父子关系与预期位置，避免意外移动现有 UI 节点。
