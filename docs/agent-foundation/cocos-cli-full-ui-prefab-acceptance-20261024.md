# Cocos CLI 代表性 UI Prefab 闭环验收（Creator 2.4.15）

本记录验证一份包含 Button、Label、Widget 与事件的 Prefab 可由 Cocos CLI 创建和编辑，再实例化到场景、关闭并重开工程、预览交互，最后清除临时场景实例。所有 Creator 操作均通过 `tools/cocos-creator-agent-cli/cli.mjs` 完成；未使用桌面 UI 自动化。

## 环境与最终读回

- Creator：2.4.15；扩展：0.8.74；工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`。
- 验收场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。
- Prefab：`assets/Button.prefab`，AssetDB UUID `b657e4bb-78f2-4ba4-b066-600ffb10e4f2`。
- 最终 Prefab SHA-256：`145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd`；`.meta` SHA-256：`c926c945705ee5f8ef09f855d8b451392d8744cdb1238a3f8783f7098990a29a`。
- 最终验收结束后，场景 `.fire` SHA-256 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`，与验收前基线相同。
- CLI 关闭并重开工程后，实例 `03f97dde-9391-4d10-9dd5-83034bc287d8` 的 `creator.project.info` 返回上述绝对路径、Creator 版本和活动场景。随后 `creator.prefab.source.inspect` 返回 `available: true`、相同 Prefab UUID、3 个节点、上述源文件哈希和 `.meta` 哈希。

## CLI 编辑轨迹

1. `creator.prefab.create.plan/commit` 从场景 Button 创建 `assets/Button.prefab`：operation `cbd617e0-9d00-4099-bf32-6aff86c5c17d`，Prefab UUID 为 `b657e4bb-78f2-4ba4-b066-600ffb10e4f2`。首次 CLI 关闭/重开后，CLI 源检查读回 2 个节点、Sprite、Button、自定义状态脚本、Label 和 `clickEvents`。
2. `creator.prefab.source.patch` 为根节点添加 `cc.Widget`：operation `6e867415-524a-4b40-9ec1-8e25a066f63f`。一次包含四个 Widget 字段的组合写入被 Creator 拒绝（`SCENE_COMPONENT_PROPERTY_PRECONDITION_FAILED`）；未把失败写入计为成功。之后单字段计划分别设置左右对齐标志和边距，均逐次关闭/重开并读回。最终 `_alignFlags=40`、`_left=40`、`_right=40`。
3. `creator.prefab.source.patch` 追加 `Status` 子节点：operation `27c665d7-a1a0-4d83-b69f-34de5c3433a2`，节点 UUID `43EYbdw+NJmpYS0BQtf9kb`；追加 `cc.Label`：operation `9dc4b394-7f34-41ea-b968-afe9074097f9`；设置 `Label.string="Ready"`：operation `8b8e4274-0480-47e4-8418-08340072272a`；设置节点 y 为 -70：operation `0e8eadd0-5974-4767-895a-45b5a07c719b`。每项提交后均 CLI 关闭/重开并读回。
4. `creator.scene.compose.plan/commit` 将该 Prefab 实例化到 `Canvas`：operation `892d2147-d4c7-4459-8479-b01a22654c9d`，场景临时根节点 UUID `c3bc4911-521b-4575-ba55-2bcdbe1a9feb`。计划使用完整根 Transform；提交后 CLI 检查确认实例仍链接到 Prefab UUID `b657e4bb-78f2-4ba4-b066-600ffb10e4f2`，子树包含原 Label 和 Status。
5. 关闭并重开工程后，用 `creator.prefab.instance.inspect` 和 `creator.prefab.source.inspect` 读回实例链接、3 节点 Prefab 结构、事件目标与处理函数，以及 `.fire`、`.prefab` 和 `.meta` 文件状态。

## 运行时结果与清理

