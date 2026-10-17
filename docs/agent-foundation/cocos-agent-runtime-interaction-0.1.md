# Creator 2.4.15 同会话输入与业务断言合同 0.1

日期：2026-10-17。状态：**合同已定义；Host/CDP 单击与有限状态断言源码已接入 MCP，未运行测试、未完成 Creator 原生面板验收。** 仅支持 Creator 2.4.15 的 Agent 自有 Web 预览。此合同不支持 Native、移动设备、3.x、任意 JavaScript 执行或任意页面控制。

## 目标

让 Agent 在读取编译结果、Console、运行状态和截图后，对同一个已观察的 Web 预览会话发送一个有界输入，并在相同页面、同一场景身份中核验明确的业务状态变化。会话重启、页面导航、项目内容变化或 Creator 上下文变化均使旧引用失效。输入不得静默新建/切换会话，也不得因断线而自动重试。

## 工具合同

| 工具 | 访问 | 输入/输出 |
| --- | --- | --- |
| `cocos_2x_runtime_interact` | write | 一次 `pointer.click`；必须给出 `projectRoot`、最近成功观察返回的 `sessionId`/`pageId`/`pageGeneration`/`observationIndex`、场景名/UUID、预览 URL、画布内坐标、点击前条件和点击后断言。每次需本地批准。 |

一次调用最多一个左键点击；坐标是截图 canvas 的 CSS 像素原点相对值，整数且必须落在截图可见范围（最大 1280×720）内。无键盘、拖拽、连点、循环或坐标序列。默认稳定等待 300 ms，上限 1500 ms。CDP 使用当前 session 的原页面，不做导航、重载或替换。`observationIndex` 必须仍是该 session 最新成功观察的序号，每个 session 最多接受 128 个唯一 `interactionId`；不能重用 ID 规避不确定回执。

输入至少要求一个 `before` 条件和一个 `after` 断言。每项必须为 `{ nodePath, field, equals }`，路径限当前 Creator 场景内的节点路径；允许字段仅为 `node.active`、`node.x`、`node.y`、`label.text`、`button.interactable`、`sprite.spriteFrameUuid`。Label/Button/Sprite 字段必须在指定节点唯一解析；字符串最多 256 字符，数字有限且范围 ±100000，最多 8 项。另可要求 `noNewConsoleErrors: true`。不支持任意 selector、脚本表达式、正则、页面内容任意读取或模型提供的 DOM 查询。

桥接在派发前重新核验工程、Creator 实例、活动场景名/UUID、session ID、页面 ID、generation、URL、当前页面、画布尺寸及全部 `before` 条件。任一不符时不发送输入。鼠标按下后即使释放或回执超时，也只返回 `inputDispatched`/不确定副作用；不得重试。派发后读取同一页面的新状态并逐条返回断言结果、输入时间、事件前后错误计数、帧状态与截图。断言失败代表输入已发生但业务未通过，不能自动二次点击；应基于观察结果重新计划。

## 结果语义

- `outcome=assertions-passed`：唯一指定输入已派发、同会话和场景身份仍匹配、所有后置断言通过。只证明所列本地 Web 状态，不证明未观察的服务端/平台行为。
- `outcome=assertions-failed`：输入已派发且可读回，但至少一项断言失败。回执明确标出失败项；不得因为工具层调用成功而宣告功能完成或重放输入。
- `outcome=precondition-failed`：输入未派发，`inputDispatched=false`，说明不匹配项。
- `outcome=needs-review`：输入可能已派发但确认回执缺失/会话中断。只允许先重新观察同一会话或说明会话已丢失；不自动重试。
- 工程/Creator/场景/page/generation 不匹配时返回失败且不派发；用户重启或项目写入后须经批准的 `runtime.preview.start` 及新观察取得新 session token。

该交互不是项目文件写入，因此不使用脚本 operation ledger；使用不可复用的 `interactionId`，并通过 CocosAgent run/tool 记录保留输入、身份、before/after 断言与不确定状态。不能据此恢复/回滚服务器副作用。真实微信分享结果、支付/奖励等服务端事务需独立提供可核对回执，当前字段断言不能替代。

## 接入状态与验收

| 能力 | 合同 | Host/CDP 桥接 | skill | Creator 原生验收 |
| --- | --- | --- | --- | --- |
| 编译/import 错误 | 既有 `script.*` 回执 | 已实现，TS 分支来自 M1 0.2 | 已发布 | JS 有历史证据；M1 TS 分支待验收 |
| Console/异常、预览状态、截图 | [运行观察合同](cocos-agent-runtime-observation-0.1.md) | 已实现有界采集、同页复用、页面/场景身份核对 | 已发布 | 隔离工程有初始观察证据；错误修复闭环待验收 |
| `cocos_2x_runtime_interact` | 本合同 0.1 | MCP/Host/CDP 源码已接入单击与有限状态断言；未运行测试 | skill/引用已更新到源包 | 待打包和原生验收 |

原生验收须用可丢弃 Creator 2.4.15 Web 工程：观察基线及截图 → 在明确本地批准下点击 → 断言一项可见业务状态变化和 Console 增量 → 引入一个已知可逆代码错误/修复 → Creator 编译通过 → 批准预览刷新 → 同一场景新 session 再观察并断言恢复后的行为 → 补偿测试改动并确认源哈希基线。工具模拟或既有截图不能替代这组验收。
