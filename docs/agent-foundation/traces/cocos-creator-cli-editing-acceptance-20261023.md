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
- 非 Button 的 UI 事件列表目前可检查，但没有对应的事件列表写入合同。
- Prefab 源补丁支持公开、可序列化 Inspector 属性，并绑定类型、组件序号/类/身份、序列化键和前后值；通用属性实机验收目前只覆盖 `cc.BlockInputEvents.enabled`。其他组件和值类型仍需代表性实测；Prefab 组件增删、层级改动、UI 事件列表和 live 组件引用仍未覆盖。
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
