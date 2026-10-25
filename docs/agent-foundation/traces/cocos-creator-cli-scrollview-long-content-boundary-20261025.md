# Cocos Creator CLI ScrollView 长内容边界验收（2.4.15）

日期：2026-10-25  
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`  
Creator：2.4.15  
CLI：0.12.62  
项目扩展：0.8.111

## 临时夹具与实机结果

操作全程经 Cocos CLI/MCP 完成，没有使用电脑 UI 自动化，也没有直接改写 `.fire`。活动场景 `CliAcceptanceScene` UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`，目标 `CliScrollViewTest` UUID `e5208b4b-2097-4b32-a721-e5065b5617eb`，ScrollView 组件实例 `ccA83T4olHbp1ovdLAxcn7`。测试前 `.fire` SHA-256 为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

首次创建六个 Label 时，Creator 将计划的 `180×40` 自动改为 `153.35×50.4`，CLI 以 `SCENE_COMPOSITION_TRANSFORM_MISMATCH` 标记 operation `7a2beff2-beb5-4fd3-a419-10adcba43143` 为 conflict。未重放此操作；先按原 UUID 删除部分创建的七节点子树（operation `7e489df4-37a5-42d4-97cb-2b8024a2b151`），移除临时 Mask（`fc160562-1073-40d5-82ae-776f4d72604a`），读回基线哈希后，使用 Creator 实测 Label 尺寸重新计划。

有效夹具由 CLI composition operation `84f06bb2-aa00-4cb7-9b5a-9424926b4e70` 创建：ScrollView View 为 `200×150`，Content 为 `200×600`，包含六个纵向相隔 100 的 Label 行。写入 `content` Node 引用 operation `3a362d31-7baf-4f45-8d99-53131975304f`，设置 `horizontal=false`、`vertical=true` 的 operations 分别为 `73fc89f2-683a-4bff-b9b3-be33af33ee7e` 和 `c0033fe0-5fe6-4641-bb87-c24e4999a38d`。ScrollView 节点临时添加 `cc.Mask`，operation `2b9425e0-9e5c-452a-be1d-020c4676f32b`，组件实例 `84QJxqGyhADZH3KnW1TgCh`。

Web Preview session `d33d2f20-b899-4551-ba3a-1e30863a8ce0` 绑定同一工程和场景。Mask 后的截图显示列表只在 View 内出现，行内容随 CLI 合成拖动改变，越过 View 的部分被裁切。Content 在 600 高度内容与 150 高度视口下的两端稳定位置为 `y=-225` 和 `y=+225`，与 `(600-150)/2` 相符：

- 向一端拖动并等待 1.5 秒后，Content `y=-225.0001205`，与 `-225` 的误差小于 5；`no-errors` 通过。
- 反向拖动后，中间位置读回 `y=-112.7641`，确认内容位移；三次同向长拖后采样 `y=221.0845`，再等待 1.5 秒读回 `y=225.0000418`，与 `+225` 的误差小于 5；`no-errors` 通过。
- 从另一端反向拖动两组后先读到 `-186.7053`，说明尚未到边界；再继续两次拖动，最终读回 `y=-225.0001205`，误差小于 5；`no-errors` 通过。

两端稳定截图 SHA-256：`10bc63375d0dc8d30a5726baee3969af8e63572cc653836f58c8b39180e851c7`（`y=+225`，显示末行）和 `a9a1e3934ff9fe27caf109cc4d124b0ed82783847389033a261243dcbbf77e2b`（`y=-225`）。中间滚动截图 SHA-256 `e1381efdb795075c9e63183a292087c9534265322db4a10b31c01b8d90ccaa89`。文件均在 `/Users/youjunmao/.cocos-creator-agent/captures/d33d2f20-b899-4551-ba3a-1e30863a8ce0/`。Preview 初次加载有项目脚本类名 warning，但所有最终 `no-errors` 断言通过，运行期错误数为 0。

本轮只通过 `200×150` View、`200×600` Content 的 Web Preview 长内容双边界、可视滚动和 Mask 裁切；其它视口/内容尺寸比例、设备触摸仍需单独验收。Scrollbar 联动见 [ScrollView/Scrollbar 运行时验收](cocos-creator-cli-scrollview-scrollbar-acceptance.md)。

## 恢复与关闭重开

Preview 已由 CLI 停止。`content` 按其来源 operation 做 CLI source-linked compensation，补偿 operation `31f79ae2-1934-4c58-b627-8c91df83195e`，Creator 磁盘读回为 null；`horizontal` 和 `vertical` 分别经 CLI property operation 恢复为基线 `true/false`。临时七节点子树由 operation `50d4daa1-a6b6-41f9-8903-f350342e7193` 删除，Mask 由 `007575f5-db48-405e-9aa4-eace6fb2c3aa` 移除。最终 Creator 磁盘读回显示 `.fire` SHA-256 精确恢复为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

Cocos CLI 关闭原进程 PID `87879` 并重开同一路径，PID `89149`、实例 `ea87bcd8-5205-46f5-9339-74b2ccf07f65` 返回 `editorReady=true`。重开后 `creator.project.info` 确认路径、项目名、Creator 2.4.15、扩展 0.8.111 和场景 UUID；场景快照为 23 节点，ScrollView 无子节点，恢复 `content=null`、`horizontal=true`、`vertical=false`。重开后文件哈希仍为上述基线。
