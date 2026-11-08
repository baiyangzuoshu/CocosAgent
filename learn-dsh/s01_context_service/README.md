# 第 1 课：Context 与 Service

**目标：** 理解插件如何通过 Context 注册具名 Service，并由其他插件读取和使用。

## 本课问题

两个插件怎样共享一项能力，同时避免消费者直接创建或导入提供者的实现？

## 本课增量

`GreeterService` 在构造时把自身注册到 Context 的 `greeter` 名称下。消费者从 `ctx.greeter` 取得服务并调用 `greet()`。启动器先加载提供者，再加载消费者。

```text
main.ts
  → mount(greeterProvider)
      → new GreeterService(ctx)
          → ctx.provide('greeter', service)
  → mount(greetingConsumer)
      → ctx.greeter.greet('world')
```

## 源码对照

- [`docs/cordis-tutorial/03-services.md`](../../../deepseek-harness/docs/cordis-tutorial/03-services.md)：示例 Service 通过 `super(ctx, 'greeter')` 注册；消费者读取 `ctx.greeter`。
- [`vendor/cordis/src/service.ts`](../../../deepseek-harness/vendor/cordis/src/service.ts)：Cordis 的 `Service` 调用 `ctx.reflect.provide()` 注册实例；注册随所属插件卸载而移除。
- [`docs/cordis-api/context.md`](../../../deepseek-harness/docs/cordis-api/context.md)：Context 提供服务访问，并通过代理解析具名服务。

## 代码结构

```text
s01_context_service/
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
[loader] loading greeter-provider
[loader] loaded greeter-provider
[loader] loading greeting-consumer
[greeting-consumer] Hello, world!
[loader] loaded greeting-consumer
```

## 观察结果

消费者调用的是 Context 上的服务名，不负责选择或构造具体提供者。这个快照依靠启动器先加载提供者，因而尚未处理配置顺序变化或依赖缺失。下一课[依赖注入](../s02_injection/README.md)会让 Loader 根据服务依赖决定消费者何时运行。

## 简化与边界

- 教学版 `Service` 通过 `Context.provide()` 注册；Cordis 使用 `Service` 基类和 `ctx.reflect.provide()`，并将注册绑定到插件 Fiber 的生命周期。
- 教学版 Context 用运行时 getter 暴露服务，并用 TypeScript 声明合并描述 `ctx.greeter` 的类型；Cordis 还有服务代理、作用域和依赖跟踪。
- 本课按固定顺序挂载提供者和消费者，不实现 `inject`、卸载或热重载。