- `creator.preview.start` 在 Web Preview 启动会话 `8a19e040-67ef-4fcb-9189-8f4acf5cb15e`，尺寸 960×640；启动时错误数为 0。
- `creator.preview.interact` 的点击断言通过：`CliAcceptanceButtonState.clickCount` 预期 6、实际 6；Status 节点存在；无新增 Console 错误。
- `ui-refresh` 调用 Widget 对齐刷新后，根节点宽度断言 880 通过，状态 Label 的 y 为 -70，未新增运行时错误。
- 预览截图中可见原 Button 文本与 `Ready` 状态文本；SpriteFrame 未配置，截图没有 Button 背景图，因此本项不声称验证了有贴图时的视觉样式。
- 通过 `creator.scene.node.delete.plan/commit` 删除临时实例及其两个子节点，operation `643acb8b-1e39-4615-859c-af65f0b680c1`。磁盘读回确认节点不存在，场景 `.fire`/`.meta` 哈希恢复到上面的基线。CLI 停止 Preview 后再关闭、重开工程，并完成最终身份及 Prefab 读回检查。

## 结论边界

这项闭环证明上述代表性 UI Prefab 可通过 CLI 创建、添加内置组件/节点、写入单字段、设置 Button 事件、实例化、重开读回并在 Preview 中交互。组合写入四个 Widget 字段的尝试失败，需维持逐字段写入。Prefab 创建和本次持久化编辑是验收夹具；本记录未对本夹具的每个永久编辑操作逐一执行来源补偿，故不据此扩大“所有 Prefab 字段均已补偿验收”的结论。来源补偿能力的独立已验收范围见 [Prefab 子树验收](cocos-cli-prefab-subtree-acceptance-20261024.md)；后续仍需按矩阵逐字段验证补偿及更多组件、资源引用和 UI 事件。

## 补偿跟进：Label.string

在完整 UI Prefab 闭环后，对同一个精确 Status Label 做了可逆字符串字段验证：CLI 计划并提交 `Ready`→`Ready!`（apply operation `5ff70b0e-e1fe-4376-beb1-5bf8bbebc03d`），Creator 保存回执确认写入并重新打开 Prefab；随后 CLI 计划并提交来源绑定补偿（operation `2987db44-3ffc-4bbe-8ca8-f37ef5072059`，来源 operation 为 `5ff70b0e-e1fe-4376-beb1-5bf8bbebc03d`），将值恢复为 `Ready`。补偿前 SHA-256 `f99ba7be2a8cd748fc65ea4d9842a0560ef9408dd0227c85fbbd7a67e5b4bbfe`，补偿后恢复为 `145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd`；`.meta` 一直为 `c926c945705ee5f8ef09f855d8b451392d8744cdb1238a3f8783f7098990a29a`。整工程 CLI 关闭、重开后，`creator.project.info` 和补偿 operation reconcile 仍返回正确的工程路径、2.4.15 版本、completed 状态及上述哈希。

尝试补偿最初 `Ready` 字段写入 operation `8b8e4274-0480-47e4-8418-08340072272a` 时，reconcile 显示原 apply 已完成且 after 哈希匹配，但 compensate plan 返回 `PREFAB_SOURCE_OPERATION_MISMATCH`；该计划没有写入。新建的同类 apply→compensate 链通过，所以当前证据支持同一 CLI 会话中来源绑定的 Label.string 往返，不把早期 operation 的失败隐藏或归结为字段不支持。

## 2026-10-24 后续：Creator 计算尺寸回写

