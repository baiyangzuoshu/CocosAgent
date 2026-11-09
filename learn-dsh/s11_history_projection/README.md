# 第 11 课：历史投影

**目标：** 从 Session 的不可变事件日志重建当前模型可见的消息历史。

## 本课问题

事件日志里有 Turn 边界、压缩记录和消息。模型请求为什么只收到其中一部分？

## 本课增量

上一课把消息事件按 `surfaceOp: 'append'` 标记为新增表面。本课继续实现 `append` 与区间 `replace` 两种表面变更：先按事件序号折叠出当前 surface，再把其中能生成消息的节点投影为模型历史。

```text
原始事件日志
  → 按 seq 重放 surfaceOp
  → 当前 surface 节点 [seq, ...]
  → 从节点投影模型消息
```

示例先记录一轮对话，然后用压缩 checkpoint 替换旧消息区间，最后追加新一轮消息。旧消息仍留在原始日志中，但不再出现在当前模型历史里。

## 源码对照

- [`docs/architecture.md#session-log`](../../../deepseek-harness/docs/architecture.md#session-log)：事件日志是模型上下文的事实来源。
- [`packages/core/session/README.md`](../../../deepseek-harness/packages/core/session/README.md)：`deriveMessages()` 的用途和缓存语义。
- [`packages/core/session/src/surface.ts`](../../../deepseek-harness/packages/core/session/src/surface.ts)：`foldSurface()` 重放 append/replace，`deriveEventMessage()` 将事件投影成消息。
- [`packages/core/session/src/index.ts`](../../../deepseek-harness/packages/core/session/src/index.ts)：`Session.deriveMessages()` 按当前 surface 构建消息列表。
- [`packages/compaction/compaction-basic/src/region.ts`](../../../deepseek-harness/packages/compaction/compaction-basic/src/region.ts)：压缩先写 summary 事件，再用带 `sourceEventSeqs` 的 checkpoint user message 替换选中区间。
- [`packages/compaction/compaction/src/checkpoint.ts`](../../../deepseek-harness/packages/compaction/compaction/src/checkpoint.ts)：压缩 checkpoint 使用专属 message source 标记。

## 代码结构

```text
s11_history_projection/
├── README.md
├── deno.json
└── src/
    ├── events.ts
    ├── history.ts
    ├── main.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期先看到原始 user/assistant 对话；压缩后 surface 只保留 checkpoint；新一轮追加后，模型历史由 checkpoint、新 user 和新 assistant 三条消息组成。最后原始事件总数为 12，旧消息仍在日志中。

## 观察结果

- `turn/start`、`turn/end`、`compaction/start`、`compaction/summary` 和 `compaction/end` 都留在日志里，但不生成模型消息。
- `surfaceOp: 'append'` 将消息事件序号追加到当前 surface；`replace` 的起止序号是当前 surface 节点中的闭区间，而不是原始日志区间的任意切片。
- 被替换的每个 surface 节点都要出现在 checkpoint 的 `sourceEventSeqs` 中；它说明 checkpoint 关联了哪些来源记录。
- `deriveEventMessage()` 决定一个 surface 事件是否生成消息。空 assistant 消息会保留在 surface，但不进入 provider transcript。
- 压缩不会删除原始消息。它写入 summary/checkpoint 事实，并更新当前 surface，因此历史可审计、模型上下文也可重建。
- `Session.deriveMessages()` 会缓存派生结果；发生 replace 或消息投影变更时会重建。本例每次从完整事件快照重新 fold，便于看清规则。

## 简化与边界

- 示例独立复刻 `foldSurface()` 的 append/replace 核心，不导入 Harness，也不覆盖完整事件校验、工具配对、system prompt 头部规则、插件消息 projection 和缓存优化。
- 教学投影只展示 user/assistant 两类消息；真实 Harness 还支持 system、developer、tool result 与插件定义的消息 projection。
- checkpoint 内容简化为文本摘要与教学 framing；真实压缩还做消息选择、摘要生成、token 预算、稳定性检查和完整 source 关联。
- 本课只从内存快照重建；持久化与恢复在第 12 课展开。

---

下一课预告：第 12 课「持久化与恢复」会把 Session 事件写入存储，并从中恢复。
