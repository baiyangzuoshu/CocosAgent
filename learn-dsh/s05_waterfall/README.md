# 第 5 课：Waterfall

**目标：** 理解监听器怎样调用 `next()` 继续处理、包装下游结果，或不调用 `next()` 而短路。

## 本课问题

如何在不让事件发送者依赖某个具体策略插件的前提下，允许多个插件共同处理一个决定？

## 本课增量

Waterfall 按注册顺序调用监听器。第一个监听器等待 `next()` 的结果并转成大写；第二个监听器允许普通输入继续，遇到 `blocked` 时直接返回替代结果。只有继续到最内层时，默认处理函数才会运行。

```text
input
  → transform listener
      → policy listener
          → fallback
      ← policy result
  ← transform result
```

## 源码对照

- [`docs/cordis-primer.md` 的 Waterfall 语义](../../../deepseek-harness/docs/cordis-primer.md#cordis-waterfall-semantics)：监听器通过 `next()` 委派下游，未委派则短路。
- [`docs/cordis-tutorial/04-events.md`](../../../deepseek-harness/docs/cordis-tutorial/04-events.md)：展示结果变换和策略短路。
- [`docs/cordis-api/events.md`](../../../deepseek-harness/docs/cordis-api/events.md)：Cordis 事件 API 的 `waterfall` 描述。
- [`vendor/cordis/src/events.ts`](../../../deepseek-harness/vendor/cordis/src/events.ts)：Cordis 从外层监听器逐层调度到默认 `next`。

## 代码结构

```text
s05_waterfall/
├── README.md
├── deno.json
└── src/
    ├── main.ts
    └── waterfall.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期输出：

```text
--- pass-through ---
[transform] enter: hello
[policy] pass
[fallback] handle: hello
[transform] wrap result
HELLO
--- blocked ---
[transform] enter: blocked words
[policy] block
[transform] wrap result
** BLOCKED **
```

## 观察结果

`hello` 经过两个监听器后到达默认处理函数；结果再返回到外层，被转换为大写。`blocked words` 在策略监听器处被短路，默认处理函数没有运行，但外层监听器仍能包装策略返回值。

只做观察或附加日志的监听器必须调用 `next()`。漏掉它会让后面的策略和默认处理静默跳过；不调用 `next()` 应当是明确的决策。

## 练习

添加一个只在输入前后输出日志的监听器，并确保它调用 `next()`。再移除这次委派，观察后续监听器和默认处理函数如何被跳过。

## 简化与边界

- 示例只传递一个字符串和一个异步默认处理函数；Cordis 支持多参数事件、`thisArg` 和类型化 `Events`。
- `next()` 在同一个监听器中最多调用一次；多次调用会抛错，与 Cordis 的限制一致。
- 示例不实现 Fiber、Context 注入或监听器卸载；这些机制分别见前面的课程。

下一课：[配置与校验](../s06_config_validation/README.md) 会说明插件如何声明运行时配置并在启动前校验。
