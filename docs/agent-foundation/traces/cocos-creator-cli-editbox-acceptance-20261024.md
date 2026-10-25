# Cocos Creator CLI EditBox 运行时验收（2.4.15）

日期：2026-10-24（后续 CLI 关闭/重开核验：2026-10-25）  
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`  
Creator：2.4.15  
CLI：0.12.59  
项目扩展：0.8.103

## 验收范围

所有工程开关、场景修改、Preview 输入、读回和恢复都由 Cocos CLI 发起；没有使用电脑 UI 自动化，也没有直接编辑 `.fire` 文件。测试目标是 `CliAcceptanceScene`（UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`）中的 `CliEditBoxTest`（UUID `c78c652f-5508-4a97-b865-b56ee4d555c4`），组件实例 `f8PlRc29JPKKDTSOnv7VIg`。

CLI 临时创建两个 Label 子节点并设置 EditBox 的 `textLabel`、`placeholderLabel` 精确组件引用。字段计划/提交把 `inputMode` 从 `ANY=0` 改为 `SINGLE_LINE=6`，`inputFlag` 从 `DEFAULT=5` 改为 `PASSWORD=0`，`maxLength` 从 20 改为 5。每个事件列表分别绑定到 Canvas Button 节点 `96907646-d467-4b3b-8870-e0bc076a31fb` 上的 `CliAcceptanceButtonState.onUiEvent`，使用不同的事件数据：

| 事件 | customEventData | 写入 operation |
| --- | --- | --- |
| `editingDidBegan` | `edit-began` | `0decb71c-0016-4bb8-b999-016b3f904858` |
| `textChanged` | `text-changed` | `895965a4-9868-4f9c-99bf-6eaef488c54f` |
| `editingReturn` | `edit-return` | `3d274c64-b14e-43b6-8600-2263a008ea93` |
| `editingDidEnded` | `edit-ended` | `6da90672-e25f-4ef7-b23b-ac35be29a264` |

为便于输入，测试前通过 CLI 把初始字符串清空；此临时写入同样按来源补偿恢复。

## Web Preview 结果

Preview session `74ea747e-ca2b-457d-b00a-69bd7fd38cfd` 绑定同一工程和场景。点击 EditBox 并输入 `abc123456` 后，运行时 `cc.EditBox.string` 为 `abc12`，证明最大长度 5 生效；画面显示五个密码掩码字符。`textChanged` handler 已被调用。

按 Enter 后，字符串仍为 `abc12`，`editingDidEnded` 成为最后一个事件值，Button handler 的 `clickCount` 从 5 增至 9，证明 began、textChanged、return、ended 四个回调均实际触发。Preview 观察结果没有新增 Console 错误。截图：`/Users/youjunmao/.cocos-creator-agent/captures/74ea747e-ca2b-457d-b00a-69bd7fd38cfd/capture-1792860918544-5260a1.png`，SHA-256 `c81efe3c79fbce4aaa942dfb7c145ef413a8a6e8ea3e3270762c4aae81f3b95e`。

## 字段边界、恢复与关闭/重开

尝试把 Inspector 可见的 `placeholder` 设为非空值时，CLI 返回 `SCENE_COMPONENT_SERIALIZED_PROPERTY_MISSING`，因为当前保存场景省略了该默认字段。计划未提交、源文件未改；这个边界应由 CLI 后续明确支持或给出稳定的默认省略处理，不能绕过 CLI 改 `.fire`。`returnType`、stayOnTop/tabIndex、背景和字体引用及移动端原生键盘行为未在本次覆盖。

测试结束后停止 Preview，通过 CLI 来源补偿清空四个事件列表、恢复 `inputFlag=5`、`inputMode=0`、`maxLength=20` 及两个组件引用默认值，再通过 CLI 删除两个临时 Label。一次字符串补偿因恢复顺序早于 `maxLength` 而被 Creator 截断并进入 reconciliation；随后在先恢复 `maxLength=20` 后，通过新的普通 CLI 属性计划将字符串精确恢复为 `CLI EditBox`。没有重放不确定 operation，也没有留下场景改动。

