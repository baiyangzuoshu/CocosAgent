# Creator 2.4.15 CLI 编辑验收（2026-10-23）

## 范围和方法

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`，macOS，Creator **2.4.15**。
- 最终源码版本：CLI **0.12.49**，项目扩展 **0.8.44**。
- 场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。
- 流程：CLI 打开并核对工程身份 → 读取前态 → 审阅计划并提交 → 编辑器与磁盘读回 → 有错误则修复、CLI 关闭重启再验收 → 下一个编辑入口 → 清理与最终回归。
- Creator 操作、工程启停、资源编辑和 Web 预览均通过 `cocos-creator-agent`。未使用电脑操控工具；普通 CLI 源码修复与测试使用文件及终端工具。没有直接改写 `.fire`、`.prefab` 或 `.meta`。

## 已覆盖的编辑入口

下表记录本轮累计实机证据。`completed`、`effect-observed` 和预览断言分别保留各自的证据边界，不互相替代。

| 范围 | 实机结果与代表操作 ID |
| --- | --- |
| 场景组合、节点改名、换父级、启用状态、变换、删除 | 已取得编辑器和保存文件读回；例如组合 `3a96bf12-bcbd-4f89-bb13-59228c035a74`、改名 `e777ebd9-f41c-4b89-be28-c69aa59f6edf`、换父级 `adab37ab-83c7-4d75-b391-f87ee14d269a`、变换 `a333c697-0ea6-4905-af55-9b64737f71ec` |
| 组件添加、移除、属性设置 | 已取得 `completed`；例如添加 `ea9eee0a-7880-406b-89e2-32778863cc58`、移除 `0065b8c8-4bbd-4262-a93a-0d1aec98389f`、属性 `61849284-0e49-4740-b4a4-930caab2f753` |
| UI 组件 | 验收场景保留 Canvas、Widget、Layout、Sprite、Label、Button、Toggle、ToggleContainer、Slider、ProgressBar、ScrollView、Scrollbar、PageView、PageViewIndicator、EditBox、RichText、Mask、BlockInputEvents；覆盖创建/挂载、读取与代表属性编辑 |
| Button 事件接线 | `177bcde6-c9d7-45fc-ae7d-0a2b6f2c8090`，最终预览点击使业务组件 `clickCount` 从 5 变为 6 |
| Prefab 创建、实例化、Apply/Revert | Creator 创建及实例读回通过；实例覆盖操作取得 `effect-observed`，例如 `70e74797-8e7c-481a-b6b5-8b27413180a0`。该状态证明观察到保存文件变化，不声称逐字段覆盖等价 |
| 受限 Prefab 源编辑 | 本次补齐实机链路；根节点 `node.position.x` 的 apply、compensate、replay 均完成原生保存回调、文件读回、退出、重开、实时读回和最终退出 |
| AssetDB 导入、移动、纹理设置、删除 | 已完成；例如导入 `5f9e5a57-5f11-42eb-9430-fb7dd048a25c`、移动 `516e3635-bc47-4ba7-b98d-24f4d204edd3`、设置 `4b703ba5-b654-428b-91c1-d7582b265926`；删除临时资源前要求完整无引用扫描 |
| 脚本创建、修改、重新编译 | 已完成；例如创建 `be77dbce-ba7e-402b-aaa7-1142bd9634da`、修改 `8a81087c-4090-468d-a4e3-145bd14a03db`、重编译 `e8578de9-b7b5-4a34-9e4b-6a720600d28b` |
| `editor.eval`、`eval-file` | 临时对象修改和原操作结果核对通过；例如 inline `0807e43b-efd0-475d-beca-1d5387a36717`。临时文件脚本验收后已移除；执行结果不自动证明任意脚本的持久化效果 |
| 项目扩展 Provider | 临时 Provider 的 read/plan/write/control 实机调用和读回通过；write/control 修改临时模块状态，恢复后删除 Provider，再通过 CLI 重启确认移除 |

## 本次修复

1. **PageView 预览断言**：`direction` 由原型访问器和 `_N$direction` 存储，原读取器返回 null。增加受限存储字段读取，保持不调用任意访问器；真实预览断言通过。
2. **Prefab 动态能力**：Creator 主进程 `Editor.Ipc` 没有 `.on`。改用 `Editor.IpcListener` 接收 Creator 广播；桥接在认证轮询中校验并更新动态能力，修复加载完成后仍显示不可用的问题。
3. **Prefab 根节点身份**：Creator 新建 Prefab 的根节点 `_id`、`fileId` 可以为空。源码检查返回 `identityKind: prefab-root` 和 `prefab_root_<prefabUuid>`；编辑器中只解析为同一精确资源关联的唯一根节点，继续核对路径、源哈希和前后值，不生成序列化 UUID。
4. **Prefab 模式时序**：实机进入 Prefab 模式没有发出预期的 `scene:ready`。进入/退出改为有界读取精确模式及目标 Prefab/原场景身份，不重发变更命令。
5. **Prefab 保存与退出**：通用编辑模式保存包装器在实际文件保存后仍等待额外场景暂存回调。改用当前 Prefab 模式的原生 `save`，并要求精确源文件和 `.meta` 读回。退出检查原生 dirty 状态，仅关闭干净的 Prefab，明确传入关闭结果，避免原生确认框。

原生 Prefab 保存没有保证通用 `scene:saved` 通知。本次三个成功回执均如实返回 `sceneSavedEventConfirmed: false`；原生回调、磁盘持久化和重开检查均为 true。不会把事件缺失伪装为已收到。

## Prefab 源编辑实机回执

临时资源 UUID：`79cc8508-1d5f-4973-a5c8-94550e373fcf`，路径 `db://assets/CliPrefabPatchAcceptance.prefab`。

