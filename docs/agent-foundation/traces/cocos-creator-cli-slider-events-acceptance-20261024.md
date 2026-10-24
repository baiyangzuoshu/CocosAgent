# Cocos CLI Slider.slideEvents 验收（Creator 2.4.15）

本记录验收场景 `cc.Slider.slideEvents` 的写入、运行时拖动派发、来源补偿、工程关闭/重开和最终数据清理。所有工程与预览操作均通过 Cocos CLI 完成，没有使用电脑 UI 自动化。

## 环境与身份

- Creator 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15，活动场景 `CliAcceptanceScene`，场景 UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。
- 验收组件：`CliAcceptanceScene/Canvas/CliSliderTest`，节点 UUID `07762af0-78a7-4529-9cff-846c1a39d6e0`，Slider 实例 `b6IBIFAiJDYpWDT9COncUZ`。
- 事件目标：`CliAcceptanceScene/Canvas/Button`，节点 UUID `96907646-d467-4b3b-8870-e0bc076a31fb`，脚本 `CliAcceptanceButtonState.onUiEvent`。
- 完成时 CLI 为 0.12.59，Creator 扩展为 0.8.91。Creator 项目身份均由 `project info`、`instances list` 和 CLI 重开回执确认。

## 事件写入与运行时拖动

1. 初始 Slider `slideEvents=[]`。事件计划/提交 operation `d4289d77-71f6-4f68-ac9b-f5b7480f060c`（plan hash `df3214e3c7f5d45d721b2006e9656f43411c8099e2e425e780cfe7389f55c999`）写入一个绑定到 `Button/CliAcceptanceButtonState.onUiEvent` 的事件，`customEventData="slider-event-test"`。Creator `.fire` 精确读回 SHA-256 `59fdd9be17a4550ef670c5a459812c68d76d56dd1757124f6436df7a5921aca1`。
2. 运行时预览 session `bf6d2069-4180-4905-89aa-4d19a4d5f95b` 中，CLI 拖动 Slider。断言通过：handler 的 `lastValue="slider-event-test"`，Slider `progress=0.7833333333333333`（目标 0.78，容差 0.03），无新增 Console 错误。该结果证明拖动改变进度并触发绑定回调；夹具没有手柄 Sprite，不证明可视样式。
3. 运行时读回最初返回 `progress=null`，原因是 CLI 预览断言读取器没有覆盖 Creator 2.4 `cc.Slider.progress` 的存储字段。扩展了安全的 `_N$progress` 读取映射，并允许数值组件断言指定 0–100 范围内的容差。新增回归后，预览定向测试 14/14、CLI 全量测试 356/356 通过；桥接重启后重复运行上述预览断言全部通过。

## 补偿与跨重启

- 首次来源补偿计划 `45e24676-c366-4907-bd1d-d744159e7c1f`（hash `1faaa6ecc819eece52732ba81a11d4e1e36144a4b013bc5e97107d1b1d97a08a`）在 commit 前被 reconcile，记录为 `not-applied`；CLI 正确拒绝提交已经 reconcile 的计划。该路径暴露补偿源操作被未执行计划永久占用的问题。
- 扩展加入了安全重计划条件：旧补偿必须已 reconcile 为 `not-applied`，且精确来源链接和值方向匹配；旧计划被标记为 `superseded`，从不重放。来源 operation 可在保持同一 Creator 版本、工程身份、源 hash 和已验证磁盘回执的情况下跨扩展合同版本核验。
- 新来源补偿计划/提交 operation `228c127a-f05f-470c-af1a-8f2cef7e2116`（hash `58638554a20449e5b3018a88b79d054e5d92e533d5ef5674666eb98be1ef5ef7`）将列表恢复为空。Creator 磁盘读回 SHA-256 为 `4b638aecbbe3b0772668f8377148942503bf672387007633f75c5b4aca95008f`，`.meta` SHA-256 始终为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
- CLI 关闭并重开 Tank 后，新实例 `16847298-d629-4731-80bd-511af7abf24e` 的 `project info` 确认同工程、Creator 2.4.15 和场景 UUID；UI Inspector 读回 `slideEvents=[]`。补偿 reconcile 为 `completed`，磁盘事件列表与补偿 after-state 匹配。

## 手柄夹具清理与最终状态

为拖动测试临时创建的 Slider 子节点 Button（UUID `0ef31e74-b3ed-425b-ba92-f979379b1ad2`）通过 handle property operation `330a99f9-0c38-4fe8-9db6-102c569339ea` 挂接。来源补偿 operation `5086ea6f-8d48-438f-8e9e-c858b5a68317` 将 `handle` 恢复为空；CLI 磁盘回执确认 `_N$handle=null`。随后精确节点删除 operation `ca722b41-79c9-4a0d-aafa-ed74cbc164cf` 删除临时 Button，Creator 读回场景 SHA-256 恢复为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` hash 不变。

再次由 CLI 关闭并重开工程，实例 `c7179086-297f-411a-a8cc-dfc8cde82493` 确认 Creator 2.4.15、扩展 0.8.91 和活动场景一致。Slider Inspector 读回 `progress=0.25`、`handle=null`、`slideEvents=[]`；删除和两项来源补偿 reconcile 均为 `completed`。最终 `.fire` 与 `.meta` 哈希回到夹具初始基线，Git 中 `tank/assets/CliAcceptanceScene.fire` 无差异。

## 结论

Creator 2.4.15 的 `Slider.slideEvents` 场景写入、目标 handler 解析、运行时拖动派发、数值断言、来源补偿、关闭/重开读回及临时夹具清理通过。证据不覆盖有可视 Sprite 的 handle 外观，也不推及其他 UI 事件字段；ToggleContainer、ScrollView、PageView 与 EditBox 事件仍需逐项实机验收。