- 为保存态与 Prefab 编辑态不一致的 Label 尺寸添加了 `node.size.width/height` 精确几何补丁。扩展 0.8.76 首次实机提交被 CLI 主进程的重复前置检查错误拒绝：Creator 端允许“磁盘仍为 before、编辑态已为 after”的几何状态，主进程却只允许编辑态等于 before。扩展 0.8.77 将检查统一到同一精确规则；定向 Prefab 测试 27/27、完整 CLI 测试 352/352 通过。
- Tank / Creator 2.4.15 上的 apply operation `3b112ecc-981a-429f-8d05-668c9c59539e` 将 `Button/Status` 宽度从磁盘 `126.74` 明确写为 Creator 已计算值 `115.63`。Creator 保存回调、Prefab 退出/重开、完整工程 CLI 关闭/重开均确认成功；源哈希为 `145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd`，`.meta` 哈希保持原值 `c926c945705ee5f8ef09f855d8b451392d8744cdb1238a3f8783f7098990a29a`。重开后的磁盘和 Prefab 编辑态宽度均为 `115.63`，根节点几何也保持 `x=480,width=880`。
- 对该尺寸操作的来源补偿 operation `f6cbebef-02e8-4144-a574-2429a8f8fa8e` 暴露了 Creator Label 自动尺寸限制：补偿将磁盘值写回 `126.74`，但重开时 Label 又计算为 `115.63`，导致 operation `needs-reconciliation` / `PREFAB_EXPECTED_STATE_MISMATCH`。没有把它记作补偿通过。随后 operation `4b9ea978-b876-41ce-a7ee-2598319f8f83` 再次保存 Creator 的计算值，完整 CLI 关闭/重开后 Prefab 源哈希恢复到记录基线，工作区 `Button.prefab` 与 `.meta` 均无差异。
- 结论：0.8.77 的几何 after-state 持久化已在此 Label 上实机通过；Label 内容尺寸的来源补偿尚不可靠，不能宣称该类几何写入已完成可逆验收。普通空叶子节点尺寸已单独完成可逆往返，详见下节。不匹配或不稳定的 Label 尺寸补偿应明确拒绝或另行解决。

## 2026-10-24 后续：普通 Prefab 节点尺寸补偿

- 为隔离 Label 自动排版影响，在 Button Prefab 根节点下临时追加无组件叶子 `SizeProbe`（UUID `2cPfO2KVtJHIcGZJhvnGSb`）。插入 operation `6c70aac8-92d0-42a4-a841-5183a511cce0` 完成后关闭并重开整个 Tank 工程，CLI 仍读到相同 Prefab UUID、叶子身份和 `.meta`。
- 尺寸 apply operation `57849654-946d-4d01-bbbe-1962108aa9a4` 将 `SizeProbe` 从 `0×0` 写为 `100×80`；Creator 保存回调、Prefab 退出/重开、整个工程关闭/重开后的磁盘与编辑态读回均通过，源 SHA-256 为 `cfbb93a2c94a406495b7066b16196a46c10e84baea6c4ac35534a660b7d79b34`。
- 来源补偿 operation `32f43e21-c2cd-4a06-b045-e4ee1ada0c2c` 将宽高恢复为 `0×0`，源哈希精确回到插入 `SizeProbe` 后的 `dd257489c081f295456aafd0e34a33e2d2d4bd289ae2b262098ae1d9d1855d41`；整个工程再次关闭/重开，reconcile 为 `completed`，节点宽高、UUID 和 `.meta` 均一致。
- 最后通过来源补偿 operation `2af7dd07-a306-4ef1-b764-1a88a3d6fabc` 删除精确的临时叶子，整工程 CLI 关闭/重开后子节点恢复原有两个（Label、Status），Prefab SHA-256 回到 `145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd`，`.meta` 哈希保持 `c926c945705ee5f8ef09f855d8b451392d8744cdb1238a3f8783f7098990a29a`，场景文件无变化。该项证明普通无组件节点 `node.size.width/height` 的 apply/compensate/reopen 往返；不外推到 Label、Widget 或 Layout 自动控制的尺寸。

## 2026-10-24 后续：Widget 边距补偿回归

