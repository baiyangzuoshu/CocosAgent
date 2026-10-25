# Cocos Creator CLI PageView 实机验收（2.4.15）

日期：2026-10-24。工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15。所有编辑器开关、场景修改、Preview 交互和读回应均通过 `cocos-creator-agent` CLI/MCP 完成，没有使用电脑 UI 自动化。

## 实机结果

在 `CliAcceptanceScene`（UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`）的 `CliPageViewTest`（UUID `e310016c-4e52-4d52-9001-031159005b20`）下，以 CLI 临时创建两个页面节点和各自 Label 子节点，挂载 Mask，设置 PageView content，并把 `pageEvents` 绑定到场景 Button 上的 `CliAcceptanceButtonState.onUiEvent`，自定义数据为 `page-turned`。

Preview session `d7fe2cc9-785d-4202-8493-43a61811126f`：

- 页面一向上拖动后，`_curPageIdx=1`、content y≈`+75`，Button handler 计数从 5 增至 6，末次数据为 `page-turned`，无新增运行时错误。
- 页面二向下拖动后，`_curPageIdx=0`、content y≈`-75`，handler 计数从 6 增至 7，末次数据仍为 `page-turned`，无新增运行时错误。
- 两次断言都读取同一 Preview session 的实时状态，位置容差为 1。

运行画面：

| 状态 | 截图 | SHA-256 |
| --- | --- | --- |
| 页面一 | `/Users/youjunmao/.cocos-creator-agent/captures/d7fe2cc9-785d-4202-8493-43a61811126f/capture-1792858824122-fb3549.png` | `e55b46e5684d56de6e9a58e84553b36e16425a479f40e8bbfa5e18d11707533c` |
| 页面二 | `/Users/youjunmao/.cocos-creator-agent/captures/d7fe2cc9-785d-4202-8493-43a61811126f/capture-1792858877628-5d2968.png` | `cb91b0345c66e83cbdf0231a5433687923a2e3bff90e84faa715352571dd1873` |
| 反向翻回页面一 | `/Users/youjunmao/.cocos-creator-agent/captures/d7fe2cc9-785d-4202-8493-43a61811126f/capture-1792858914603-365026.png` | `6a699168f1490b0911514de387cda6e7ce10a35606bdad59e1a370336bef14c1` |

## CLI 写入和恢复记录

临时页面子树由 `creator.scene.compose` 创建，包含 Content、Page One/Two 和两个 Label，5 个节点；Mask 使用 `creator.scene.node.add-component` 添加。PageView.content 用 `creator.scene.node.set-component-property` 写入精确 Node 引用，`pageEvents` 用 `creator.scene.ui-events.set` 写入。事件之后通过来源补偿恢复为空，再移除 Mask、将 content 清空，并删除临时子树。

清理发现一般空引用写入会在 `.fire` 留下显式 `"_N$content": null` 和 `"content": null`。扩展原本已有 setter 支持将 nullable 引用恢复成 `undefined`，但计划合同未暴露该选项，且计划器和 setter 都把相同的 live null 视为无变化。扩展 0.8.103 增加受限的 `restoreDefaultOmitted` 合同和计划状态，只允许空的 node/component/asset 引用；提交时通过 Creator setter 恢复默认省略，并验证磁盘字段确实省略。恢复操作：`c343f386-e4a2-4a7a-8a9d-f51e5a0d728a`，计划哈希 `b132cc479c79b4f771324cb89d546be05c2adc410cadea97d3bbb4a3cf56c106`，状态 completed，磁盘读回 `isDefaultOmitted=true`。

最终通过 CLI 关闭并重新打开工程，编辑器身份为 Tank、Creator 2.4.15、扩展 0.8.103、场景 `CliAcceptanceScene`。场景快照为 23 个节点、无临时页面节点；PageView 的 content 为 null 默认、`pageEvents` 和 `scrollEvents` 均为空。`CliAcceptanceScene.fire` SHA-256 恢复为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 保持 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

回归核验：`scene-component.test.mjs`、`scene-component-contract.test.mjs` 和 `script-modify.test.mjs` 共 106 项通过。本节记录的初次验收只覆盖垂直双页翻页和 pageEvents 单 handler；横向方向、indicator 与快速短滑边界的后续结果见下节。

## 横向翻页、Indicator 与速度边界补充（2026-10-25）

工程仍为 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15、项目扩展 0.8.103；场景编辑、预览和重开均通过 Cocos CLI 完成，没有使用电脑 UI 自动化。活动场景为 `CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`；横向验收使用预览 session `ac062885-c502-4e79-8b84-51222dd1bc4a`。

临时双页按 PageView 统一尺寸模式排列为第一页 x=0、第二页 x=200（视口 200×150）；位置由 `creator.scene.node.set-transform.plan/commit` 修正并验证 `.fire` 读回，操作分别为 `f4583ca5-f1f1-47b0-84da-9ed1b9604fff` 和 `8c85597f-3bfb-4aef-94d5-cc0d0e5e529f`。实际视口归一化 y 约为 0.656；此前 y=0.5 的拖动落在 Button 区域，页码没有变化，不计作翻页通过。

- 右向左拖动（x 0.27→0.08，400 ms）后 `_curPageIdx=1`；左向右拖动（x 0.10→0.28，400 ms）后 `_curPageIdx=0`。两次均在同一 session 断言 `no-errors` 通过。
- 固定短距离（x 0.25→0.17，归一化宽度 0.08，即 960 CSS px 画布上的 76.8 px）对照不同持续时间：80 ms 快滑后页码变为 1；复位后 500 ms 慢拖仍为 0。该距离低于 200 px 视口的 `scrollThreshold=0.5` 距离门槛；按 Creator 2.4.15 `CCScrollView._calculateTouchMoveVelocity`，80 ms 输入在 `brake=0.5` 时约为 480 px/s，500 ms 输入则因速度采样时间达到 0.5 秒而返回 0。CLI 合成指针动作确认了快/慢分支，不代表实体设备触摸测量。
- 两页 indicator 都可见，截图显示当前页黄色方块高亮切换；Preview 没有新增运行时错误。第一页截图 SHA-256 `091390310e890e674e8305cc106a836697d534d37629d87d1a418bea7aef586c`；普通翻到第二页 `f29c7c5f698f938f162e9d54885a295588edd12e5232c19bc1b85805c3dd0e8a`；快速短滑第二页 `4648e564e89ecea88e5d60a15760fdddee7a8ac2f275c7236bc3ee1ada37df77`。文件位于 `~/.cocos-creator-agent/captures/ac062885-c502-4e79-8b84-51222dd1bc4a/`。

恢复与清理通过 CLI 完成：PageView `indicator` 来源操作 `f98664cc-411a-4138-a3f3-663514b819c4` 的补偿操作 `00c55fb6-3ce1-4818-a580-54876ac1567b`；`direction` 来源操作 `2dd27a2e-876b-4acf-9397-8ec37dda5e6b` 的补偿操作 `705d74d0-3d50-4693-8fce-04017e6b1118`；`content` 来源操作 `4399a820-67c4-419e-bd03-99138795408d` 的补偿操作 `abf3e144-f0f2-4d9a-ad68-25c91dc2870e`。Mask 以操作 `0941ef99-16b0-4048-b078-f1aba7288a66` 移除；五节点 Content 子树和 Indicator 节点分别以 `906b1ad5-784f-4e2d-aa74-622d7b320a00`、`93ad736a-c6ce-45f7-9d93-cc8a05813b89` 删除。测试贴图 `829b29df-18c7-42ea-807e-887ea232099e` 完整引用扫描为 0，AssetDB 删除操作 `1562f61e-f3fc-4f12-bb5f-0e453bcce911` 读回主资源、子资源、文件和 `.meta` 全部不存在。

最后通过 CLI 关闭 Creator 2.4.15（PID `89777`）并重新打开同一绝对路径（PID `91977`，新实例 `26f29a73-e49e-42d2-8bd6-71d8bc958e9d`）。重开后的 CLI 读回为 23 个场景节点；PageView `content` 与 `indicator` 均为空默认，`horizontal=false`、`vertical=true`，`scrollEvents`/`pageEvents` 为空。`CliAcceptanceScene.fire` SHA-256 恢复为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`；测试贴图及 `.meta` 均已删除。

