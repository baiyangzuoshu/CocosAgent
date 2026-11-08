# 第 2 课：依赖注入

**目标：** 看清插件声明 `inject` 后，Loader 怎样等待需要的 Service 注册，再启动插件。

## 本课问题

消费者在提供者之前进入插件列表时，怎样保证它运行时依赖的服务已经可用？

## 本课增量

`greetingConsumer` 声明 `inject: ['greeter']`。Loader 先检查依赖；服务尚未注册时将消费者保留在 PENDING 列表。提供者注册 `greeter` 后，Loader 再检查等待中的插件并启动消费者。

```text
plugins = [greetingConsumer, greeterProvider]
  → greetingConsumer: PENDING（等待 greeter）
  → greeterProvider: 加载并注册 greeter
  → greetingConsumer: 依赖满足，运行 apply(ctx)
```

## 源码对照

- [`docs/cordis-tutorial/03-services.md`](../../../deepseek-harness/docs/cordis-tutorial/03-services.md)：交换配置中的提供者和消费者顺序，消费者仍在 `greeter` 可用后运行。
- [`vendor/cordis/src/registry.ts`](../../../deepseek-harness/vendor/cordis/src/registry.ts)：插件定义中的 `inject` 声明及其依赖名称归一化。
- [`vendor/cordis/src/fiber.ts`](../../../deepseek-harness/vendor/cordis/src/fiber.ts)：Fiber 保存依赖并根据服务状态进入或离开 PENDING。

## 代码结构

```text
s02_injection/
├── README.md
├── deno.json
└── src/
    ├── context.ts
    ├── loader.ts
    ├── main.ts
    ├── service.ts
    ├── types.ts
    ├── plugins/
    │   ├── greeter-provider.ts
    │   └── greeting-consumer.ts
    └── services/
        └── greeter.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期输出：

```text
[loader] pending greeting-consumer; waiting for greeter
[loader] loading greeter-provider
[loader] loaded greeter-provider
[loader] loading greeting-consumer
[greeting-consumer] Hello, world!
[loader] loaded greeting-consumer
```

## 观察结果

配置把消费者放在提供者前面，但消费者的 `apply()` 仍在服务注册后才运行。删除提供者后重跑，消费者会留在 PENDING 并且不输出问候语；示例 Loader 不把尚未满足的依赖当作启动错误。

这与第 1 课的区别是：消费者不再靠配置行顺序保证服务就绪，而是声明自己需要的服务。Harness 的 Cordis 还会跟踪服务移除和替换，并随依赖变化卸载或重新运行消费者。下一课[生命周期与 effect](../s03_lifecycle_effects/README.md)会说明卸载时如何撤销插件资源。

## 简化与边界

- Loader 只在启动时反复检查依赖，不模拟 Cordis Fiber 对服务注册、移除和替换的持续监听。
- `inject` 只用服务名称数组；Cordis 还支持带拦截配置的对象形式和继承的依赖声明。
- 示例保留一个缺少提供者时的 PENDING 插件，但不提供诊断 UI、HMR 或插件卸载。
