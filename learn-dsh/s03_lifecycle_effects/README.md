# 第 3 课：生命周期与 effect

**目标：** 理解插件怎样把外部资源的清理函数交给自己的生命周期管理。

## 本课问题

插件创建的监听器、计时器或连接，怎样在插件卸载时可靠地释放？

## 本课增量

消息源提供 `subscribe()`，调用后返回取消订阅函数。插件在 `ctx.effect()` 中订阅并返回取消函数；Fiber 卸载时按反向注册顺序执行它所拥有的清理函数。

```text
loader.mount(plugin)
  → plugin.apply(ctx)
      → ctx.effect(setup)
          → messages.subscribe(listener)
          → return unsubscribe
  → fiber.dispose()
      → unsubscribe()
```

## 源码对照

- [`docs/cordis-tutorial/02-lifecycle-and-effects.md`](../../../deepseek-harness/docs/cordis-tutorial/02-lifecycle-and-effects.md)：用 `ctx.effect()` 管理定时器，并通过 `fiber.dispose()` 卸载插件。
- [`docs/cordis-api/fiber.md`](../../../deepseek-harness/docs/cordis-api/fiber.md)：`ctx.effect()` 将清理函数注册到当前 Fiber。
- [`vendor/cordis/src/fiber.ts`](../../../deepseek-harness/vendor/cordis/src/fiber.ts)：Fiber 保存效果并在卸载阶段清理。

## 代码结构

```text
s03_lifecycle_effects/
├── README.md
├── deno.json
└── src/
    ├── context.ts
    ├── feed.ts
    ├── fiber.ts
    ├── loader.ts
    ├── main.ts
    ├── types.ts
    └── plugins/
        └── message-listener.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期输出：

```text
[loader] loading message-listener
[message-listener] subscribed
[loader] loaded message-listener
[main] publish before unload
[message-listener] message: before unload
[main] unload plugin
[fiber] unloading message-listener
[message-listener] unsubscribed
[fiber] unloaded message-listener
[main] publish after unload
```

最后一次发布没有触发监听器，说明卸载时取消订阅成功。

## 观察结果

effect 的设置函数在插件加载时立即运行；它返回的 disposer 由当前 Fiber 持有。调用 `fiber.dispose()` 后，插件留下的外部注册随之撤销。

## 简化与边界

- 示例只管理订阅，不实现 Cordis 的完整 Fiber 状态机、子插件树或 PENDING 状态。
- 教学版按反向注册顺序逐个等待清理；Cordis 也按反向顺序启动 disposer，但多个异步 disposer 可以并发完成。
- Cordis 自带的服务注册和 `ctx.on()` 已经是 effect；本课用独立消息源演示需要手动包进 `ctx.effect()` 的外部资源。