## 非统一尺寸页面与 Free 模式（2026-10-25）

工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15、扩展 0.8.111、CLI 0.12.62。场景 `CliAcceptanceScene` UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`，PageView 节点 UUID `e310016c-4e52-4d52-9001-031159005b20`，组件实例 ID `1c20B17oVEkqPBjcSXcHuW`。所有编辑、运行交互、关闭和重开均通过 Cocos CLI/MCP 完成。

临时夹具由 CLI `creator.scene.compose` 创建，操作 `41332fbb-4dc6-4567-b9ca-6b6000255d89`，计划哈希 `4e7cb17456fc9e90ee53b8d34d5f97dc34dda21298ca654389820e6d422fa20b`：Content 为 600×150，三个页面宽度依次为 160、200、240，各自带 Label；View 为 200×150。CLI 添加 Mask（`6c296b9e-0be1-463e-b528-8503c34101cd`），把 Content 引用写入 PageView（`914f604b-8e97-41a4-be6b-57cac808ac91`），再分别将 `direction=horizontal`、`sizeMode=Free` 写入，操作 ID 为 `7b80570d-4231-4df5-b99f-02e158ff7a52`、`2acd13ff-626f-4e0e-812f-6485f7378e24`。每次提交均由 CLI 从精确 `.fire` 读回。

Web Preview session `897154c7-0349-4c0b-b300-ec80a4de0348` 中，横向拖动两次使 `_curPageIdx` 依次从 0→1→2；反向拖动使索引回到 1、再回到 0。第一页端向外拖动后索引保持 0，第三页端向外拖动后索引保持 2。所有页码断言和 `no-errors` 均通过。第三页截图确认 `FREE PAGE THREE` 完整可见，SHA-256 `53e277786f467143ac9b63b40b9118494c8a78c18a32a503b137a8cc408fd12a`，文件 `/Users/youjunmao/.cocos-creator-agent/captures/897154c7-0349-4c0b-b300-ec80a4de0348/capture-1792880615210-b4432e.png`。另一个初始截图显示第一页标签被相邻页面内容挤压，因此只将页码切换与第三页可见性记为通过，不据此宣称三个不同宽度的排版都正确。

清理先按来源补偿 `sizeMode`（补偿操作 `4ffc7f3b-8ad4-43dd-b3ff-246e8dc47f10`）和 `direction`（`4d61be78-5799-4197-84a1-0d0ff7d3f5b8`），通过 CLI 移除 Mask（`0d07e3a7-b70f-44c9-8634-48b68ac2caf1`）并删除七节点 Content 子树（`af4a712b-5314-4a4d-a2ea-9b05fdb020d4`）。清空 `content` 时先以普通 null 写入产生显式序列化字段，CLI 再用 `restoreDefaultOmitted=true` 操作 `ab8a3677-b9b3-4ea2-8e06-786efe1dfed5` 恢复 Creator 默认的字段省略状态；最终 `.fire` 哈希恢复为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 哈希保持 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

CLI 关闭 PID `85562` 后重开同一工程，PID `85784`、新实例 `5df01368-8822-4663-9cd2-7634f3980ba9`。`creator.project.info` 再次确认工程路径和 Creator 2.4.15；场景读回 23 个节点，PageView 恢复 `content=null`、`horizontal=false`、`vertical=true`、`sizeMode=Unified`、`direction=Vertical`、事件列表为空。重开后的 `.fire`/`.meta` 哈希仍与基线一致。

本轮修正了 Free 模式夹具的页面几何后，三个非统一宽度页面都通过 Web Preview 目视确认完整显示。夹具由 CLI 组合操作 `1004a93b-7988-4067-8e68-512412861182` 创建：Content 600×150，页面宽度为 160、200、240，标签分别是 ONE、TWO、THREE；Label 的节点尺寸采用 Creator 自动测得的 52.01×50.4、55.98×50.4、81.34×50.4。首次尝试 120×40 的标签尺寸被组合器以 `SCENE_COMPOSITION_TRANSFORM_MISMATCH` 拒绝，未重放该失败操作；部分节点随后通过 CLI 删除并读回确认不存在，再以匹配 Creator 自动尺寸的计划重做成功。PageView.content 操作为 `82ae77c1-773e-4172-b85b-f6da3a8b7591`，水平 `direction` 为 `db9a4ceb-7078-47c3-b207-bf36eb4af1b6`，`sizeMode=Free` 为 `8b2815b9-e74d-413b-9c36-52f767a4af32`；Mask 添加操作为 `7662244b-f227-4d36-ac1f-6b004e9941bd`。

Preview session `b246455b-6573-4e7d-84b1-ac268d0fbca5` 中，两个连续向左拖动显示 ONE→TWO→THREE，两个反向拖动显示 THREE→TWO→ONE；两端再向外拖动时均无新增运行时错误，右侧端点页码仍为 2 的断言通过。ONE、TWO、THREE 的完整标签截图 SHA-256 分别为 `4d82842057d98bd7820bb1d9b95b209a0646f235a2797bceb4aad01791b0f853`、`5557f1dbdbf3b869d1b9f4578ed9c7786277f540b8d8257de1701969fb9a5b7f`、`67cb5dc00bd3fbbff9e4c4e92b603b9f6db7ca1aae675345f44cf0c2df813b7d`；截图保存在 `/Users/youjunmao/.cocos-creator-agent/captures/b246455b-6573-4e7d-84b1-ac268d0fbca5/`。反向回到 ONE 的截图 SHA-256 为 `bba1acfc0b45a7867cf98bd6f1a241ccba748290555794352619641b32e0eeb7`。所有成功交互的 `no-errors` 断言均通过。一次额外页码断言因使用错误路径读到 `null`，不计为通过；对应页面状态由截图核实。

Preview 停止后，CLI 来源补偿将 `sizeMode` 和 `direction` 恢复默认，操作分别为 `4ac50105-9cee-4e34-84a1-f25af01b6415`、`e693a7e7-a261-4571-9230-45ffcbf5d704`。`content` 的来源补偿计划返回 `OPERATION_NOT_FOUND`；依据原计划读回的 `isDefaultOmitted=true`，再通过受限的 `restoreDefaultOmitted=true` PageView 属性计划恢复空引用，操作 `d07d5aab-1f54-4e76-b6b5-b4731aafddfd`，磁盘确认字段被 Creator 默认省略。Mask 通过操作 `c3f82789-1585-4162-bea5-986a72d27ad6` 移除，临时七节点子树通过 `dd77e2d4-bf9b-488f-8943-7c582a007c92` 删除。最终 CLI 读回确认 `.fire` 恢复至 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 保持 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

随后 CLI 正常关闭 PID `85784` 并重新打开工程，PID `86997`、新实例 `8520134f-7764-407c-821a-e7e672d4e6e0` 返回 `editorReady=true`。重开后项目身份仍为 Tank、Creator 2.4.15、扩展 0.8.111，活动场景 UUID 不变；场景快照 23 节点，PageView 恢复 `content=null`、`horizontal=false`、`vertical=true`、`sizeMode=0`、`direction=1`。`.fire` 与 `.meta` 哈希仍为上述基线值。由此三个不同宽度页面的完整标签显示与双向切换通过；边界弹性回弹的视觉过程、设备触摸和惯性仍未验收。

## `scrollEvents` 回调补充（2026-10-25）

工程仍为 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15、扩展 0.8.108、CLI 0.12.62；编辑器操作全程通过 CLI/MCP。场景 `CliAcceptanceScene` 的基线仍为 23 节点。该轮首先在空的默认纵向 PageView 上拖动，页码和 handler 均未变化；这说明空内容夹具无法触发所需行为，不计为功能失败或通过。

随后 CLI 临时组合 Content、两个页面及 Label，给 PageView 添加 Mask，将其设为横向，并把 `scrollEvents` 绑定到场景 Button 的 `CliAcceptanceButtonState.onUiEvent`，自定义数据为 `page-scrolled`。事件列表写入操作 `fe22e20c-8b15-4601-95bc-0ec38b0ed356`，计划哈希 `892bf1dd1d7b220113b33ba8adde006e96cb7adb070281518964209b5bea7f13`。首次拖动和之后扩宽 Content 的复测中，`_curPageIdx=1` 与 handler 的 `lastValue=page-scrolled` 断言均通过，且 Preview 没有新增运行时错误，证明此操作路径确实触发了 `scrollEvents` handler。

但视觉翻页没有通过：Content 宽度改为 600 后，复测断言预期 Content x≈`-200`，实际约为 `-0.0036`；截图仍显示 PAGE ONE。该结果与 `_curPageIdx=1` 不一致，因此本补充只记录事件回调已触发，不把它记作可视翻页验收。该夹具需要先解释并修正页码、Content 位移与截图不一致，再重新验收回调与可视结果。

对照 2.4.15 的 `CCPageView.scrollToPage/_moveOffsetValue` 和 `CCScrollView.scrollToOffset/_calculateMovePercentDelta` 后，找到能解释这组结果的几何原因：复测夹具的 Content 宽 600、默认锚点 X=0.5、X=0，View 宽 200；`scrollToPage(1)` 请求 offset=200。Creator 将当前 Content 左边界 `-300` 与 View 左边界 `-100` 的差换算为 200，再以最大滚动距离 400 计算目标锚点 0.5，最终得到近零移动量。因此 `_curPageIdx` 可以进入 1 并派发事件，而画面仍显示第一页。这里是根据引擎源码和已记录的夹具几何推导的原因，不是新的运行时通过证据。下一轮夹具应让 Content 左边界与 View 左边界初始对齐（Content 锚点 X=0，左边界 X=-100；两页中心分别 X=100/300），再按 `scrollToPage(1)` 的目标位置检查第二页完整进入 View，并以截图和 Content 变换共同判定。

清理通过 CLI 完成：`scrollEvents` 按来源操作 `fe22e20c-8b15-4601-95bc-0ec38b0ed356` 补偿为空，补偿操作 `83fbe2e2-9843-4819-b547-2fdfc63b03f5` 已完成并读回空事件列表；Content 引用恢复默认省略，临时 Mask 与五节点子树删除。Creator 的 `direction` setter 在恢复默认方向时也将 `horizontal`、`vertical` 恢复为 `false/true`，因此不再对已自动恢复的字段重复执行来源补偿。该轮关闭后场景哈希为基线 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 哈希为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`；修正夹具及最终重开验收见下一节。

