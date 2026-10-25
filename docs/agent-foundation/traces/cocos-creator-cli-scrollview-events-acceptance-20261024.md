# Cocos Creator CLI ScrollView scrollEvents 实机验收（2.4.15）

日期：2026-10-24（关闭/重开核验：2026-10-25）  
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`  
Creator：2.4.15  
CLI：0.12.59  
项目扩展：0.8.103

## 修改与绑定

全程使用 Cocos CLI 操作 Creator、场景和 Web Preview，没有使用电脑 UI 自动化，也没有直接编辑 `.fire`。目标是 `CliAcceptanceScene`（UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`）中 `CliScrollViewTest`（UUID `e5208b4b-2097-4b32-a721-e5065b5617eb`）上的 `cc.ScrollView`（实例 `ccA83T4olHbp1ovdLAxcn7`）。

CLI 组合操作 `90d6e563-4213-4c26-8083-fccfa115b61e` 创建临时无组件 Content 节点 `CliScrollViewEventContent`（UUID `5a4fa531-2e1d-41ca-91ba-5d66f9e2d26f`），尺寸 600×150。属性 operation `b296ff3a-951c-4d6d-873f-663d6e6e1118` 把 `ScrollView.content` 设为该节点。事件 operation `33905047-cacd-428f-a0b4-559f7f4f1ded` 将 `scrollEvents` 绑定到 Button 节点 `96907646-d467-4b3b-8870-e0bc076a31fb` 的 `CliAcceptanceButtonState.onUiEvent`，`customEventData=scroll-event`。三项提交均通过精确身份及 `.fire` 读回。

## Web Preview 运行时结果

Preview session `82a5098c-db5f-4a0b-be29-006f304a7540` 与同一工程、场景绑定。先用长拖动探索时，Content x 从 0 变为 `-204.50`，反向拖动后为 `-92.00`；无新增 Console 错误，handler 的 `lastValue` 为 `scroll-event`。首轮预期位移断言写得过窄而失败，不作为通过证据。

通过 CLI 刷新 Preview 复位后，短拖动 `(0.82,0.344)→(0.76,0.344)`（200 ms）使 Content x 从 0 变为 `-58`；反向 `(0.76,0.344)→(0.82,0.344)` 后 x 回到 0。两次均断言精确 handler 的 `lastValue=scroll-event`，场景 UUID 匹配且 `no-errors` 通过。此夹具无 Sprite，因此本项证明滚动位移和事件分发；可见滚动内容与 Scrollbar 手柄联动由 [ScrollView/Scrollbar 视觉验收](cocos-creator-cli-scrollview-scrollbar-acceptance.md)单独证明。

## 恢复及最终读回

事件通过来源补偿 operation `6515acc4-2fd1-4eec-b228-e7c85faf23fd` 清空；Content 引用通过属性来源补偿 operation `4749a7b0-aa50-4da6-ac38-5dedd175c235` 恢复为默认省略；临时节点经 CLI 删除 operation `13c3d99e-d79b-4c9a-a4e6-3b0655b685e9`。删除提交即读回 `.fire` 基线哈希 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 哈希 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

随后由 Cocos CLI 关闭并重开整个 Tank 工程。新实例 `aab08edc-db85-4f73-a90e-9eef16b682e9` 的 `creator.project.info` 确认工程路径、Creator 2.4.15、扩展 0.8.103 和活动场景。`creator.scene.snapshot` 显示场景 23 个节点，ScrollView 无子节点；`creator.scene.ui.inspect` 确认 `content=null`、`scrollEvents=[]`。`.fire` 与 `.meta` 哈希仍与基线一致。

本次通过只覆盖水平滚动及一个 `scrollEvents` handler；纵向滚动、惯性/回弹、不同视口与 Content 尺寸组合仍待验收。
