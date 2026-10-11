# Creator 2.4.15 现有 JavaScript 编辑合同 0.1

日期：2026-10-11。状态：**实现与模拟测试完成；真实 Creator 仅完成脚本只读；写入、编译、按钮功能、补偿与重放的实机验收待做。**

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

写前记录原文、候选文、哈希和意图至 `.cocos-agent/script-operations/`；写后刷新精确资源 URL，并核对源文件、元数据、AssetDB UUID、quick-scripts source map 正文及目标编译 stats。quick-scripts 是本版本本地观察到的产物，并非公开稳定编译 API；产物缺失或不匹配不得判为编译通过。已知 `asset-db:script-import-failed` 进入有限诊断，不宣称覆盖全部 Console 错误。

成功编译后为 `needs-runtime`，不宣称按钮功能通过。导入失败可能已写入源文件，返回确认副作用和原操作 ID；超时或失联为 `needs-review`，禁止重复 apply。查询后按原记录 reconcile 或 compensate；后续人工修改造成冲突时拒绝覆盖。重放使用新 ID，并要求原记录已补偿。

产品 skill：`plugins/cocos-agent-2x/skills/cocos2-script-development/SKILL.md`。实现：扩展 `script-operations.js`，Host `script-contract.js`（镜像一致性测试）、`script-host.js`、`agent-dispatch.js` 和 MCP 调度器。

## 证据与剩余项

模拟测试覆盖身份/路径/语法拒绝、编译产物匹配、重复 ID、补偿冲突、新 ID 重放、编译超时和已知导入失败。真实 Creator 内打包的 MCP runtime 已查询实例、能力并只读取得 `Script/HelloWorld.js`：UUID `280c3aec-6492-4a9d-9f51-a9b00b570b4a`，源 SHA-256 `5d489ee56ff2397f74895df229a0ab06f7b74ed10ef57333d127be4e4120bb22`；原始回执位于本机临时验收文件 `/private/tmp/cocos-agent-script-smoke.jsonl`，未将源码全文复制至发布轨迹。

这不是原生面板模型写入验收。必须补齐：真实模型按 skill 形成差异、面板批准、实际导入编译、预览点击与状态变化、失败诊断、补偿和新 ID 重放。临时 Button 场景夹具不作为产品成果提交。

暂不覆盖新建脚本、TypeScript、多文件重构、自动场景事件绑定、自动点击、完整 Console 历史、原生或 3.x。Creator 2.4.15 Web 的有界日志、帧状态、目标节点和截图观察另见[运行观察合同](cocos-agent-runtime-observation-0.1.md)；它不替代输入测试，真实错误注入、修复和二次观察仍待实机验收。