| 操作 | Operation ID | 根节点 x | 结果 |
| --- | --- | --- | --- |
| apply | `37a1a192-ec27-485e-8bac-8b467c1611ab` | 361 → 360 | completed |
| compensate | `7429324b-dafe-4e08-bcd7-6c5a755c448e` | 360 → 361 | completed |
| replay | `638d83a4-010a-4d7b-b123-3a7d17408f1b` | 361 → 360 | completed |

三个操作均确认 `saveCallbackConfirmed`、`editorExitedToScene`、`editorReopened`、`editorExitedAfterReopen`、`diskReadback.verified`。

- x=360 源 SHA-256：`254a77364bd1bcc8526f5c06059c804a664d3ad2087d29be0e1c2d1735810346`。
- x=361 源 SHA-256：`2c48ca1209c89d2960f45eeb8c90660d44951100d7b4b120d2cdc0c03b81a28b`。
- `.meta` SHA-256 始终为 `e930406dc043707a968c63147fde2509b0165b747366f48bef851f2f81e2dced`。

修复前的事件超时操作通过原 ID 核对为未应用；旧保存包装器操作 `d840e8c6-0fdc-4697-96a8-ab4adbd657c4` 读回证明文件已保存为 x=361，但原回执缺少完整完成证据，保留历史不确定状态。没有重放该操作；后续通过新的明确计划恢复并验收，最终清理临时资源。

## 清理与最终回归

- 临时节点删除：`c8fb09c8-248d-4047-9e0f-4027ca3b1a3b`，保存场景确认目标 UUID 不存在。
- 临时 Prefab 删除前扫描：`complete: true`、`referenceCount: 0`、`binaryFiles: 0`。
- AssetDB 删除：`ca5a78a6-9f15-4a88-a374-f5b617c8fc07`，文件、`.meta`、AssetDB 记录均不存在。
- 临时 Provider 和 `CliEvalFileAcceptance.js` 均不存在。
- 最终 CLI 关闭并重开；实例 `57e22aa5-754d-4960-b091-3c3a07586ff0`，仍是同一路径的 tank / Creator 2.4.15 / 扩展 0.8.44。
- 最终场景快照：**23 个节点**，未截断；保留 Button、Label 和 UI 验收夹具，以及原有 `CliBlockInputEventsTest.prefab`。
- 最终扩展状态：`matchesBundle: true`、`changedFiles: []`、`reloadRequired: false`。
- 完整自动化测试：**316/316 通过，0 失败**。日志位于 `/private/tmp/cocos-cli-editing-final-test.tap`。
- 最终真实预览会话 `76538f9c-3146-4753-af3a-c379ee8be3de`：7 项断言全部通过，包含场景身份、Button 点击计数 6、Label 文本 `CLI Label Validated`、Label 尺寸 300×60、PageView.direction=1 和无运行错误。
- CLI 自有预览已停止；Creator 自身的预览服务器未由该停止命令关闭。Tank 编辑器保留打开。

