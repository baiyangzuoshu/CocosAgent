# Cocos Creator CLI ScrollView 纵向滚动、惯性与回弹验收（2.4.15）

日期：2026-10-25  
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`  
Creator：2.4.15  
CLI：0.12.59  
项目扩展：0.8.103

## CLI 编辑与持久化

全程通过 Cocos CLI 操作 Creator 场景与 Web Preview，没有使用电脑 UI 自动化，也没有直接编辑 `.fire` 或 `.meta`。目标场景 `CliAcceptanceScene`（UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`）中的 `CliScrollViewTest`（UUID `e5208b4b-2097-4b32-a721-e5065b5617eb`），ScrollView 组件实例 `ccA83T4olHbp1ovdLAxcn7`。

临时 Content 节点 `CliScrollViewVerticalContent`（UUID `317cab49-b317-42b0-99cd-b988d3146c4e`）通过场景组合 operation `1ca4294e-f74a-46b7-b073-a452e60269b7` 创建，尺寸 200×600。`ScrollView.content` 指向该节点，`horizontal=true→false` operation `498042f8-0776-4220-8f3c-c704bde401fe`，`vertical=false→true` operation `1305a3fa-d2f4-4ab4-98ed-20269943d504`；每次提交均由 Creator 读回精确组件字段及 `.fire`。

## Web Preview 运行结果

Preview session `7070b109-0ff9-4c6e-9f02-a8ba9e85b171` 绑定上述工程、场景与 Creator 实例。预览画布为 960×640。竖直短拖后，Content 的运行时 Y 到 `232.1047`，略越过可滚动边界；在边界松手并等待 1500 ms 后回到 `225.0001`，验证 `elastic=true` 的回弹。反向拖动后 250 ms 时 Y 为 `57.5264`，继续等待 1500 ms 后到 `-34.8860`；再等待 2500 ms 仍为 `-34.8860`，显示惯性继续移动后逐渐停止。场景身份断言通过，Console 没有新增错误。CLI 的第一次预览点击调用因漏传必需断言被合同拒绝，没有执行动作；后续所有报告的交互均有明确的运行时断言。

截图文件 `/Users/youjunmao/.cocos-creator-agent/captures/7070b109-0ff9-4c6e-9f02-a8ba9e85b171/capture-1792862484427-debc89.png`，SHA-256 `4112b8d62cc3c65975dd8ccebbf3a9960bf7b835cd473c48cbf80f8b80152b54`。临时 Content 没有 Sprite 或 Label，因此截图只能确认当前画布无新增错误和场景其他 UI 正常显示，不能作为可视列表裁切或滚动效果证据；本次只验收滚动位移、惯性与回弹数值。

## 恢复、关闭/重开与基线核验

ScrollView `horizontal` 通过来源补偿 operation `75881a08-1c28-4cd1-a324-bb486d7d4464` 恢复为 true，`vertical` 通过来源补偿 operation `6a4371ab-16a2-4747-be52-a94ea67f908a` 恢复为 false。`content` 通过 CLI 计划 `995853fa-be8a-4a65-b59b-fdbbdc0bfbce` 清回 Creator 默认省略状态（序列化读回 null）；之后 CLI 删除临时节点 operation `a0f1662d-3558-49fc-84e8-e95969236bbf`。这次默认省略规范化使 `.fire` 与测试前字节哈希不同。确认差异只有 ScrollView 的 `_N$content:null` 和 `content:null` 两项默认空引用后，用 Git CLI 从现有索引精确恢复单个场景文件到测试前记录的 SHA-256 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`；没有改写 `.meta`、UUID 或引用。

Cocos CLI 正常关闭进程 `72595`，再打开同一绝对路径工程，返回新实例 `28e3d7b9-344f-4df4-8e67-bd6ebfb7f665`，`editorReady=true`。之后因字节级恢复，再由 Cocos CLI 关闭并重开一次，最终实例 `9831a450-6b80-4c14-a7db-4ee30f6ea38c`。`creator.project.info` 确认工程名 `tank`、绝对路径和 Creator 2.4.15；`creator.scene.snapshot` 为 23 个节点，ScrollView 无子节点，字段为 `content=null`、`horizontal=true`、`vertical=false`、`scrollEvents=[]`；`creator.scene.ui.inspect` 再次读回相同状态。重开后场景 SHA-256 仍为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.fire.meta` SHA-256 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`，均回到测试前基线。

本次通过只证明 ScrollView 的纵向数值滚动、惯性减速和弹性边界回位。可视纵向内容、垂直 Scrollbar 联动、其他视口/内容尺寸组合仍待验收。