CLI 关闭并重开 Tank 后，新实例 `400af0b8-d386-4dcd-9647-cfa1fc2b4910` 的 `creator.project.info` 确认工程路径、Creator 2.4.15、扩展 0.8.103 和活动场景。场景快照为 23 个节点，EditBox 保持原节点 UUID、单组件结构和初始值 `CLI EditBox`，四个事件列表为空；`.fire` SHA-256 为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`，均恢复基线。

本次证明 Creator 2.4.15 Web Preview 下的单行输入模式、密码掩码、长度截断和四种编辑事件回调，以及 CLI 属性/事件来源补偿和整工程重开读回；不外推到原生移动端键盘或其他目标平台。

## returnType 枚举往返补充（2026-10-25）

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15、CLI 0.12.60、扩展 0.8.106；`CliEditBoxTest` 节点 UUID `c78c652f-5508-4a97-b865-b56ee4d555c4`，`cc.EditBox` 实例 ID `f8PlRc29JPKKDTSOnv7VIg`。操作全由 Cocos CLI/MCP 发起。
- `creator.scene.ui.inspect` 读回 `returnType` 为可写 Enum：DEFAULT=0、DONE=1、SEND=2、SEARCH=3、GO=4、NEXT=5。CLI 计划/提交 DEFAULT→SEND：operation `7dfb61a3-e3ea-4ca7-a570-94ceea42b738`，plan hash `2b7146275618f6d0b32c1630815f7c5619bf199a9983c5608e9b746d5d7554be`。提交回执确认精确组件实例、保存场景的 `returnType=2` 和 `.fire` SHA-256 `2c90ec7471cb8aeef7143a5a1696a92d2f5cc94e475375d3932b831712bb02ae`；`.meta` 未变。
- CLI 关闭并重开后，实例 `104f37ee-851d-442f-b459-3d76e43de11c` 的 Inspector 再次读回同一节点/组件 UUID 与 `returnType=2`。随后按原 operation 来源生成补偿，operation `ac7aa228-cf19-4f23-bd33-5fef55eada6a`、plan hash `f3bf0ac15241c7e55a907062460c322fcaf340bf40afafb48fea46730db6de8e`，恢复 DEFAULT=0。
- 补偿后再次由 CLI 关闭/重开，实例 `17e880ce-64b3-4a18-b835-db554776fc46` 的 Inspector 读回 `returnType=0`；场景快照 23 个节点。最终 `.fire` SHA-256 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`、`.meta` SHA-256 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`，均恢复验收基线。
- 同轮再次尝试写入非空 `placeholder`，CLI 计划因保存的 EditBox 组件缺少 `_N$placeholder` 返回 `SCENE_COMPONENT_SERIALIZED_PROPERTY_MISSING`；未生成操作、未改场景。Creator 2.4.15 的 `placeholder` getter/setter代理到 `placeholderLabel.string`，序列化字段 `_N$placeholder` 默认 `undefined`，因此这个旧式代理字段仍未完成安全映射。不要将它误记为普通字段已通过，也不直接修改 `.fire`。`returnType` 只证明字段写入、关闭重开读回和来源补偿；SEND 键盘标签属于原生输入界面，Web Preview 不能证明其设备表现。

## 占位 Label 引用与运行时显示补充（2026-10-25）

- 当前工程版本：Tank `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15，CLI 0.12.62，扩展 0.8.108。通过 standalone Cocos CLI 打开工程，实例 `e1d994fc-41d5-49f2-8ddb-e9c35582390e`，活动场景和 EditBox 节点/组件身份与上文一致。
- 再次直接计划写 `cc.EditBox.placeholder="ENTER NAME"`，仍被 `SCENE_COMPONENT_SERIALIZED_PROPERTY_MISSING` 拒绝，未提交。验证了可用的间接编辑路径：CLI 创建 `CliEditBoxTextLabel`（节点 UUID `c8e89463-2c79-4239-9b1c-16fa4c205beb`）和 `CliEditBoxPlaceholderLabel`（UUID `1baa855d-1e86-43ca-ae28-a1ca895d06a4`）；分别设置 EditBox `textLabel` 和 `placeholderLabel` 引用，操作为 `a853837f-35ad-493b-abd6-083e6739e763`、`15974155-377d-48ed-93c4-b7eb28b34c52`。随后将占位 Label 的 `string` 改为 `ENTER NAME`（operation `90a03be7-0314-4ba4-a178-b7eae5b08897`），把 EditBox `string` 清空（`2fb452c9-3f20-488a-af6a-cd1b8d0635cd`），并将文本 Label `fontSize` 调为 24（`0fc14001-2589-4900-abc2-a8ed2a93b215`）。所有提交均经 CLI 属性计划/提交与 `.fire` 读回完成。
- Preview session `92050adf-0bba-4004-8f51-6abe3c1f74f2` 的 CLI 截图在空输入时完整显示 `ENTER NAME`，截图路径 `/Users/youjunmao/.cocos-creator-agent/captures/92050adf-0bba-4004-8f51-6abe3c1f74f2/capture-1792876428733-c6a543.png`，SHA-256 `15c59dc304878d4fe1066f17606d4d984993c0b4937a11e12cfe9533115745eb`。CLI Preview 点击并输入 `Mia` 后，运行时断言确认 `cc.EditBox.string="Mia"`、占位 Label 节点 `active=false`，无新增 Console 错误。
- 停止 Preview 后，分别按来源补偿恢复占位 `string="TYPE_NAME"`、`fontSize=40`、两个 EditBox Label 引用为空和 EditBox `string="CLI EditBox"`；所有补偿均精确读回成功。通过 CLI 删除两个临时 Label 后快照为 23 节点。standalone Cocos CLI 关闭旧实例（正常 quit fallback，进程退出且桥接断开）并重开项目；新实例 `173ad5e8-ac99-40c1-bfbd-243bd5320cc0` 的 `creator.project.info` 确认路径、Creator 2.4.15、扩展 0.8.108 和活动场景，场景快照确认 EditBox 节点保持原 UUID、字符串 `CLI EditBox`、两个 Label 引用为空。`.fire` SHA-256 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`，均与基线一致。
- 这证明通过 `placeholderLabel` 引用修改其 Label 文本可实现并在 Web Preview 验收占位显示/隐藏；不代表 `EditBox.placeholder` 代理属性本身已可安全写入，也不覆盖原生移动端键盘。重开后 Creator 诊断有两条既有 `CliAcceptanceButtonState` 脚本序列化警告，没有编译错误。