## 剩余能力边界

- 这轮覆盖当前支持的编辑入口及代表字段，不等于穷举 Creator 所有面板、每个组件字段或每种交互业务行为。
- 非 Button 的 UI 事件列表已有受限写入合同，但尚无 Creator 2.4.15 实机写入证据；目前只实测了 Prefab Button `clickEvents`。
- Prefab 源补丁支持公开、可序列化 Inspector 属性，并绑定类型、组件序号/类/身份、序列化键和前后值；通用属性实机验收目前覆盖 `cc.BlockInputEvents.enabled`、`cc.Label.fontSize` 与 Button `clickEvents`。其他组件和值类型仍需代表性实测；Prefab 单个内置组件追加及其来源绑定补偿删除、受限层级改动已有代表性实机记录；既有组件直接删除、用户脚本组件创建和 live 组件引用仍未覆盖。
- 项目工具别名注册表未配置；临时 Provider 验收不等于项目已有业务工具已接入。
- `editor.eval` / Provider 属于 Editor 权限入口；临时测试成功不能证明任意用户代码都安全或已持久化。
- 当前验收仅针对上述 Creator 2.4.15/macOS 工程，不外推到 Creator 3.8、其他工程或其他平台。

## 2026-10-24 后续：Prefab Inspector 属性编辑

- CLI **0.12.55** / Creator 扩展 **0.8.55**；工程仍为 tank / Creator 2.4.15。打开、关闭、Prefab 进入/退出、属性读取写入均通过 Cocos CLI 完成；没有使用电脑操控工具，也没有直接编辑 `.prefab`/`.meta`。
- 目标 Prefab：UUID `21119a83-ebeb-4542-bd8b-b477c2b1f2f5`，`CliBlockInputEventsTest.prefab`；根节点使用 `prefab_root_21119a83-ebeb-4542-bd8b-b477c2b1f2f5`，空组件 `_id` 使用稳定合成 ID `prefab_component_758cfd9a1548968e02295ec4`。
- 只读 Inspector 检查确认 `cc.BlockInputEvents.enabled=true`，可编辑，序列化键为 `_enabled`。
- apply `f18db245-017d-425e-b2f8-90ff695d6e84`：`true → false`；compensate `87234cb6-4406-4fff-a088-f749676b58da`：`false → true`。两次均确认 `saveCallbackConfirmed`、Prefab 退出、重开、重开后读回及 `diskReadback.verified`。
- 源哈希由 `189d2ed73c6e021ee48a52fda6bab30c60345cc35bfdbfc3458d062ccb5e9200` 变为 `42ff513d6c358cfe3e493beee4bc0e16db95b661d2572fb50bf7dd23b327760a`，补偿后回到原始哈希；`.meta` 哈希始终为 `ab6b5fa05f91d463f8a612129bc734a188aedd18e4f33ff4afd52f8157643821`。最终只读 Inspector 再次确认 enabled 为 true。
- 本次修复还让补偿/重放计划重新读取动态组件属性，并允许 Prefab 编辑场景路径在稳定 Prefab 节点路径前带有 Creator 临时根路径。
- 修复后的 CLI 完整自动化测试：**327/327 通过，0 失败**；第一次沙箱内运行因三个本机回环监听用例遇到 `EPERM`，在获准绑定 `127.0.0.1` 后完整重跑通过。

