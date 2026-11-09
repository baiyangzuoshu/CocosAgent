# 第 25 课：Shell 执行能力

**目标：** 跑通 Shell 消费者、Shell Provider、Sandbox Provider 与 Subprocess
Provider 的调用链，观察替换执行器时消费者保持不变。

## 本课问题

`bash`
工具怎样把命令交给宿主执行？启动子进程和限制文件影响分别由谁负责？如何在不改工具消费者的前提下切换到沙箱执行器？

## 本课增量

本课把命令消费与宿主执行拆开：消费者使用 `ShellExecutor` 的 `resolve()` 与
`execute()`；本地 Bash Provider 将 argv 交给 Subprocess Provider；沙箱版在 spawn
前先把完全相同的 argv 和逐次调用策略交给 Sandbox Provider，再将其返回的 argv
交给同一个 Subprocess Provider。

```text
固定 Shell 消费者
      │ resolve(request) → execute(spec)
      ▼
  Shell Provider  ────────────────────────┐
      │                                    │
      ├─ LocalBashProvider                 └─ SandboxedBashProvider
      │      │                                     │ confine(argv, policy)
      │      └─────────────────┐                   ▼
      │                        │             Sandbox Provider
      └────────────────────────┴─────► Subprocess Provider
                                             │ spawn(argv, cwd)
                                             ▼
                                      /bin/bash -c <command>
```

示例用同一个 `runStatusCommand()` 先后运行本地 Provider 和沙箱
Provider。两次都通过 Subprocess 启动固定的无副作用 `printf` 命令。Demo Sandbox
stub 验证只收到这条教学命令，并返回 `read-only` 计划；它保留 argv
让命令可以运行，**不执行操作系统级隔离**。

## 源码对照

- [`packages/shell/tool-bash/src/index.ts`](../../../deepseek-harness/packages/shell/tool-bash/src/index.ts)：面向模型的
  `bash` 工具通过 `ctx.shell.resolve()` 与 `ctx.shell.execute()` 调用执行器。
- [`packages/shell/shell/src/index.ts`](../../../deepseek-harness/packages/shell/shell/src/index.ts)
  与
  [`packages/shell/shell/src/types.ts`](../../../deepseek-harness/packages/shell/shell/src/types.ts)：定义
  `ctx.shell` 的 Service Provider seam、request/spec 拆分、执行结果与沙箱事实。
- [`packages/shell/bash-local/src/index.ts`](../../../deepseek-harness/packages/shell/bash-local/src/index.ts)：本地
  Provider 使用 `['bash', '-c', command]`，把工作目录、stdio、环境和执行预算交给
  `ctx.subprocess`。
- [`packages/shell/bash-sandbox/src/index.ts`](../../../deepseek-harness/packages/shell/bash-sandbox/src/index.ts)：继承本地进程机制，在受限模式下先调用
  `ctx.sandbox.confine()`，再把返回 argv 交给同一 Subprocess seam。
- [`packages/subprocess/subprocess/src/index.ts`](../../../deepseek-harness/packages/subprocess/subprocess/src/index.ts)：定义
  Subprocess Provider 接口；它启动、观察和终止子进程，但不解释命令含义。
- [`packages/subprocess/subprocess-local/src/index.ts`](../../../deepseek-harness/packages/subprocess/subprocess-local/src/index.ts)：在宿主机实现受管子进程生命周期。
- [`packages/sandbox/sandbox/src/index.ts`](../../../deepseek-harness/packages/sandbox/sandbox/src/index.ts)：定义
  `confine(argv, policy)`；真正的 Provider 返回平台 runner argv 和 enforcement
  完整性事实。
- [`docs/subsystems/shell.zh.md`](../../../deepseek-harness/docs/subsystems/shell.zh.md)、[`docs/subsystems/subprocess.zh.md`](../../../deepseek-harness/docs/subsystems/subprocess.zh.md)、[`docs/subsystems/sandbox.zh.md`](../../../deepseek-harness/docs/subsystems/sandbox.zh.md)：分别查看消费方执行约定、进程生命周期和文件影响策略。

## 代码结构

```text
s25_shell_subprocess/
├── README.md
├── deno.json
└── src/
    ├── consumer.ts
    ├── main.ts
    ├── sandbox-provider.ts
    ├── shell-provider.ts
    ├── subprocess-provider.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

`run` 只授予固定 `/bin/bash` 的启动权限。预期两种 Provider 都打印
`shell lesson: ready`；本地执行链直接抵达 Subprocess，沙箱执行链会先经过
`sandbox.confine`，再抵达同一个 Subprocess Provider。

## 关键观察

- `ShellExecutor` 是消费方依赖的能力约定；`LocalBashProvider` 和
  `SandboxedBashProvider` 是可以替换的
  Provider。消费者既不知道也不需要知道底层怎么创建进程。
- Subprocess 接收 argv 数组、cwd 和 stdio
  等进程参数。它负责进程启动与生命周期，不替消费者决定命令、超时、Shell
  语义或模型结果。
- 命令字符串只在 Bash Provider 边界变成 `['/bin/bash', '-c', command]`。传给
  Sandbox Provider 的是这组确切 argv 和该次调用的策略。
- Sandbox Provider 返回要启动的 argv 与隔离事实。真实后端会把命令包装在平台
  runner 中；拒绝或无法提供隔离时不能悄悄退回无隔离执行。
- `read-only`
  限制文件影响，不代表网络隔离或进程不可见；实际保证还取决于后端报告的
  enforcement 完整性。
- 请求先经 `resolve()` 填入工作目录等默认值，再由 `execute()` 消费已解析
  spec。执行器拥有这些默认值，不让 Subprocess 悄悄代填。

## 简化与边界

- `DenoSubprocessProvider` 用 `Deno.Command` 表现 spawn
  和完成句柄，但直接一次性收集输出；Shell 的 `execute()` 也简化成直接返回结果的
  Promise，没有完整执行句柄；没有 Harness
  的有界缓冲、spill、取消、deadline、信号终止和进程树停稳管理。
- 示例只支持 POSIX `/bin/bash`、一个前台调用和一个固定 `printf`
  命令；不接受模型提供的命令，也不实现 `tool-bash` 的工具
  schema、作业登记、输出渲染和退出标记。
- `DemoReadOnlySandboxProvider` 只用 argv allowlist 示意 `confine()` 的接线与
  Provider 替换。它不限制文件访问，不能作为安全边界；真实 OS 隔离需要 Harness
  的平台 Sandbox Provider。
- 没有实现 `read-only`、`workspace-write`、`danger-full-access`
  的完整策略解析、平台 runner 选择、拒绝分类、批准后升权重试或逐会话策略。
- 返回结果压缩为退出码、信号、stdout/stderr 和演示用 sandbox 字段；真实 Shell
  执行句柄还支持后台输出读取与进程观察。