- Creator 2.4.15 / Tank / 扩展 0.8.80 上，CLI apply operation `bb7c0829-7135-48a2-b70c-15688e198283` 将根 Widget `left` 从 40 写为 41，保存、Prefab 退出/重开和磁盘读回均确认，源哈希为 `a8d6dbd99c4ffab69c32422492e8b89c2e284cc785ec67247528e4092fabf7d1`。整工程关闭/重开后，磁盘几何为 `x=480,width=880`，Prefab 编辑态 Widget 刷新为 `x=480.5,width=879`。
- 对该 apply 的来源补偿在扩展 0.8.80、0.8.81、0.8.82 下均未通过：CLI 报 `OPERATION_RECONCILIATION_REQUIRED`，reconcile 显示 `PREFAB_EXPECTED_STATE_MISMATCH`，没有 operation 自身的保存读回。未重放失败计划。单独创建的恢复 apply operation `36264fd7-1cd9-4621-8954-69a4f2074c07` 把 `left` 写回 40；Creator 将根几何序列化为 `x=480.5,width=879`。随后几何恢复 operation `885dc96b-60ee-4c2c-bd4e-4316b52ef623` 将其写回 `x=480,width=880`。
- 扩展 0.8.83 收紧来源补偿 reconcile：只有当前文件哈希与该 operation 自己记录的已验证磁盘回执匹配，才确认 after 状态。真实回归 operation `54491d80-7372-4eb1-a2d2-99cd90effe49` 在独立恢复使磁盘最终匹配其 after 值后仍保持 `conflict`，观测到 `diskMatchesAfter=true`、但 operation 自身 `diskReadback=null`。这避免把后来其他操作造成的同值状态误记为原 operation 成功。
- 最终整工程 CLI 关闭/重开并通过扩展 0.8.83 核对：Prefab SHA-256 回到 `145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd`，`.meta` 为 `c926c945705ee5f8ef09f855d8b451392d8744cdb1238a3f8783f7098990a29a`，根几何 `x=480,width=880`，Label 与 Status 子节点 UUID 保持不变。Widget.left 来源补偿仍未验收通过。

## 2026-10-24 后续：Widget.left 来源补偿修复与重验

- 干净 apply operation `5618a9c6-2112-4957-9d29-78f4f30dda1a` 将 Widget `left` 从 40 写为 41，源哈希从基线 `145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd` 变为 `a8d6dbd99c4ffab69c32422492e8b89c2e284cc785ec67247528e4092fabf7d1`。CLI 关闭并重开整个 Tank 工程后，工程路径、Creator 2.4.15、活动场景、Prefab UUID 和源哈希均匹配。
- 失败诊断显示补偿原先先设 `left=40` 再恢复根节点几何，Creator 因 Widget 对齐把 margin 重算为 39。扩展 0.8.86 改为先恢复补偿几何，再读取该精确 Widget 组件当前值；若几何恢复已经产生目标 margin，则直接以最终状态核验，否则再写入目标值。补偿后的 mismatch 诊断也保留了字段 expected/actual。
- 来源补偿 operation `0511de54-99e7-457a-b243-3d1f94a3380b`（source operation `5618a9c6-2112-4957-9d29-78f4f30dda1a`）在 Creator 2.4.15 / 扩展 0.8.86 下完成，CLI 回执确认保存、Prefab 模式退出/重开、目标字段和磁盘读回；Prefab 哈希精确回到 `145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd`，`.meta` 哈希保持 `c926c945705ee5f8ef09f855d8b451392d8744cdb1238a3f8783f7098990a29a`。
- 再次通过 CLI 关闭并重开整个工程，实例 `8fdc0215-2a47-4441-9c9e-93e3fd38a2b6` 的 `creator.project.info` 确认路径 `/Users/youjunmao/WORK/Cocos_Engine/tank`、Creator 2.4.15 和活动场景 `CliAcceptanceScene`；Prefab CLI 源检查确认 UUID、根几何 `x=480,width=880`、上述源与 `.meta` 哈希均回到基线。自动化 Prefab 定向测试 28/28、CLI 全量测试 353/353 通过。
