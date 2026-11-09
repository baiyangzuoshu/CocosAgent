# 第 10 课：Session 事件日志

**目标：** 看清一次 Agent 交互如何按顺序写成不可变事件，以及后续读取如何用序号定位。

## 本课问题

Session 保存的是一份可变对话文本，还是一串按顺序提交的事实？

## 本课增量

示例追加一次 Turn 的开始、Step、用户消息、助手消息和结束事件。SessionLog 在提交时分配连续 `seq` 与 `time`，先复制并冻结数据，再让读取方按半开区间分段读取。

```text
turn/start
  → step/start
  → user/message
  → assistant/message
  → step/end
  → turn/end
```

## 源码对照

- [`docs/architecture.md#session-log`](../../../deepseek-harness/docs/architecture.md#session-log)：Session 事件日志是模型上下文的事实来源。
- [`docs/subsystems/session.md`](../../../deepseek-harness/docs/subsystems/session.md)：事件类型、surface 投影和追加规则。
- [`packages/core/session/README.md`](../../../deepseek-harness/packages/core/session/README.md)：`Session.append()`、序号和事件读取约定。
- [`packages/core/session/src/types.ts`](../../../deepseek-harness/packages/core/session/src/types.ts)：真实 Session 事件的 payload 类型。
- [`packages/core/session/src/index.ts`](../../../deepseek-harness/packages/core/session/src/index.ts)：追加时生成序号、时间、快照并提交。

## 代码结构

```text
s10_session_event_log/
├── README.md
├── deno.json
└── src/
    ├── main.ts
    ├── session-log.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期日志先拒绝缺少 `surfaceOp` 的消息事件，且 `seq` 保持为 0；随后有效事件从 0 连续编号，最后按 `[0, 3)` 和 `[3, seq)` 两段读回。

## 观察结果

- `seq` 是下一条事件序号，也是当前日志长度；拒绝的 append 不占用序号。
- Session 事件包含类型、顺序、时间和 JSON 数据。消息类事件还要标记它如何进入消息 surface；本课只实现 `surfaceOp: 'append'`。
- 助手事件同时保存消息和紧凑 stream 记录，消息文本不是从运行时输出反推出来的。
- 日志是重建模型历史的来源；当前课程只查看原始事件，不在这里生成模型消息列表。
- 本例 `read(fromSeq, toSeqExclusive)` 是教学接口；Harness 当前将同步 `eventAt()` 和 `snapshotEvents()` 标为弃用。真实持久化由订阅 `session/event` 的后端处理，不等同于内存 append。

## 简化与边界

- 示例只实现一小组当前事件 shape，不检查完整 Turn/Step 嵌套、消息 ID 品牌、插件 projection 或 Session Store 所有权。
- `SessionLog` 在内存里冻结 JSON 快照，不写磁盘；持久化与恢复留到第 12 课。
- 示例用固定时钟和 Fake 模型流，不表示线上事件时间或真实 LLM 行为。

---

下一课：[历史投影](../s11_history_projection/README.md) 会从这份原始事件序列生成模型消息历史。