### 2026-10-24 后续：Label 属性、数组边界与恢复核验

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`；Creator **2.4.15**、CLI **0.12.55**、扩展 **0.8.55**。核对项目身份、打开/关闭 Creator、Prefab 模式读写、重开和检查均通过 Cocos CLI；未使用电脑操控，也未直接改写 `.prefab` 或 `.meta`。
- 使用 CLI 从场景临时创建 Prefab `CliLabelTest.prefab`（UUID `d41a7239-1569-431c-8960-69a4ae6827ac`），用于隔离测试；源文件/元数据初始 SHA-256 分别为 `615dcb2317cddf78d846ac581099bd90c53b837d4fea79e4ac99c9f390315aba` 和 `50c5d6cd8176561e32519923133a8b9870a8a9ba8a2b34d6c31b91b865d479d8`。
- `cc.Label.fontSize` 实机往返通过：apply 提交任务 `b3903d81-2afc-4c46-b41e-6cef2d0899c3` 将 `32 → 34`；compensate 提交任务 `52cf0dce-8f15-4aa9-97fa-fb2a4ac1ca96` 将 `34 → 32`。两轮均收到保存回调，退出 Prefab、通过 CLI 重开同一 UUID、读回字段并最终退出；补偿后源 SHA-256 精确恢复为初始值，`.meta` 哈希未变。
- 数组失败边界：Creator Inspector 报告 `cc.Label.materials` 为 Material 数组。`[Material UUID eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432] → []` 通过 CLI 合同和计划校验，但 commit 后 Creator 组件属性读回报 `SCENE_COMPONENT_PROPERTY_READBACK_FAILED`。通过 reconcile 判定 `not-applied`，磁盘 `.prefab` 与 `.meta` 哈希均保持初始值；CLI 随后关闭并重开工程确认正常。结论只限定于这个空数组写入，不外推所有 Material 数组值。
- 清理临时资源前由 AssetDB 扫描确认引用数为 0，随后通过 CLI AssetDB 删除操作 `7861f237-86c7-42ab-9cb3-5fd9fd6e82db` 删除 Prefab；文件、`.meta` 和 AssetDB 记录均已确认不存在。
- 补齐了 reconciliation 对磁盘仍为 before 时的实时状态分类：Prefab 仍打开且 live 值为 after 时保留 `needs-reconciliation`，live 值冲突时标记 `conflict`，仅在场景模式或 live before 时报告 `not-applied`，并在回执中保留原始失败原因。包版本升至 **0.8.56** 后，CLI 执行扩展更新并重开工程，握手确认 Creator 2.4.15 / 扩展 0.8.56，项目路径和活动场景一致。
- 自动化定向测试 **16/16 通过**；完整 CLI 自动化测试 **329/329 通过，0 失败**。

### 2026-10-24 后续：Prefab UI 事件列表写入

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`；CLI **0.12.55**、Creator **2.4.15**、扩展 **0.8.59**。扩展更新、旧进程关闭、重开及项目身份核对均由 Cocos CLI 完成；没有使用电脑操控工具，也没有直接编辑 `.prefab`、`.fire` 或 `.meta`。
- 为隔离测试，通过 CLI 组合出临时 Button 节点 `11379331-0b99-4358-90d9-2c978a92f52e`，添加 `cc.Sprite`、`cc.Button` 与现有 `CliAcceptanceButtonState` 脚本，再由 Creator Scene 面板创建 Prefab。创建操作分别为组合 `22575796-b526-4da1-b306-ad98c025571e` 和 Prefab 创建 `1c958cba-a2af-42f5-bdae-ba84aab01176`。Prefab UUID 为 `00b0da27-df78-4b9a-80ee-8dcabf818f78`，根节点稳定身份为 `prefab_root_00b0da27-df78-4b9a-80ee-8dcabf818f78`；Button 组件身份为 `prefab_component_3baaa7f90ce4bfa1fa1eff92`。
- `creator.prefab.source.editable.inspect` 首次发现自定义脚本的序列化 UUID 与运行时类名被旧身份核对误判。扩展增加 Creator 序列化类 ID 回传后，0.8.59 实机读回成功：磁盘 UUID `06c42enFbFEiYNCYZ2M0Azh` 与 Inspector 运行时类名 `CliAcceptanceButtonState` 正确对应。
- apply `a4d4b95f-c4d9-4dd6-8afe-548b59403cbf`：在 `cc.Button.clickEvents` 写入一个目标为同一 Prefab 根节点、组件为 `CliAcceptanceButtonState`、handler 为 `onClick` 的事件。Creator 保存回调、退出 Prefab、重新打开同一 Prefab、活动对象读回和磁盘读回均成功；事件新增后源 SHA-256 为 `b5de6cf635914478fcdc811b79ee60647ebc02a2e157f744e627ae52ed82f1e1`。
- source-linked compensate `76f60c55-2d35-4376-97d4-e175e868664a`：从已完成 apply 派生逆向操作，将事件列表恢复为空。所有保存、退出、重开和磁盘读回再次成功，Prefab 源 SHA-256 精确回到 `b6f9bbea3dd15bea321c85889171636423e2cffecbbae0d6e186bc5c85e630ae`；`.meta` SHA-256 始终为 `7d1537dab2cbfb51cff9e04c207bdf754e4ef62d122924d3ca4d127bdb0b4876`。两份 Prefab 回执中的 `sceneSavedEventConfirmed` 均为 false；Creator 原生保存回调、文件读回和 Prefab 退出/重开字段均为 true。
- 临时 Prefab 删除前的完整 AssetDB 引用扫描 `complete: true`、`referenceCount: 0`。AssetDB 删除 `47218fed-c5d6-4abf-bf63-422ce9110af9` 后，Prefab 文件、`.meta` 和 AssetDB 记录均不存在；临时场景节点删除 `d33eb480-1225-4983-bed2-d8daa551e21b` 后确认节点 UUID 已从保存场景移除。场景源 SHA-256 回到组合前的 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，场景 `.meta` 哈希未变。
- 本验收证明 Button `clickEvents` 可以通过 Prefab patch 写入及补偿，并完成 Creator 与磁盘读回；没有运行游戏并点击此临时按钮，因此不作为运行时点击派发证据。Toggle、Slider、ScrollView、PageView、EditBox 等其他事件字段仍需分别代表性实测。
- 最终扩展状态为 `matchesBundle: true`、`changedFiles: []`、`reloadRequired: false`；项目身份仍是 Tank / Creator 2.4.15 / 扩展 0.8.59，活动场景 UUID 未变。临时资源与节点均已清理，场景回到 23 个节点。完整 CLI 自动化测试：**332/332 通过，0 失败**。

