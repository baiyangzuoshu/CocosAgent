# Creator 2.4.15 现有 JavaScript 编辑合同 0.1

日期：2026-10-11。状态：**实现与模拟测试完成；Creator 原生面板已验证脚本写入、编译对账和补偿；实际浏览器点击与恢复后点击已验证。原生新 ID 重放及真实错误修复仍待做。**

## 任务与依据

首个任务是为已有按钮补点击逻辑，修改明确指定的现有组件脚本。官方依据：[组件脚本](https://docs.cocos.com/creator/2.4/manual/zh/scripting/use-component.html)、[Button](https://docs.cocos.com/creator/2.4/manual/zh/components/button.html)、[IPC 消息](https://docs.cocos.com/creator/2.4/manual/zh/extension/reference/ipc-reference.html)。不能把资源刷新回调当作功能成功。

## 命令

| 命令 | 访问 | 输入与结果 |
| --- | --- | --- |
| `script.read` | read | assets 相对 `.js` 路径；返回源正文、UUID、源和元数据 SHA-256 |
| `script.patch.plan` | read | 路径、UUID、预期源哈希、1–8 个唯一 before/after 替换；返回差异、候选哈希及语法检查 |
| `script.patch` | write | apply/compensate/reconcile/replay；操作 UUID 与动作专属输入；写入、编译回执和恢复状态 |
| `script.operation.get` | read | 原操作 UUID；只读账本摘要与当前磁盘身份，不暴露备份全文 |

MCP 提供同名含义的 `cocos_2x_script_*` 工具；仍校验注册工程、Creator 实例、版本、能力合同与写入审批。路径限 assets 下已有 UTF-8 JS（最多 64 KiB），拒绝目录穿越与符号链接。修改保留元数据；UUID 或源哈希陈旧、替换不唯一、语法错误在写前拒绝。

## 编译与恢复

写前记录原文、候选文、哈希和意图至 `.cocos-agent/script-operations/`；写后刷新精确资源 URL，并核对源文件、元数据、AssetDB UUID、quick-scripts 精确源路径/正文与编译产物：优先核对新鲜目的产物的唯一内联 source map、src/dst 语法及正文；无内联 map 时沿用独立 source map 和目标编译 stats 校验。有内联 map 但不匹配时不能回退为成功。quick-scripts 是本版本本地观察到的产物，并非公开稳定编译 API；产物缺失或不匹配不得判为编译通过。已知 `asset-db:script-import-failed` 进入有限诊断，不宣称覆盖全部 Console 错误。

成功编译后为 `needs-runtime`，不宣称按钮功能通过。导入失败可能已写入源文件，返回确认副作用和原操作 ID；超时或失联为 `needs-review`，禁止重复 apply。查询后按原记录 reconcile 或 compensate；后续人工修改造成冲突时拒绝覆盖。重放使用新 ID，并要求原记录已补偿。

产品 skill：`plugins/cocos-agent-2x/skills/cocos2-script-development/SKILL.md`。实现：扩展 `script-operations.js`，Host `script-contract.js`（镜像一致性测试）、`script-host.js`、`agent-dispatch.js` 和 MCP 调度器。

## 证据与剩余项

模拟测试覆盖身份/路径/语法拒绝、编译产物匹配、重复 ID、补偿冲突、新 ID 重放、编译超时和已知导入失败。真实 Creator 内打包的 MCP runtime 已查询实例、能力并只读取得 `Script/HelloWorld.js`：UUID `280c3aec-6492-4a9d-9f51-a9b00b570b4a`，源 SHA-256 `5d489ee56ff2397f74895df229a0ab06f7b74ed10ef57333d127be4e4120bb22`；原始回执位于本机临时验收文件 `/private/tmp/cocos-agent-script-smoke.jsonl`，未将源码全文复制至发布轨迹。

上述只读证据不是原生面板模型写入验收；本轮新增原生写入、编译对账、实际点击与补偿证据见下节。仍需补原生新 ID 重放、真实错误注入与有界修复。临时 Button 场景夹具不作为产品成果提交。

暂不覆盖新建脚本、TypeScript、多文件重构、自动场景事件绑定、自动点击、完整 Console 历史、原生或 3.x。Creator 2.4.15 Web 的有界日志、帧状态、目标节点和截图观察另见[运行观察合同](cocos-agent-runtime-observation-0.1.md)；它不替代输入测试，真实错误注入、修复和二次观察仍待实机验收。

## 2026-10-11 按钮任务续验准备

实机只读 MCP 已核对扩展 0.3.4 / MCP 0.3.3 的合同匹配，读取同一脚本并检查 `helloworld/NativeScriptButton`。该节点 UUID 为 `9dxNsRWIhN9rTnptzzYKFX`，包含 `cc.Button`，实际为场景根节点，位置 `(0,-200)`；不能按 Canvas 子节点坐标推断它可点击。拟以独立节点补丁将其移至根坐标 `(480,120)`，预览确认后再测试输入，最后按原节点操作补偿。

脚本拟议差异为两处唯一替换：初始化时查找该按钮并绑定 `click`；处理函数增加计数、将现有 Label 更新为 `Clicked: N` 并写日志，组件销毁时解绑。现有内容运行时连接和释放逻辑保留。`script.patch.plan` 返回 `syntax=parsed-only`、`compilation=not-run`、`runtime=not-run`，候选 SHA-256 为 `39387766e37b9539fd31d0d910e6f42e2ce6702d7acb3400efb3fe6d1f2bca76`。这只是外部 MCP 的只读准备，原生模型必须在当前工程重新读取 skill、脚本与场景，形成并展示差异。

续验顺序：原生面板审阅/批准精确差异 → 新 ID apply → 原账本与源码/编译读回 → 刷新同一场景预览 → 实际点击两次，核对 Label 和日志的 1、2 → 原生批准 compensate → 源及元数据哈希恢复 → 刷新后点击不再改变文本 → 补偿临时按钮位置。若结果不确定，先查询原记录；发生其他开发者修改则停止补偿。保留 PNG 原操作 `b1d4c0e2-7f3a-4a91-9c58-2e6d10ab4f01` 和其节点，不用旧整场景备份覆盖。

用户将 Assistant 置于前台后，原生 DeepSeek Flash 读取了 skill、实例、能力、真实脚本与按钮，并生成差异。首版新增未绑定 Button 属性被否决；后续把计数放入 properties 的方案也被修正。Plan 模式曾因模型输出非 JSON 而结构校验失败，数次 Agent 回合只生成计划或文字审批声明，并未实际调用写工具。这些失败不能计作写入完成。

最后原生面板实际显示两处精确替换的审批，批准后以操作 `3c8a41d7-9e52-4b06-a7f1-6d0b28e4c915` 写入，源 SHA-256 为 `75c757a46643a77ac1c6659206d1ed466317454b4cae736a2b825a8ca8293be7`，UUID/元数据不变。但编译校验返回 `SCRIPT_COMPILE_TIMEOUT`，原操作为 `needs-review`；随后同 ID reconcile 仍超时，无重复 apply。

磁盘诊断发现本次增量导入更新了 quick-scripts `src/dst`，`dst` 内联 source map 的 `sourcesContent` 与本次源码逐字相等，独立 `.map` 与 stats 却保留旧预览缓存。已增加目的产物内联 map 的严格校验：精确源路径和正文、map 版本 3、唯一内联 map、src/dst 新鲜度、源和目的语法都须通过；有内联 map 但不匹配时不回退为成功。原独立 map/stats 路径保留。10 项脚本测试通过，包含错误源/路径、陈旧产物和非法语法拒绝。扩展重载后，原生模型读取原账本并经面板批准以同 ID reconcile，得到 `state=completed/outcome=needs-runtime`、`evidenceKind=destination-inline-source-map`；没有重复 apply。精确差异和原生回执摘要见[按钮任务记录](traces/cocos-agent-native-button-script-2.4-20261011.json)。

## 2026-10-11 按钮任务实机结果

- Creator 原生 Assistant / DeepSeek Flash 在实例 `8d924bd0-e256-4121-8989-8dddd80600a2` 调用工具，读取版本专属 skill；脚本 apply、原 ID reconcile、compensate 和临时位置补丁都由原生面板批准。首次等待 `scene.snapshot` 通用工具批准超时，没有执行该步骤；下一回合改用固定只读 `cocos_2x_scene_snapshot` 后成功。
- 临时按钮位置操作 `a17c9e4b-2f63-4d58-8b71-0c45de9a7f12` 只将根坐标 `(0,-200)` 改为 `(480,120)`，编辑器和磁盘读回均通过。原生 `runtime.preview.start` 经批准；`runtime_observe` 核对 helloworld UUID，帧推进 38、无错误、Label 为 `Hello, World!`，面板显示画布截图。
- 通过 CUA 打开的本地可见预览实际鼠标点击两次，Label 分别显示 `Clicked: 1`、`Clicked: 2`，Console 分别记录相应计数（UTC 10:50:01.868 与 10:50:24.811）。未直接调用 click 回调或合成引擎事件。普通 Chrome 坐标点击通道报窗口绑定错误，故在可控 IAB 同一预览服务完成输入验收。
- 原生面板按脚本原 ID 补偿，账本为 `compensated`，恢复源重新编译通过。重载预览后按钮仍可见，实际点击后 Label 保持 `Hello, World!`，没有新增点击日志。再以节点补偿 ID `b7e4d2a9-6c18-4f03-9a52-1d8ef70b3c46` 逆向恢复位置；编辑器/磁盘/recovery 均通过。
- 最终脚本 SHA-256 为 `5d489ee56ff2397f74895df229a0ab06f7b74ed10ef57333d127be4e4120bb22`，meta 为 `358c6793af190640940024fe0d4ce5638c3c80073f5b90b08a937b093273f3ca`，场景为 `414c5563d24778a815632f1c480bc8d243ceb978a311a56f26db49e28d96993a`，均与本轮开始相同；原有 PNG 节点保留。

观察边界：`runtime_observe` 每次启动独立临时浏览器，不连接已点击的可见页面。本轮初始运行观察和实际输入证据分开记录；账本的 `runtime=not-verified` 未人工改写。Plan 非 JSON 输出、需要多次精确提示才真正调工具、通用只读命令走审批等体验缺口仍存在。新 ID 原生重放未做，不能写成脚本合同全部动作已实机通过；实际游戏工程的脚本任务也未替代为示例成果。截图与回执摘要见[按钮任务记录](traces/cocos-agent-native-button-script-2.4-20261011.json)。
