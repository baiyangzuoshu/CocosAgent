# 第 9 课：CLI 与 Headless 启动

**目标：** 从 `dsh` 命令行追到 Headless 启动插件如何接收任务并结束一次运行。

## 本课问题

`dsh headless "任务"` 中，谁负责选择 Profile，谁负责解析任务，又是谁运行 Agent？

## 本课增量

示例重现四段交接：CLI 选择 `headless` Profile；Profile 声明 base 与 headless Bundle；Launcher 把应用参数作为 `cmdlineArgs` 服务提供；`headless-startup` 解析任务并提供 `headlessStartup`，再由 `headless-runner` 读取并运行一次。

```text
dsh headless --json "概括本次变更"
  → CLI 选择 headless Profile
  → Profile 挂载 Headless Bundle
  → cmdlineArgs 服务保存 --json 和任务参数
  → headless-startup 提供 headlessStartup
  → headless-runner 执行一次任务并请求退出
```

## 源码对照

- [`docs/architecture.md#application-launch`](../../../deepseek-harness/docs/architecture.md#application-launch)：产品应用通过命名 Profile 启动。
- [`apps/cli/src/args.ts`](../../../deepseek-harness/apps/cli/src/args.ts)：识别 `dsh headless` 简写，并把应用参数转交给 Profile。
- [`apps/cli/src/bin.ts`](../../../deepseek-harness/apps/cli/src/bin.ts)：将解析后的 Profile、patch 和应用参数分发到启动器。
- [`apps/cli/src/profile-boot.ts`](../../../deepseek-harness/apps/cli/src/profile-boot.ts)：解析组合后的 Profile，调用 `boot()`，并提供 `cmdlineArgs`。
- [`packages/bundle/headless/cordis.patch.yml`](../../../deepseek-harness/packages/bundle/headless/cordis.patch.yml)：插入启动参数插件和一次性 Runner。
- [`packages/bundle/headless/src/startup.ts`](../../../deepseek-harness/packages/bundle/headless/src/startup.ts)：解析任务参数并提供 `headlessStartup` 服务。
- [`packages/bundle/headless/src/index.ts`](../../../deepseek-harness/packages/bundle/headless/src/index.ts)：通过 Agent/Session 服务执行一次任务。

## 代码结构

```text
s09_cli_headless_boot/
├── README.md
├── deno.json
└── src/
    ├── cli.ts
    ├── context.ts
    ├── headless-runner.ts
    ├── headless-startup.ts
    ├── main.ts
    ├── profiles.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run headless --json "概括本次变更"
```

预期日志会显示 Profile 与 Bundle 选择、参数服务交接、启动服务发布和 Runner 退出。最终结果是一行 JSON，内容为确定性模拟答复。

同一解析器也接受显式形式：

```sh
deno task run --profile headless --json "概括本次变更"
```

## 观察结果

- `dsh headless` 是 `dsh --profile headless` 的简写。
- Launcher 只解析自己的参数；遇到第一个应用参数后，剩余参数原样交给应用。本例的 `--json` 因此由 Headless 启动插件解析。
- 实际 Profile 的 Bundle 顺序是 `dsh-base` 后接 `dsh-headless`；Headless Bundle 添加 `headless-startup` 和 `headless-runner`。
- Launcher 通过 `cmdlineArgs` 交付命令行快照。启动插件解析后提供 `headlessStartup`，Runner 依赖该服务执行任务。
- Headless 是一次性入口：完成后请求受控关闭。Web Profile 则会启动长期运行的服务。

## 简化与边界

- 示例只定义 `headless` Profile，不解析 Harness home 中的 Profile 清单，也不运行 Cordis Loader。
- `Context` 是最小服务表，不含依赖等待、Fiber 状态和 effect 清理。
- Runner 用固定模拟答复替代真实 Agent、Session、工具和 LLM；JSON 模式只输出一个 final 事件，不复刻完整流式协议。
- 本例省略 `--session-id`、stdin、权限预设、审批策略和多个 `--patch` 的完整参数语法。

---

下一课：[Session 事件日志](../s10_session_event_log/README.md) 会观察 Headless 运行产生的持久事件。
