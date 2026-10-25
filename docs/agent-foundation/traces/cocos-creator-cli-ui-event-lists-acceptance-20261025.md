# Creator 2.4.15 UI 事件列表闭环验收（2026-10-25）

本轨迹仅针对 Tank 的 Web Preview，所有工程读写、关闭/重开及运行时交互均经 Cocos Creator Agent CLI。验收工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，场景 `CliAcceptanceScene` UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`，Creator 2.4.15，扩展 0.8.111。

## 操作范围和结果

- 逐项读取 Button、Toggle、ToggleContainer、Slider、ScrollView、PageView、EditBox 的 12 个事件列表；目标为 Button UUID `96907646-d467-4b3b-8870-e0bc076a31fb` 与 Label UUID `a82641c0-22e3-4ef4-b390-9fd1a7d16a26` 上的 `CliAcceptanceButtonState.onUiEvent`。不同 `customEventData` 用于区分两个目标和事件属性。
- 每项均通过 CLI plan/commit 写入两个目标、清空为 `[]`、按 clear 操作来源补偿回双目标、再按 multi 操作来源补偿到最初事件列表。每次提交都读取 Creator Inspector 和保存 `.fire`；所有 operation ID 如下。
- 双目标列表在 CLI 关闭并重新打开整个 Creator 工程后逐项读回。清空列表亦在另一次完整关闭/重开后读回。恢复阶段每项都通过 commit 的磁盘读回和 Inspector 逐项读回。
- Web Preview Button 点击时两个目标分别从 `clickCount=5/0` 变为 `6/1`，`lastValue` 精确为 `cc.Button.clickEvents:1/2`。Toggle 点击使 `isChecked=false→true`，其 `clickEvents` 与 `checkEvents` 共四次回调使两个目标计数变为 `8/3`；无新增 Console 错误。
- 清空并重开后再次点击 Button，两个目标计数维持 `5/0`，无新增 Console 错误；重启后的 12 个事件列表均为空。
- 原始列表恢复后，CLI snapshot 为 23 个节点且未截断；临时第二目标脚本组件按精确实例 ID 删除后，Label 节点仅含原 `cc.Label`。场景 `.fire` SHA-256 恢复到最初的 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 恢复到 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

## 逐项操作 ID

| 组件 | 事件属性 | 双目标写入 | 清空 | 清空补偿到双目标 | 双目标补偿到原始 |
| --- | --- | --- | --- | --- | --- |
| `cc.Button` | `clickEvents` | `a46ffb0d-8650-4031-86f1-dd9634d747ce` | `9f4a913f-57a6-4e5b-80ee-2d773ae42cc2` | `16fc1779-7cb1-4484-a728-4d59f29feb7c` | `cb56e957-affe-4dd1-949f-d04d3c3bff42` |
| `cc.Toggle` | `clickEvents` | `85690f91-51d0-4dd8-886e-67e1eb0ee873` | `28cd576b-50be-4578-9af4-623410c72644` | `35f6beec-5da4-40ce-a3b3-036c09dcdf97` | `f7c7bda3-6de4-422a-8d29-c6117d35983b` |
| `cc.Toggle` | `checkEvents` | `258da0e8-f917-4b1a-919d-1b6488d5c098` | `63feadba-a735-44c5-b761-cde2ac4dcf56` | `9528ffc8-2757-4507-9304-60976f9e954d` | `58a95998-b778-4172-b931-6f35def9ce66` |
| `cc.ToggleContainer` | `checkEvents` | `c57017be-8d63-432e-b6df-7463d73190cf` | `e7d72ec2-9331-4a46-914c-c7b4dd72901e` | `eb82a06d-805e-461b-b370-380ff8cfb734` | `572a209f-6b6b-44d7-86d1-c4b8a99629d8` |
| `cc.Slider` | `slideEvents` | `01e24590-b4b0-48a0-b829-7051ad01304f` | `a20d54d4-8d50-4714-9629-3f7ed12f4113` | `a8440894-fe20-4e80-93bd-d83062ac3d6a` | `0a517515-8bc8-491e-b7fd-7d6e51f69b42` |
| `cc.ScrollView` | `scrollEvents` | `7da3c0ac-2bc0-4efa-bd4e-e0de40ee719d` | `2884b2b8-9f5b-4dd8-959a-bccdacd4b120` | `d7911f57-c222-42da-a4d9-5a4cdfa0f821` | `a0eecd79-dc4d-4b83-998b-5dc95ade90a1` |
| `cc.PageView` | `scrollEvents` | `33466dca-a9db-4164-a972-2659dd5a6656` | `ffdc4484-f719-4133-a638-6560b9e7a38a` | `d12bd564-740d-4a3d-ba07-9316aa995c21` | `97a87b04-c950-4590-847e-ca652e2a3e60` |
| `cc.PageView` | `pageEvents` | `2c0286d3-fca4-4360-9c6b-7fbf1646953c` | `cf426a98-e930-42e8-9680-5958b928a9b9` | `5fe8ea17-a53f-4a11-9b53-504bbd11ee80` | `665e4cd2-e7d5-4330-a050-ef32193333c2` |
| `cc.EditBox` | `editingDidBegan` | `fbbe94e4-2eb3-4385-8813-a26e5207ab20` | `42278276-8ae8-4c14-a896-6a9689d41aac` | `f52d4a3d-879e-4a08-a20e-7e9b01a14a63` | `84854fb1-9b63-445f-a695-1ff207569b0d` |
| `cc.EditBox` | `textChanged` | `fb52f02e-8e83-47f7-bf15-6b023f66bbb8` | `9606e3da-e06b-4a3a-847b-539c672156c1` | `70b3c4d3-4cef-40bf-8f83-236ad2d1e1bc` | `77eb60e6-80bf-491b-8d86-3b7614c1bce0` |
| `cc.EditBox` | `editingDidEnded` | `47bb6f32-b459-4f54-9772-10da6ae515bf` | `0b2b7a6d-b5e3-468c-afd9-9496ab3b9e82` | `a6e8eb08-9f0d-451c-9aee-91c63cde32ce` | `99601f86-4a40-4b3e-8077-d95fc0162797` |
| `cc.EditBox` | `editingReturn` | `af452f24-3486-47ed-910c-3a701a328f5d` | `b8efdc47-a5c2-43ac-ba84-61215939fbd4` | `d91a6311-79be-464b-b10d-193819ff7759` | `200b4e00-3123-4efe-9534-42e17b836057` |

操作日志脚本为 [`cocos-ui-event-lists-20261025.mjs`](../probes/cocos-ui-event-lists-20261025.mjs)。完整 CLI 收据在本机临时日志 `/tmp/cocos-ui-event-lists-20261025.json`；这份仓库记录保留摘要和可追溯 operation ID，不包含重复的大型响应体。Web 运行时请求 ID：Button `e7067c93-fb88-47b0-97fb-56688dbeda73`，Toggle `4c05b07f-67a4-4b80-973d-0587e23f7cc6`；清空后 Button `bcf3204c-2f6f-43d2-b203-20f2d02a8187`。运行时均为 `passed=true`、无新增错误。事件补偿结束后删除临时组件的操作为 `60392ba9-0b5d-431d-9509-c73d063d3771`。

## 本轮 `ui-refresh` 入口烟测

CLI Web Preview 调用 `creator.preview.interact` 的 `ui-refresh`，目标为 `Canvas/CliLayoutTest` 上精确的 `cc.Layout`；Creator 返回 `updateLayout` 已应用、无错误，两个子节点仍为原始 y=`85/45`。这是该动作入口及只读几何观测的一次通过记录，不替代布局模式组合验收。请求 ID `d535eaae-44e4-4d1e-a352-55b6a5095fbc`。
