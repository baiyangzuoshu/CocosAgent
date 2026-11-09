# 第 13 课：查询与上下文压缩

**目标：** 从完整事件日志中检索历史，同时把模型当前要看的消息限制在预算内。

## 本课问题

被压缩的旧消息仍然存在，怎样继续查到它们？当模型上下文快到上限时，怎样缩短当前历史而不丢掉近期交互？

## 本课增量

本课把两个相邻但职责不同的能力放在一个示例中观察：查询服务只读完整历史，并标记事件是当前、已被替换还是仅供日志追踪；压缩根据当前消息表面和预算选取较早的连续范围，再用摘要 checkpoint 替换它。搜索历史不会改写模型上下文，压缩也不会删除原始事件。

```text
完整 Session 事件日志
  ├─ query：抽取语义文本 → 匹配结果 + current/shadowed/log-only
  └─ compaction：测量当前 surface → 保留近期尾部
       → 摘要较早范围 → replace 成 checkpoint
```

示例先用一个确定性字符计量器发现历史超出预算，保留系统提示词和近期消息，将旧的两轮对话替换成一条摘要。随后在完整日志中检索 `append-only JSONL`，结果同时包含被压缩的来源消息和当前 checkpoint。

## 源码对照

- [`packages/session-query/session-query/README.zh.md`](../../../deepseek-harness/packages/session-query/session-query/README.zh.md)：查询服务的精确读取、表层读取、过滤和搜索边界。
- [`packages/session-query/session-query/src/documents.ts`](../../../deepseek-harness/packages/session-query/session-query/src/documents.ts)：使用同一 `foldSurface()` 将事件标记为 current、shadowed 或 log-only。
- [`packages/session-query/session-query/src/extraction.ts`](../../../deepseek-harness/packages/session-query/session-query/src/extraction.ts)：按已知事件类型抽取可检索的语义文本。
- [`packages/session-query/session-query/src/filters.ts`](../../../deepseek-harness/packages/session-query/session-query/src/filters.ts)：元数据过滤和字面文本匹配。
- [`packages/session-query/session-query-sqlite/README.zh.md`](../../../deepseek-harness/packages/session-query/session-query-sqlite/README.zh.md)：可选 SQLite FTS5 排名搜索与分页；查询服务本身不要求全文搜索后端。
- [`packages/llm/token-meter/README.md`](../../../deepseek-harness/packages/llm/token-meter/README.md)：模型路由相关的历史计量。
- [`packages/compaction/compaction-basic/src/region.ts`](../../../deepseek-harness/packages/compaction/compaction-basic/src/region.ts)：`selectCompactableRange()` 保留近期预算、避开 system head 并避免拆分工具调用/结果对。
- [`packages/compaction/compaction-basic/src/summarizer.ts`](../../../deepseek-harness/packages/compaction/compaction-basic/src/summarizer.ts)：把摘要包装成可持久化的 checkpoint 内容。
- [`docs/subsystems/compaction.zh.md`](../../../deepseek-harness/docs/subsystems/compaction.zh.md)：压缩事件、替换节点和事务边界。

## 代码结构

```text
s13_query_compaction/
├── README.md
├── deno.json
└── src/
    ├── context-budget.ts
    ├── events.ts
    ├── main.ts
    ├── query.ts
    ├── surface.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期压缩前当前历史为 `609/560` 字符单位；选择 surface seq `3…10`，替换四个旧消息节点。checkpoint 为 423 字符单位，短于被替换范围的 483 单位；压缩后当前历史为 `549/560`，surface 为 `[0, 21, 15, 16]`。完整日志搜索返回 seq 3 和 10（shadowed）以及 seq 21（current）；仅查 current 时只返回 checkpoint。

## 观察结果

- `session-query` 从完整日志读取、筛选或搜索，并提供脱离存储的结果；其查询不会改变 Session。它能显示已经被替换的来源事件仍然可查。
- 真实搜索默认可覆盖 current、shadowed 与 log-only 语义文档，并可按 surface 筛选；SQLite FTS5 是可选的排序全文搜索后端。基础服务的文本过滤是字面匹配，不会把输入当作正则或 FTS 语法。
- `compaction-basic` 使用 `TokenMeter` 计量当前请求路由与 surface，再按保留预算从最新消息向前选尾部，压缩较早的连续范围。位于 surface node 0 的 system prompt 不会被替换；真实选择还会保持工具调用与结果配对。
- 压缩先记录 `compaction/start` 与 `compaction/summary`，再追加 `user/message` checkpoint，用 `surfaceOp: replace` 更新当前表面；`sourceEventSeqs` 关联被替换节点和摘要事务事件，最后记录 `compaction/end`。
- 旧消息仍在原始事件日志中，只是标记为 shadowed；当前模型输入从替换后的 surface 派生。

## 简化与边界

- 示例查询只抽取 user、assistant、system 的文本块，使用不区分大小写、折叠空白后的字面包含匹配；不实现 SQLite 索引、排名、分页游标、取消、完整事件提取或错误分类。
- 预算单位是字符数，不是模型 token；`MAX_CONTEXT_UNITS` 只用于确定性教学。真实 `TokenMeter` 按实际路由、envelope 和内容投影计价。
- 摘要是固定 Fake 文本，不调用模型；checkpoint 仍按前导、摘要和闭合标签计入演示预算，并检查结果小于被替换范围。
- 区间选择演示了 system head 和近期尾部保留，但不处理工具对、图片卸载、工具结果剪枝、路由策略、溢出重试、并发稳定性检查或失败事务恢复。
- 查询与压缩是独立能力。本例为了对比共享同一份日志，不表示 Harness 的查询服务负责构造或触发模型上下文压缩。

---

下一课预告：第 14 课「Agent 接口与注册表」会从消息历史转向运行 Agent 的核心对象。
