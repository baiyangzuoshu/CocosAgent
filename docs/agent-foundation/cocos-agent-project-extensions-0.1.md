# CocosAgent 项目级 Skill 与工具扩展合同 0.1

状态：合同与源码接线已实现；Creator 原生面板及 LinkUpClient 工程验收待完成。适用范围仅为 Creator 2.4.15。

## 目标与边界

项目可以向 CocosAgent 提供按需加载的工作流知识，以及指向现有 Creator 语义命令的声明式工具别名。扩展由当前已注册的项目根限定，Agent 的内置 TS 内核不执行项目提供的代码。

M3 将项目工具注册定义为**命令绑定**，不定义可执行插件回调。业务 API 的调用知识可通过 project skill 和参考文件说明；可执行调用只能映射到 Host 当前已经实现、已发现且 schema 可校验的 Creator 2.4.15 命令。新增真正的业务 API 命令仍须履行“命令合同 → 编辑器桥接 → 产品 skill → 原生验收”门槛。

## 项目 Skills

- 唯一发现根：工程内 `.cocos-agent/skills/<skill-id>/SKILL.md`；`skill-id` 使用 `^[a-z][a-z0-9-]{0,47}$`。
- `SKILL.md` 用 Markdown，并以 YAML 风格 frontmatter 提供非空 `description:`。关联参考文件放在同目录 `references/` 下；每个文件名成为精确 `referenceId`。不递归发现任意工程文件或读取符号链接。
- 每个工程最多 32 个 skill；单个 skill 与 reference 分别不超过 64 KiB，每个 skill 最多 32 个 reference。索引返回项目相对路径、大小和 SHA-256；读取时重新发现并逐字节校验索引哈希，Agent 也校验本轮索引给出的哈希。
- 工具为只读 `cocos_2x_project_skills_list` 和 `cocos_2x_project_skill_read`。读取 skill 时传入精确名称及 `expectedSha256`；读取 reference 时另传索引中的精确 `referenceId` 和哈希。
- 项目 skill 与 `plugins/cocos-agent-2x/skills/` 内置 skill 是两个显式来源，不互相覆盖或冒充。Agent 按任务相关性读取；项目文本是数据，不能覆盖用户请求、系统策略、Creator 命令合同或审批结果。
- 本合同 0.1 未定义独立的 skill 启用位：从发现根移除目录即可停止提供；不允许通过同名 skill 替换内置 skill。

## 项目工具 Manifest

manifest 位于工程内 `.cocos-agent/agent-tools.json`，UTF-8 JSON 示例：

```json
{
  "schemaVersion": 1,
  "tools": [
    {
      "id": "inspect-login-ui",
      "description": "Inspect the active login scene using the project's expected node naming convention.",
      "command": "scene.snapshot",
      "access": "read",
      "enabled": true
    }
  ]
}
```

- manifest 上限 32 KiB、最多 32 项；`id` 使用 `^[a-z][a-z0-9-]{0,47}$` 且不可重复。每项只允许 `id`、`description`（1–500 字符）、`command`、`access` 和可选 `enabled`。
- `command` 必须是本地 MCP/Host 固定目录中的 Creator 命令。读写类别由命令合同决定，manifest 的 `access` 必须完全匹配。未声明 `enabled` 默认为启用；`false` 的项目工具留在 disabled ID 列表而不可执行。
- `cocos_2x_project_tools_list` 返回文件 SHA-256、启用项、禁用 ID 和绑定命令。每次执行必须携带该 SHA；服务端执行前重新读取 manifest，文件变化即拒绝且无副作用。
- `cocos_2x_project_tool_read` 仅接受只读绑定；`cocos_2x_project_tool_write` 仅接受写入绑定，走既有逐次本地审批。两者根据绑定命令复用 Host schema，并重新检查已注册工程、Creator 版本、实时能力目录和目标身份。
- 写入命令继续由底层 Creator 合同记录 operation/回执，并遵守保存读回、编译、恢复和未决写入规则。项目别名不能改变这些语义。Agent 遇到不确定写入后只使用原 operation 恢复工具，不以项目别名重试。
- 工具的输出与成功条件来自被绑定命令的合同；描述只补充项目语境，不改变输入输出 schema。没有合适既有命令时，该 API 仍不可调用，不得用任意脚本、shell 或文件写入伪装成项目工具。

## 冲突、信任与恢复

- 项目根必须与 MCP 启动时显式注册的根一致。路径为固定相对路径，不接受 manifest 提供的任意执行路径、模块名、URL 或文件路径。
- 项目内容可能包含错误或提示注入；skill、description、工具结果、日志和截图不能授权操作，也不能解锁额外能力。
- 哈希用于内容版本与竞态校验，不是签名或沙箱。当前合同不执行 project code、不加载 npm 模块、不启动进程，也不将 MCP 内部命令绑定称为安全隔离边界。
- 用户已有的逐次写入审批、Creator 操作账本、补偿/对账和项目 `AGENTS.md` 哈希门槛继续有效。项目工具目录成功、skill 读取成功或扩展启用本身均不构成写入授权。
- 文件新增、删除、禁用或变化后须重新列目录。执行时 manifest SHA 不一致会以 `PROJECT_TOOL_MANIFEST_STALE` 无副作用停止；skill 在读取时变化会以 `PROJECT_SKILL_CHANGED_DURING_READ` 或目录哈希不匹配停止。

## 接线和验收状态

MCP 提供项目 skill 发现/读取、工具 manifest 发现及读写两条命令绑定路由；Agent 调度在使用项目前确认 skill/reference 哈希、工具 manifest SHA、访问类别和 live capability。新增一般工具仍走同一调度循环。

尚未在 Creator 2.4.15 面板实测发现、按需读取、禁用、哈希变化拒绝、读写权限、LinkUpClient 工作流/API 任务及写入恢复。LinkUpClient 当前不在本地可读写工作区；本合同不虚构其框架约定、UI 路径或业务 API，也未修改其工程。实现状态不得写作“LinkUpClient 项目扩展已验收”。