### 2026-10-24 后续：Prefab 同父级节点重排

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`；CLI **0.12.55**、Creator **2.4.15**、扩展 **0.8.63**。扩展更新、关闭旧编辑器、重开和工程路径/版本核对均通过 Cocos CLI；未使用电脑操控，也未手工改写 Prefab、场景或 `.meta` 文件。
- 为隔离验收，使用 CLI 在 `CliAcceptanceScene` 创建三节点测试子树，并由 Creator CLI 创建 Prefab `CliSiblingOrderAcceptance.prefab`（UUID `2dd89c45-b087-4ae4-998e-c45cedd5fe88`）。原始源 SHA-256 为 `d1ee6bccb4af94646f06479606ce0cd94929568efcff8227d9be611b15b6af2c`，`.meta` SHA-256 为 `428b028e82609f340adc86543535ceb6790367cd6425708415fcedc875fdce7d`。子节点 `First` 的稳定 Prefab ID 为 `00CvaywaBJDIgC+Cs8mlOm`，`Second` 为 `9dUwIWcSZMkLUN1GIUe00J`，共同父级为 `prefab_root_2dd89c45-b087-4ae4-998e-c45cedd5fe88`。
- Prefab 编辑模式只读检查观察到 `First` 的运行时 UUID 与序列化 `fileId` 不同；扩展按稳定 `PrefabInfo.fileId` 定位节点，并在实时快照中分别保留稳定 ID 与运行时 UUID。计划绑定精确 Prefab、节点路径、父级 UUID、原索引 0、新索引 1 和原源哈希。
- apply `83845930-5046-484c-9ac5-402d32d7e359`：`First.siblingIndex` 从 0 改到 1。Creator 回执为 `completed`，确认 `saveCallbackConfirmed`、`editorExitedToScene`、`editorReopened`、`editorExitedAfterReopen` 和 `diskReadback.verified`；重开后的源 SHA-256 为 `8a18efa04923f07c99a1c7279e4db078987d571b35923b232a145f6edab166d3`。随后 `creator.prefab.source.inspect` 从保存源读回 `Second=0`、`First=1`、兄弟数均为 2。
- source-linked compensate `06446318-cd36-414f-ac1b-5b7c75058083`：从完成的 apply 派生逆操作，将 `First.siblingIndex` 从 1 恢复为 0。保存、退出、重开、读回均通过，源 SHA-256 精确恢复为 `d1ee6bccb4af94646f06479606ce0cd94929568efcff8227d9be611b15b6af2c`，`.meta` 哈希保持不变。两个回执均如实记录 `sceneSavedEventConfirmed: false`，但 Creator 原生保存回调和磁盘/重开读回确认通过。
- 清理时通过 CLI 删除测试场景子树 `a99194d9-4e5c-419f-b770-978000bf7c8d`，保存场景哈希回到基线 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 仍为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。删除 Prefab 前 AssetDB 引用扫描完整且为 0；删除操作 `3831cfdd-c789-4188-8e36-95fcd018f636` 后，Prefab 文件、`.meta` 与 AssetDB 记录均不存在。最终 CLI 场景快照为 **23 个节点**，临时资产搜索返回 0 项。
- 完整 CLI 自动化测试 **335/335 通过，0 失败**；普通沙箱运行的三个本机回环监听测试因 `EPERM` 失败，随后在获准绑定 `127.0.0.1` 的测试环境完整重跑通过。最终扩展状态为 `matchesBundle: true`、`changedFiles: []`、`reloadRequired: false`。

### 2026-10-24 后续：Prefab 节点换父级

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`；CLI **0.12.55**、Creator **2.4.15**、扩展 **0.8.65**。通过 Cocos CLI 核对工程路径、Creator 安装和版本，使用 CLI 更新扩展并关闭/重开工程；握手确认同一 Tank 工程已加载 0.8.65。未使用 CUA，也未直接改写 Prefab、场景或 `.meta` 文件。
- 使用 CLI 在 `CliAcceptanceScene` 创建临时层级并生成 Prefab `CliReparentAcceptance.prefab`（UUID `1b59bce4-c2f4-4706-a7d3-c3be8d89fa9b`）。初始源 SHA-256 为 `9e46649303ea5f1f8701c72af5119979a559f6a238808b9aafe3e68958a0eea7`，`.meta` SHA-256 为 `60114a647ea3fbb56ba10ed16309af265e15e4556e23ab0301f642fd1c2f0846`。目标 `Mover` 稳定 ID 为 `95FOHn1slBQIGfF8/xsTyA`；原父级 `Source` ID 为 `d22nflpeBBw5plO9xs4PiT`，目标父级 `Target` ID 为 `33EICnzLdBIZA/+8Ng8SOd`。
- apply 操作 `fc622169-ed74-4942-b155-62bc27e082d6` 将 `Mover` 从 `CliReparentAcceptance/Source` 第 0 位移动到 `CliReparentAcceptance/Target` 第 1 位。Creator 回执确认保存回调、退出 Prefab、重开同一 Prefab、再次退出和磁盘读回；保存后源 SHA-256 为 `2e69aa76b69ecc7c1930db346f0d45a011dddd6945cc416348f921959e07c91a`，同一节点 ID 位于目标路径。
- source-linked compensate 操作 `6756b599-4288-4204-a2e4-2097f953e95f` 从已完成 apply 派生逆操作。保存、退出、重开和读回再次通过，源 SHA-256 精确恢复为初始值，`.meta` 哈希保持不变。两次 Creator 回执均记录 `sceneSavedEventConfirmed: false`；原生保存回调、Prefab 退出/重开及精确磁盘读回均已确认。
- 清理时通过 CLI 删除临时场景子树操作 `96c388ba-b25e-4125-ad99-e46d480f3759`；保存场景 SHA-256 恢复到基线 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，场景 `.meta` 哈希仍为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。完整 AssetDB 引用扫描为 0 后，以删除操作 `458b3ab8-4dff-4baa-b99e-42bca2bf2899` 移除临时 Prefab；文件、`.meta` 与 AssetDB 记录均确认不存在。最终场景为 **23 个节点**，资产搜索返回 0 项。
- 定向 Prefab patch 测试 **20/20 通过**，完整 CLI 自动化测试 **337/337 通过**。

