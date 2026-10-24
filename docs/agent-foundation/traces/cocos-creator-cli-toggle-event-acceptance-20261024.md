# Cocos Creator CLI `cc.Toggle.checkEvents` 验收（2026-10-24）

本记录验证 Creator 2.4.15 场景 Toggle 事件列表替换、CLI 关闭/重开读回、预览运行时触发和来源补偿。工程编辑、关闭/重开、预览控制均经 Cocos CLI/MCP 完成，没有使用桌面 UI 自动化。

## 身份与基线

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：`2.4.15`；扩展：`0.8.74`
- 场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- Toggle 节点：`CliToggleTest`，UUID `eb41dab0-5804-4a18-a002-d67a47115558`
- Toggle 组件实例：`e9W1GquM9FyaPcXkeZQWx5`
- Handler 目标节点：`Button`，UUID `96907646-d467-4b3b-8870-e0bc076a31fb`
- Handler：`CliAcceptanceButtonState.onClick(event, customEventData)`；此方法仅增加 `clickCount` 并记录 `lastValue`
- 原始 `checkEvents`：该目标/组件/方法，`customEventData="toggle-cli-test"`
- 原始 `isChecked=false`；场景 SHA-256 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`；`.meta` SHA-256 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`

## 事件写入、重开和运行时触发

1. CLI 计划并提交操作 `6bd52d01-ea7f-425c-961a-c2392aed57df`（计划哈希 `41e5319994345f5674fcdab4b303218b337cec0803a1248a1e61b316091e6e15`），仅将 `customEventData` 更换为 `toggle-cli-acceptance-v2`。Creator 保存后精确读回目标 UUID、组件类、handler 和新数据；场景 SHA-256 为 `6e5406c0d9219cd2da1f0849929835975ce467a79f8a1e51ad60410bfc7f40de`，`.meta` 不变。
2. CLI 关闭工程（`closed=true`、`processExited=true`）并重开，新实例 `55af2038-8c1d-4a02-879e-bb88cfec4ca6`。工程路径、Creator 版本、活动场景正确；`creator.scene.ui.inspect` 读回新的 `checkEvents` 列表，`isChecked=false`。
3. CLI 启动绑定此实例和场景的 Web Preview（session `ca10d4b5-893b-4c71-9dc0-228c0f28787c`），在 Toggle 归一化坐标 `(0.1875,0.171875)` 点击。`creator.preview.interact` 三项断言全部通过：Toggle `isChecked=true`、目标脚本 `lastValue="toggle-cli-acceptance-v2"`、无新增 Console 错误。随后 CLI 停止此预览 session。

## 补偿与最终核验

1. CLI 计划补偿 `8b0e198e-4b76-42b9-a7ff-726d91717c5f`（计划哈希 `65b7456bf907d540c0c17eda1752801150f73bec84d0906e62208ffe91b73ace`），将事件恢复为基线的 `customEventData="toggle-cli-test"`。提交回执确认精确 `checkEvents` 写回和场景 SHA-256 基线恢复；`.meta` 哈希不变。
2. CLI 再次关闭并重开，实例 `080e6e49-f841-40f5-912d-17e5563467ce` 的工程身份和活动场景正确。Inspector 读回 `isChecked=false` 及原事件列表；场景与 `.meta` 哈希均为原始基线值。

## 结论与边界

已验证一条 Toggle `checkEvents` 能以精确目标节点、组件和公开 handler 写入，通过 Creator 保存和工程关闭/重开后读回，并在 Web Preview 中由用户输入事件触发目标脚本。尚未覆盖多事件列表、空列表、无效目标拒绝和 ToggleContainer 排他切换。
