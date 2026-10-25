# Prefab 组件引用编辑闭环验收（2026-10-25）

## 环境与范围

- 工程：Tank，`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15；CLI：0.12.62；扩展：0.8.111
- 仅通过 Cocos CLI/MCP 与 Creator 扩展操作；未用电脑 UI 自动化，未直接编辑 `.prefab` 或 `.meta`。
- Prefab：`db://assets/Button.prefab`，UUID `b657e4bb-78f2-4ba4-b066-600ffb10e4f2`
- 引用字段：`Button/Status` 的 `cc.Slider.handle`，声明类型为 `cc.Button`
- 目标组件：根节点 Button 的 `cc.Button`，稳定 ID `prefab_component_e82fcad3b9715fb929508663`

本轮只验收一个 Prefab 组件引用字段。它不表示所有引用字段、引用数组或组件组合均已通过。

## 修复与提交

空组件引用在 Prefab 序列化文件中为 `null`。扩展 0.8.110 已依据 Inspector 声明恢复空引用类型；0.8.111 补充了 Prefab 组件没有序列化 `_id` 时的合成稳定身份，并在 live 组件实例 ID 与计划使用的 Prefab 稳定 ID 间做精确映射。自动化回归覆盖未序列化组件 ID 的稳定身份读回；CLI 全量测试最终为 371/371 通过。

为取得一个实际 `cc.Slider.handle` 字段，先在 `Button/Status` 通过 `component.structure` 追加 `cc.Slider`：操作 ID `0e99d914-8e7f-4789-9795-bfb76f6c82a2`，计划哈希 `7ad1e573200d3728e85fffa273274b677e23804cc807652993c9fff6a9e41d06`，Prefab SHA-256 从基线 `145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd` 变为 `433dc20ea572fb58854916e01913cb3b55fb1a72742636fb2c09ae526b54daa0`。新增 Slider 稳定 ID 为 `prefab_component_26fff44c61a0d781ba931038`。

首次计划识别出 stable ID 到当前 live `_id` 的映射缺口，没有写入。修复并由 CLI 更新、关闭和重开工程后，扩展 0.8.111 下重新计划和提交成功：

- apply 操作：`11f00e06-a1c9-4b64-a8d3-d8cabafe61be`
- 计划哈希：`4672c120dd4928d10f24d2557db9259853a66de68614cf87d43b97be124e25e7`
- Prefab SHA-256：`433dc20e…b54daa0` → `b70cdde3…a612efea`
- Creator Inspector 读回：`cc.Slider.handle` 指向根 Button 的 `cc.Button`；当前 live 组件 ID 为 `45izFflx9OjZ+M3r9RYrcR`，与计划目标的稳定 ID 对应。

## 补偿、恢复与重开

组件属性来源补偿操作 `d1757f46-92da-4910-b1c5-850231b5f448`（计划哈希 `255125923431cee779ca73931c68b36f81dd1058ed90d457387fe2ed8c20dcff`）后，CLI 读到根 Button 的 y 值意外变为 -70。我们没有把这次状态当作成功恢复：随后用 CLI 精确将根 y 从 -70 设回 0（操作 `c3c4b087-eeb1-469f-876c-fa3bbe0997a4`，计划哈希 `733dd31bb63863de991e8b9e9b45c6467d3adfd1be3768d1781d7c93a1d29737`），Prefab 哈希精确回到组件追加后的 `433dc20e…b54daa0`。

接着对最初的组件追加执行来源补偿：操作 `bcfb9358-e772-40ef-9468-9f1adfcadfb2`，计划哈希 `5c9a7e52c2d35870ff905e1ff2c2359dfb56f0d3d8841fa451a5bd832bafc131`。补偿移除了该操作添加的 Slider，Prefab 哈希精确回到原始 `145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd`，`.meta` 保持 `c926c945705ee5f8ef09f855d8b451392d8744cdb1238a3f8783f7098990a29a`。

最终由 Cocos CLI 关闭工程，确认进程退出，再以同一路径重开，`editorReady=true`。新实例 `cc390865-f101-40be-b44c-2c6d15e7d86c` 的 `creator.project.info` 确认工程路径、Creator 2.4.15、扩展 0.8.111 和活动场景 `CliAcceptanceScene`。重开后的 `creator.prefab.source.inspect` 确认根 Button y=0、Status 只有 Label，Slider 已移除。最终源文件哈希：

| 文件 | SHA-256 |
| --- | --- |
| `assets/Button.prefab` | `145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd` |
| `assets/Button.prefab.meta` | `c926c945705ee5f8ef09f855d8b451392d8744cdb1238a3f8783f7098990a29a` |
| `assets/CliAcceptanceScene.fire` | `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593` |
| `assets/CliAcceptanceScene.fire.meta` | `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba` |

## 验证

- Creator 2.4.15 Inspector：组件引用 apply 读回到精确的根 Button `cc.Button` 实例。
- 来源补偿移除临时 Slider，并在整工程 CLI 关闭/重开后确认结构、根节点位置和源文件哈希恢复。
- CLI 自动化测试：371/371 通过。
- `git diff --check`：通过。