### 2026-10-24 后续：Prefab 空叶子子节点增删

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`；CLI **0.12.55**、Creator **2.4.15**、扩展 **0.8.66**。工程路径、Creator 版本和实例身份通过 Cocos CLI 核对；Prefab 模式打开/保存/退出/重开均通过 CLI。没有使用电脑操控工具，也没有直接改写 Prefab、场景或 `.meta` 文件。
- 测试 Prefab `CliPrefabChildAcceptance.prefab`，UUID `45a55c1d-b0ed-4bf2-a454-4eaaa169c0ca`，根节点 `prefab_root_45a55c1d-b0ed-4bf2-a454-4eaaa169c0ca`。原有空叶子 `Original` 稳定 ID 为 `29gy/clllMCpgoLOsowKdz`。初始源 SHA-256 为 `e8da097e8fc1f9fbdb44836f748d56a7775a6268f6b80e0546764b73a7973dff`，`.meta` SHA-256 为 `38ed07c450f014cf1b996622c4a006af6f403c1bd8abfa7dabdaa2de45ac4680`。
- apply `911a6526-0eb4-42ea-a54b-1825ec71703f` 在根节点末尾新增空叶子 `Added`，稳定 ID `e6+OQtw7FA6rml6y12MM+P`。Creator 保存回调确认；退出 Prefab、重开同 UUID、再次退出和精确磁盘读回均通过。保存源 SHA-256 为 `0c06bf8de6e89992959de0c3b37e34a0784828217f59c117dc06b0ea547dd8cd`。回执如实保留 `sceneSavedEventConfirmed: false`，不影响原生保存回调及源文件读回证据。
- source-linked compensate `d1ca9ba7-5134-48c1-b2fe-c536339c1638` 从已完成 apply 派生逆操作，移除该空叶子。Creator 保存、退出、重开、再退出和磁盘读回均通过；源 SHA-256 精确回到初始值，Prefab UUID 未变，`.meta` 哈希保持不变。
- 清理临时场景节点 `27e20dc1-aaf1-40f8-9559-b51caf7dad09` 后，场景源 SHA-256 精确恢复为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，场景 `.meta` 哈希仍为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。Prefab 删除前 AssetDB 文本引用扫描完整（8 个文件，41,485 字节），引用数为 0；删除提交被自动审批拒绝，因此测试 Prefab 文件及 `.meta` 仍留在 Tank `assets/`，不声称已清理。
- 定向 Prefab patch 测试 **22/22 通过**；完整 CLI 自动化测试 **339/339 通过**。截至扩展 0.8.66，本记录只覆盖一次增/删一个无组件、无后代的叶子子节点；非叶子子树编辑和 Prefab 组件增删当时仍未开放。后续组件能力见本页 0.8.69 验收记录。


### 2026-10-24 后续：Prefab 内置组件追加与补偿删除

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`；CLI **0.12.55**、Creator **2.4.15**、扩展 **0.8.69**。通过 Cocos CLI 更新扩展、关闭/重开工程并核对项目名、绝对路径、版本与实例握手；Prefab 检查、计划、提交、退出/重开与读回均通过 CLI 完成，没有使用电脑操控，也没有直接编辑 `.prefab` 或 `.meta`。
- 使用隔离验收资源 `CliPrefabChildAcceptance.prefab`，UUID `45a55c1d-b0ed-4bf2-a454-4eaaa169c0ca`；目标根稳定身份 `prefab_root_45a55c1d-b0ed-4bf2-a454-4eaaa169c0ca`。基线源 SHA-256 为 `e8da097e8fc1f9fbdb44836f748d56a7775a6268f6b80e0546764b73a7973dff`，`.meta` SHA-256 为 `38ed07c450f014cf1b996622c4a006af6f403c1bd8abfa7dabdaa2de45ac4680`。
- `component.structure` 一次追加一个 Creator 注册的内置 `cc.*` 组件。实机 apply `857a297f-dea5-4b18-af77-cb508c726747` 在 Prefab 根节点添加 `cc.BlockInputEvents`，计划绑定稳定合成组件 ID `prefab_component_c929bfe51effd84eca966b40`；回执 `completed`，保存回调、退出 Prefab、重开同 UUID、活动对象与磁盘读回全部确认通过，源哈希变为 `6acf6de0f77cdbb1dd866b59d08d745504539cb257136b7e45df07547e85e456`。
- source-linked compensate `4b04438e-18e9-4ca9-a402-6f9f71b1021b` 从上述 apply 派生，只删除该次添加的精确组件。Creator 保存回调、退出/重开与磁盘读回均通过，源 SHA-256 精确恢复至基线，Prefab UUID 与 `.meta` 哈希不变。两次正常回执均 `sceneSavedEventConfirmed: false`，不影响保存回调和磁盘读回证据。
- 第一次验收发现序列化没有保存运行时 `_id`：磁盘为同一索引/类生成 `prefab_component_c929bfe51effd84eca966b40` 合成身份；计划阶段生成随机 ID 会造成写后读回冲突。另一次补偿遇到组件已在延迟销毁队列时 `destroy()` 返回 `false`。扩展 0.8.69 改为计划时生成与序列化一致的稳定 ID、以 Creator 的延迟销毁状态识别已经排队的删除，并以完成后的读回来确认。第一次不确定写入已通过 CLI reconcile 分类；未重发该写入，后续从已完成操作派生补偿并将 Prefab 恢复基线。完整有效往返由 0.8.69 下的 apply/compensate 回执验证。
- 定向 Prefab patch 测试 **25/25 通过**。完整 CLI 自动化测试 **342/342 通过，0 失败**。

