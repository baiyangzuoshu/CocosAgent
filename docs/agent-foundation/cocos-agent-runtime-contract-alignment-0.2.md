# CocosAgent 运行版本与合同对齐记录

日期：2026-10-10。产品目标：Cocos Creator 2.4.15。状态：源代码修正完成；当前运行宿主仍不匹配，步骤未验收。

## 源码对齐

初次代码对齐时，插件、MCP、Host 与 2.4 Creator 扩展均标为 `0.2.0`。随后插件与 MCP 升为 `0.3.0`，以包含可分发技能包和读取资源；Host 与 Creator 扩展仍为 `0.2.0`。Host 在每次查询时重新计算自身、MCP、插件包、产品 skills/引用和 Creator 扩展指纹。MCP 将启动时捕获的版本及指纹随实例/能力查询传给 Host；扩展在启动时捕获自己的版本、源码指纹和实际命令合同指纹。

MCP 与 Host 共用 [`catalog.schema.json`](../../tools/cocos-agent-bridge/catalog.schema.json) 作为命令输入参数 schema 来源。MCP 的通用命令入口和独立压力工具都从同一份 2.4 压力合同生成输入 schema；`content.stress.run` 现在包含 `loadMode`、`budgetProfileId`、冷/热加载 P95、解析/释放预算和估算 RGBA 工作集上限。目录合同可表示 0.1 与 0.2，不再把所有命令版本限制为 0.1。

Host 仍以实例 ID、Creator 版本、项目根目录、nonce 与当前目录摘要校验目标身份。合同校验改为逐命令处理：缺失、额外或 schema 不兼容的命令单独返回不可用和原因；组件指纹无法证明与当前源版本一致时，所有编辑器命令置为不可用，但保留 `instances` 与 `capabilities` 诊断入口。目录摘要错误、实例身份错误仍拒绝整个目标。

## 针对性验证

- MCP 工具发现回归验证 42 个源码工具；通用入口和独立压力工具的必需参数完全一致，并包含冷/热加载与 RGBA 字段，不再包含旧的 `maxResourceLoadP95Ms`。
- Host 回环夹具验证了 MCP 源指纹过期、MCP 未提供指纹、扩展版本过期、单条 schema 不匹配、错误运行状态和命令缺失。合同问题会在结果中给出具体原因，不再因一条高级命令失败而把其余实例伪装成断连。
- JSONL 测试验证 MCP 指纹会传给 Host；扩展、schema 与插件版本文件均可解析。
- `node --test mcp-server.test.mjs`、`node tools/cocos-agent-bridge/agent-jsonl.test.js`、`node tools/cocos-agent-bridge/agent-dispatch.test.js` 和 `node tools/cocos-agent-bridge/catalog-host.mock-test.js` 均通过。最后一个测试只监听本机回环地址并使用临时项目夹具。

## 当前真实运行状态

重新读取了当前 MCP 工具目录和 Creator 2.4.15 能力：

- Codex 本机插件已通过 `codex plugin add cocos-agent-2x@cocos-agent-local` 更新至 `0.3.0`，状态为 installed/enabled。安装缓存含 11 个 `SKILL.md` 和 29 份引用资料；43 个技能/引用/包元数据文件与仓库源逐项 SHA-256 一致。
- 当前 MCP 仍暴露 39 个工具；压力工具 schema 仍只有 `maxResourceLoadP95Ms`，没有 `loadMode`、`budgetProfileId`、冷/热预算和 RGBA 上限。工具注册在 MCP 服务进程启动时形成，磁盘源码变化没有更新已注册的 `tools/list`。
- Creator 当前实例 `ae8a8ecc-0021-4c6b-9076-82fc26d591bd` 仍报告扩展 `0.1.0`，没有扩展源码或合同指纹。
- 当前 Host 源码版本为 `0.2.0`，并能通过现有 MCP `capabilities.list` 输出预期/实测版本、指纹及合同差异。它将 14 条命令全部标为 `unavailable`，原因为扩展/MCP 指纹未报告或版本不匹配；实例仍保持 `ready`，但不可执行编辑器命令。

因此源码侧已经能准确发现并隔离旧运行时，但 Agent 的静态 MCP 输入 schema 尚未更新，不能将实际加载标准标为通过。只有在已加载 MCP 服务和 Creator 扩展分别从新源码启动后，重新读取工具目录与能力回执，确认三方指纹一致、压力参数完整、命令状态与编辑器条件一致，才能完成步骤 0。此次未自行重启 MCP Host 或 Creator。

## 技能包分发与读取（0.3.0）

插件 `skills/` 是可执行任务 skill 的唯一维护源。与插件 skill 重复的 `docs/agent-foundation/skills/*/SKILL.md` 已改为规范源指针；其余相关任务 skill 已纳入插件。`plugins/cocos-agent-2x/skill-package.json` 登记 11 个 2.4 专用 skill 和 29 个随包参考文件，`scripts/package-skills.mjs --check` 检查文件完整性、引用哈希、技能 frontmatter 和本地链接。

MCP 0.3.0 提供 `cocos://2x/skills/index`、每个技能资源和对应引用资源。索引报告插件/MCP 版本、插件源指纹、每个 `SKILL.md` 与引用文件的 SHA-256。`node --test mcp-server.test.mjs` 已通过真实 `StdioClientTransport` 子进程发现并读取 index、PNG 资源流水线 skill、合同引用和图像引用；包内 11 个 skills 均通过 skill-creator validator。插件 cache 也已实际更新并逐项与源文件比对。

活动 MCP Host 未重启，因此它当前仍在提供旧的静态工具 schema 和旧 Resource 清单；新版 MCP Resource index 已在新 stdio 进程及已安装插件包中验证，不能描述成已由该旧进程提供。插件 skill 文件本身已随 0.3.0 安装可用；实际 MCP schema/Resource 服务的切换仍属于第 0 步剩余验收。
