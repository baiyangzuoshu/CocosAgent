# 第 4 课：事件分发

**目标：** 比较 `emit`、`parallel` 和 `serial` 如何调用监听器及等待其结果。

## 本课问题

事件发送者不需要知道监听者是谁；但它怎样决定是否等待监听者、是否按顺序执行？

## 本课增量

一个 EventBus 保存同一事件的三个异步监听器。监听器 A、B、C 分别等待不同时间；B 返回 `handled`。三种 dispatch 方法使用同一组监听器，比较开始顺序、完成顺序和最终结果。

```text
emit     → 依注册顺序调用；不等待 Promise
parallel → 同时调用；等待所有 Promise
serial   → 依注册顺序逐个等待；遇到有效返回值就停止
```

## 源码对照

- [`docs/cordis-tutorial/04-events.md`](../../../deepseek-harness/docs/cordis-tutorial/04-events.md)：事件声明、监听，以及 `emit`、`parallel`、`serial` 和 `waterfall` 的使用。
- [`docs/cordis-api/events.md`](../../../deepseek-harness/docs/cordis-api/events.md)：Cordis 事件分发 API 的返回和等待语义。
- [`vendor/cordis/src/events.ts`](../../../deepseek-harness/vendor/cordis/src/events.ts)：分发函数的运行实现。

## 代码结构

```text
s04_event_dispatch/
├── README.md
├── deno.json
└── src/
    ├── event-bus.ts
    └── main.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期输出：

```text
--- emit ---
[emit] A start
[emit] B start
[emit] C start
[main] emit returned without waiting
[emit] B done
[emit] C done
[emit] A done
--- parallel ---
[parallel] A start
[parallel] B start
[parallel] C start
[parallel] B done
[parallel] C done
[parallel] A done
[main] parallel returned after all listeners
--- serial ---
[serial] A start
[serial] A done
[serial] B start
[serial] B done
[main] serial result: handled
```

## 观察结果

`emit()` 立即返回，异步监听仍在后台完成；`parallel()` 同时启动监听并等到全部完成；`serial()` 逐个等待，B 返回 `handled` 后不再启动 C。Cordis 的 `serial` 会把第一个非 `null`、`false` 或 `undefined` 的返回值作为 bail 结果。

## 简化与边界

- EventBus 只包含一种事件和三种 dispatch 方法；Cordis 还提供 `bail` 与 `waterfall`，其中 `waterfall` 在下一课讲解。
- 教学版没有 TypeScript `Events` 声明合并、事件名类型映射或 Cordis 的 `thisArg`。
- `emit()` 中异步监听器的错误处理不在本课范围内；核心观察是返回值不等待、不收集。

下一课：[Waterfall](../s05_waterfall/README.md) 会展示监听器怎样包装下游结果或有意短路。