### 2026-10-24 后续：Prefab 无组件子树插入与补偿删除

- Tank `/Users/youjunmao/WORK/Cocos_Engine/tank`，CLI **0.12.55**、Creator **2.4.15**、扩展 **0.8.70**。通过 Cocos CLI 核对项目名、路径、版本并更新扩展、关闭旧实例、重开工程；全流程使用 Cocos CLI，没有使用电脑操控或直接编辑 Prefab 源文件。
- 在同一隔离 Prefab `CliPrefabChildAcceptance.prefab`（UUID `45a55c1d-b0ed-4bf2-a454-4eaaa169c0ca`）根节点插入两节点无组件子树 `Branch/Caption`。apply `f415b6f9-7dd0-456a-a425-83aef8427d09` 由计划阶段为两个节点生成稳定身份；Creator 保存回调、退出 Prefab、重开同 UUID、退出、实时对象及磁盘读回全部通过。源 SHA-256 从 `e8da097e8fc1f9fbdb44836f748d56a7775a6268f6b80e0546764b73a7973dff` 变为 `a046c7cdab082df9122355286ef9f49972686fe7e82ebd3bde2fbfae7d00498d`，`.meta` SHA-256 保持 `38ed07c450f014cf1b996622c4a006af6f403c1bd8abfa7dabdaa2de45ac4680`。
- source-linked compensate `4ff6b199-9c4e-4d22-bf05-1e51e9e1d5ff` 仅移除上述操作新增的整棵子树。保存、退出/重开和读回均通过，源 SHA-256 精确恢复至基线，Prefab UUID 与 `.meta` 哈希不变。正常回执的 `sceneSavedEventConfirmed` 为 false；Creator 保存回调与文件读回通过。
- `node.subtree` 单次限制为最多 16 个无组件节点、最大深度 4；插入身份在计划阶段生成，移除仅能由已完成的来源操作派生补偿。定向 Prefab patch 测试 **26/26 通过**，完整 CLI 自动化测试 **343/343 通过，0 失败**。沙箱内首次全量测试有 3 项因本机回环监听 `EPERM` 失败，提升权限后全量复测通过。