## 修正夹具后的双向 `scrollEvents` 与关闭重开（2026-10-25）

工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15，CLI 0.12.62，项目扩展 0.8.108。场景 `CliAcceptanceScene`（UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`），PageView 节点 UUID `e310016c-4e52-4d52-9001-031159005b20`。修改、Preview 操作、关闭及重开均通过 Cocos CLI/MCP 完成，没有使用电脑 UI 自动化。

修正后的临时夹具使用 View 200×150、Content 宽 400 且 anchorX=0、初始 x=-100，两个 200×150 页面中心分别位于 x=100 和 x=300；Content 左边界与 View 左边界对齐。PageView 使用横向方向，挂载 Mask，`scrollEvents` 指向场景 Button 上 `CliAcceptanceButtonState.onUiEvent`，自定义数据 `page-scrolled`。Preview session 为 `038c8a48-71a6-4097-8c1f-4eae49ab3312`。

- 正向拖动 x=0.27→0.08、y=0.656、400 ms 后，`_curPageIdx=1`、Content x≈-300、handler `lastValue=page-scrolled`，无新增错误；刷新后复测仍通过。截图完整显示 PAGE TWO，SHA-256 `3a4b366475bc72cfab82711bca3c6d668dead849b83148ba9d98dac6e79e8d93`，文件：`/Users/youjunmao/.cocos-creator-agent/captures/038c8a48-71a6-4097-8c1f-4eae49ab3312/capture-1792877795382-0c9e15.png`。
- 反向拖动 x=0.10→0.28、y=0.656、400 ms 后，`_curPageIdx=0`、Content x≈-100、handler 再次收到 `page-scrolled`，无新增错误。截图完整显示 PAGE ONE，SHA-256 `8afb45ea3ca870233f5962c02ddceac310d37265aa722c0741a5aeb6dfd0fa4`，文件：`/Users/youjunmao/.cocos-creator-agent/captures/038c8a48-71a6-4097-8c1f-4eae49ab3312/capture-1792877822715-88aa32.png`。

Preview session 已经由 CLI 停止。Label 字号按来源补偿恢复并通过精确 Creator save IPC 保存；PageView `content`、`direction`、`scrollEvents` 按来源补偿，临时 Mask 与五节点子树按来源计划删除。随后 CLI 关闭并重开 Tank：新实例 `d5308bae-70b7-4261-b90f-a7c73dffec6a` 回报路径 `/Users/youjunmao/WORK/Cocos_Engine/tank`、Creator 2.4.15、扩展 0.8.108，活动场景 UUID 不变。重开快照为 23 节点；PageView `content`/`indicator` 为空默认，`horizontal=false`、`vertical=true`、`direction=1`，`scrollEvents=[]`、`pageEvents=[]`。`CliAcceptanceScene.fire` SHA-256 为基线 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。因此先前页码/位置/截图冲突由夹具几何解释；修正夹具后的事件回调、双向可视翻页、清理和关闭重开读回均通过。

## 三页翻转与两端边界补充（2026-10-25）

工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15、CLI 0.12.62、扩展 0.8.111；场景 `CliAcceptanceScene` UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。整个临时场景编辑、运行交互、补偿、删除和整工程关闭/重开均通过 Cocos CLI/MCP 完成，没有使用电脑 UI 自动化。

在原 `CliPageViewTest`（UUID `e310016c-4e52-4d52-9001-031159005b20`）下用 `creator.scene.compose` 临时创建 600×150 Content、三个 200×150 页面及三个 Label，显示 PAGE ONE/TWO/THREE。组合操作 `6e60c43c-c415-4311-95d4-6acd0173856f`，计划哈希 `7169f8ed30ad399b2308c23bbe0c9b34a1e0885acdfc17be652d77bdd72a74bb`。另用 CLI 添加 Mask（操作 `79ddc5d0-f5bb-43b1-80c7-a2e415ea1495`），将 PageView.content 设为临时 Content 节点（操作 `f1e1e7e6-5f3c-4644-b313-275493336739`），并将 direction 设为水平（操作 `fb1b01e9-a14f-4143-be01-56cf8bab6c49`）。每次提交均读回 exact `.fire`；场景 `.meta` UUID 与哈希未变化。

Preview session `a54d047c-a9a9-4877-ad9c-5e5dd84e439f` 绑定上述工程和场景。视口 200×150，Content 初始 x=200，三个等尺寸页面排布在 x=-200、0、200。归一化 y=0.656 的 400 ms 横向拖动显示页面顺序切换：初始截图为 PAGE ONE；向左拖后截图显示 PAGE TWO；再次向左拖后 Content x≈-200，截图显示 PAGE THREE。页面一、二、三截图 SHA-256 分别为 `6210cc57ed3241ae23b7682444e0c6d49d38ec2469035cebf7c9ade850df93f2`、`ae5f558bf0b5b39ce7429b0d72c152827062aa40dd0e2b1e549e8ff2d7104ee0`、`9d9fe0692140158867b63f59584eed25fea6d785beaea35d5b82f2b035e97b0e`，均保存于 `/Users/youjunmao/.cocos-creator-agent/captures/a54d047c-a9a9-4877-ad9c-5e5dd84e439f/`。

运行断言读取 live `cc.PageView._curPageIdx` 和 Content 的 x：前进到第三页后得到 index=2、x≈-200.93；再向前拖一次仍为 index=2、x≈-200.93。反向两次分别得到 index=1、x≈0，以及 index=0、x≈200；继续反向一次仍停在 index=0、x≈200。所有这些交互的 `no-errors` 断言通过，Preview Console 没有运行时错误。边界位置使用 3 px 容差。组件计数、运行时页码、Content 位置与截图共同作为证据；只测到了三页、统一尺寸和当前 Web Preview 输入轨迹，不推断非统一尺寸、设备触摸或惯性行为已通过。

补偿与清理均按 CLI 精确操作执行：direction 来源补偿 `da61428f-2b58-4145-a87b-c73c825a257a`，计划哈希 `0020b7daa69468d5b5afa54ed0fa59200eb962905234f6578670b749f6e95e0f`；content 来源补偿 `075f6473-7c77-4624-bb39-b08a159c2fee`，计划哈希 `157222ab9d59b21a5258c20e0e958c6a9c23f40bdefce4412f56f1e28c14cdb9`，读回为默认省略的空引用。Mask 以操作 `92088bf9-c307-431a-a21d-9630b7782793` 移除。临时 Content 及其全部六个后代按精确七节点子树计划删除，操作 `5cad8073-5361-4e82-a02a-9844643aa695`；磁盘读回确认所有七个 UUID 已不存在。

随后 Cocos CLI 关闭 PID `83541` 并重开同一路径，PID `84555`、新实例 `74a27e49-43b4-4a08-87e1-b039f2673377` 返回 `editorReady=true`，项目路径、Creator 2.4.15、扩展 0.8.111、活动场景 UUID 均匹配。重开快照为 23 节点，PageView `content=null`、`horizontal=false`、`vertical=true`、`direction=1`、事件列表为空，变换保持基线。`CliAcceptanceScene.fire` 最终 SHA-256 精确回到 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 保持 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

## Free 模式越界回弹补充（2026-10-25）

工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15、CLI 0.12.62、扩展 0.8.111；活动场景 `CliAcceptanceScene` UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。运行和数值断言均在 CLI 预览 session `7402a88e-95e2-4c7b-b404-e2568ff29c79` 完成。此轮使用三页可见标签夹具：Content 宽 600，PageView 视口宽 200，页面宽度分别为 160、200、240。Content 稳定在第三页时 x≈`-200`；向端点外继续拖动后，120 ms 采样为 x=`-265.754`，说明弹性越界位移发生。等待 1300 ms 后，断言读到 x=`-200.00006`（稳定位置容差 2），`no-errors` 也通过。

第三页稳定截图 SHA-256 为 `52171aa43d58fd54af8e7b91a38bfb2eec9f4fbec9835bfce52cdd3747d4c556`；越界期间请求的截图 SHA-256 为 `5afbcbba1f2293d97c1efb0194090ea513406693d4a9d764d24a7e7297adb71b`，文件位于 `/Users/youjunmao/.cocos-creator-agent/captures/7402a88e-95e2-4c7b-b404-e2568ff29c79/`。截图调用有数百毫秒延迟，越界截图返回时动画已接近稳定状态；因此截图只能证明第三页完整可见，不能证明动画中间帧的视觉效果。当前证据支持 Web Preview 中的数值回弹及最终归位，不支持设备触摸/惯性或回弹动画像素过程通过。

清理通过 CLI 完成：方向恢复默认操作 `63a19f8a-8e7c-4c3e-9e83-cea87240453b`，Content 恢复默认省略操作 `e9004885-556a-40c9-9eb7-73b752e63766`，Mask 移除操作 `ffe8a147-4609-42d2-b351-9404a73bed43`，七节点临时子树删除操作 `1dac9dc7-560a-4c21-ae11-38eae81b790d`。关闭并重开后新实例 `f47d32e1-47a7-4f3f-bdf2-479e8cc6fa48` 报告同一路径和 Creator 2.4.15，场景快照为 23 节点，PageView 回到 `content=null`、`horizontal=false`、`vertical=true`、`direction=1`。`.fire` SHA-256 为基线 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

## Free 模式越界回弹补充（2026-10-25）

工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15、CLI 0.12.62、扩展 0.8.111；活动场景 `CliAcceptanceScene` UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。运行和数值断言均在 CLI 预览 session `7402a88e-95e2-4c7b-b404-e2568ff29c79` 完成。此轮使用三页可见标签夹具：Content 宽 600，PageView 视口宽 200，页面宽度分别为 160、200、240。Content 稳定在第三页时 x≈`-200`；向端点外继续拖动后，120 ms 采样为 x=`-265.754`，说明弹性越界位移发生。等待 1300 ms 后，断言读到 x=`-200.00006`（稳定位置容差 2），`no-errors` 也通过。

第三页稳定截图 SHA-256 为 `52171aa43d58fd54af8e7b91a38bfb2eec9f4fbec9835bfce52cdd3747d4c556`；越界期间请求的截图 SHA-256 为 `5afbcbba1f2293d97c1efb0194090ea513406693d4a9d764d24a7e7297adb71b`，文件位于 `/Users/youjunmao/.cocos-creator-agent/captures/7402a88e-95e2-4c7b-b404-e2568ff29c79/`。截图调用有数百毫秒延迟，越界截图返回时动画已接近稳定状态；因此截图只能证明第三页完整可见，不能证明动画中间帧的视觉效果。当前证据支持 Web Preview 中的数值回弹及最终归位，不支持设备触摸/惯性或回弹动画像素过程通过。

清理通过 CLI 完成：方向恢复默认操作 `63a19f8a-8e7c-4c3e-9e83-cea87240453b`，Content 恢复默认省略操作 `e9004885-556a-40c9-9eb7-73b752e63766`，Mask 移除操作 `ffe8a147-4609-42d2-b351-9404a73bed43`，七节点临时子树删除操作 `1dac9dc7-560a-4c21-ae11-38eae81b790d`。关闭并重开后新实例 `f47d32e1-47a7-4f3f-bdf2-479e8cc6fa48` 报告同一路径和 Creator 2.4.15，场景快照为 23 节点，PageView 回到 `content=null`、`horizontal=false`、`vertical=true`、`direction=1`。`.fire` SHA-256 为基线 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
