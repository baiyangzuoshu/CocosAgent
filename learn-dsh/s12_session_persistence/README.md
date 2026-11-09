# 第 12 课：持久化与恢复

**目标：** 将 Session 事件写入磁盘，进程重启后重开日志并从已提交事件继续。

## 本课问题

内存里的 Session 怎样变成可恢复的历史？重启时，存储层与 Agent 恢复层各自负责什么？

## 本课增量

第 10 课把事件追加到内存日志，第 11 课从事件投影出模型历史。本课在两者之间加入持久化句柄：后端订阅 `session/event`，把事件排队后交给句柄；`flush` 排空队列并建立持久化检查点。重启后通过 `open(id, 'write')` 读取连续日志，恢复方再处理未闭合的 Turn。

```text
Session.append
  → session/event
  → 后端缓冲
  → session/flush：handle.append + handle.flush
  → JSONL 文件

重启
  → open(id, 'write') / read()
  → 清理未完成的物理尾行
  → 恢复层补齐中断的 Step/Turn
  → 从已恢复事件继续追加
```

示例先提交一轮完整交互，再提交第二轮的请求前缀并模拟进程崩溃。重开时会丢弃一条人为写入的残缺 JSONL 尾行；完整事件仍保留，教学版恢复器随后补上缺失的 `step/end` 和 `turn/end { interrupted }`。

## 源码对照

- [`packages/session/session-persistence/README.zh.md`](../../../deepseek-harness/packages/session/session-persistence/README.zh.md)：持久化服务、`SessionHandle` 和 flush durability barrier 的合同。
- [`packages/session/session-persistence/src/handle.ts`](../../../deepseek-harness/packages/session/session-persistence/src/handle.ts)：句柄的 `read()`、`append()`、`flush()` 与 `close()` 语义。
- [`packages/session/session-persistence-jsonl/README.zh.md`](../../../deepseek-harness/packages/session/session-persistence-jsonl/README.zh.md)：JSONL 布局、当前 generation、压缩与撕裂尾部恢复。
- [`packages/session/session-persistence-jsonl/src/storage.ts`](../../../deepseek-harness/packages/session/session-persistence-jsonl/src/storage.ts)：写句柄、事件缓冲及 `session/event`、`session/flush` 路由。
- [`packages/session/session-checkpoint-policy/src/index.ts`](../../../deepseek-harness/packages/session/session-checkpoint-policy/src/index.ts)：模型请求、工具调用和 Step 边界前的语义 flush。
- [`packages/core/agent-loop/src/index.ts`](../../../deepseek-harness/packages/core/agent-loop/src/index.ts)：`resume()` 先取得写所有权、读取事件，再把恢复结果用于 Session 准备。
- [`packages/core/session/src/repair.ts`](../../../deepseek-harness/packages/core/session/src/repair.ts)：`interruptedTurnClosers()` 为中断的最终 Turn 生成补齐事件。
- [`docs/subsystems/persistence.zh.md`](../../../deepseek-harness/docs/subsystems/persistence.zh.md)：后端无关的持久化、崩溃恢复和写入所有权说明。

## 代码结构

```text
s12_session_persistence/
├── README.md
├── deno.json
└── src/
    ├── jsonl-store.ts
    ├── main.ts
    ├── persistence-bridge.ts
    ├── resume.ts
    ├── session-log.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

运行需要的文件读写权限只授予本课目录；示例把临时会话文件写入临时目录，并在结束时删除。

预期结果：第一次 `flush` 前文件尚未实体化；第一轮提交后读回 6 条事件；重开时恢复 9 条完整事件并截断 35 字节残缺尾行；恢复层追加 `step/end@9` 与 `turn/end@10`；接续一轮后最终日志有 17 条事件，下一序号为 17。

## 观察结果

- Session 的内存追加与物理写入是两步。后端同步接收 `session/event`，再按批次交给句柄；本例省略后台定时批处理，只在明确调用 `flush()` 时排空队列。
- `create()` 可以先返回写句柄而不创建文件。首批事件写入或显式 flush 时才实体化；空 Session 也能通过 flush 持久化 header。
- 事件按连续 `seq` 追加，header 与事件日志分开存储。真实 JSONL 文件的首行是 `type: 'session'` header，后续每个事件单独一行。
- `flush()` 是应用依赖的持久化屏障；真实 seam 允许后端在 `append()` 返回后仍缓冲写入。本例的 `append()` 写入文件，`flush()` 再调用文件同步。
- 物理恢复只丢弃未完整落盘的最终 JSONL 行，不会因为末尾 Turn 未闭合而删除已提交事件。语义恢复由 `agent-loop.resume()` 执行，并把 closer 作为普通事件追加。
- 恢复使用写句柄，以单写者所有权避免与仍活跃的 Session 并发写入。只读观察可以在内存中配平中断 Turn，但不会回写。

## 简化与边界

- 示例使用未压缩 JSONL 和单文件 `session.v3.jsonl`。当前工作区的 JSONL provider 默认使用独立 Zstandard 帧，并按 Session 保存版本化 generation 文件；它还负责历史格式迁移、路径安全、修订检测、跨进程写租约和更严格的损坏分类。
- `SessionLog` 与 `PersistenceBridge` 是独立教学实现，不启动 Cordis，也不挂接真实 `ctx.sessionPersistence`。生产中由 agent-loop 为已发布 Session 获取写句柄，单独创建 Session 不会自动持久化。
- 恢复函数只演示一个未闭合 Step 和 Turn；真实 `interruptedTurnClosers()` 还会处理未完成工具调用及多种边界情况。
- 示例在同一 Deno 进程中用新的 Store 实例模拟重启，没有创建子进程，也没有实现跨进程互斥。示例只接受安全路径段形式的 Session id。
- 文件写入失败后的回滚、完整 payload 校验与未来格式拒绝策略留给真实后端处理；本例聚焦连续序号、JSONL 尾行和恢复顺序。
- 版本号 `3` 对应本次核对时 Harness 当前 Session JSONL 格式；示例不提供版本迁移能力。

---

下一课：[查询与上下文压缩](../s13_query_compaction/README.md) 会在完整事件日志上构建有界的模型上下文。
