# 第 6 课：配置与校验

**目标：** 理解插件怎样声明配置 Schema，Loader 怎样先补默认值、校验输入，再调用插件。

## 本课问题

配置文件提供的值不完整或类型错误时，如何避免插件在半配置状态下启动？

## 本课增量

`greetingPlugin` 声明 `GreetingConfigSchema`。Loader 将原始配置作为 `unknown` 交给 Schema；缺省字段获得默认值，字段类型错误则抛出校验错误。只有成功解析后的配置才会传入 `apply()`。

```text
raw config
  → ConfigSchema.parse()
      → invalid: throw before apply()
      → valid: defaults + typed config
          → plugin.apply(ctx, config)
```

## 源码对照

- [`docs/cordis-tutorial/05-config.md`](../../../deepseek-harness/docs/cordis-tutorial/05-config.md)：用 Schemastery 为 `greeting` 和 `targets` 声明类型、默认值及无效输入行为。
- [`vendor/cordis/src/registry.ts`](../../../deepseek-harness/vendor/cordis/src/registry.ts)：插件元数据中的 `Config` 使用 Standard Schema 验证器。
- [`vendor/cordis/src/fiber.ts`](../../../deepseek-harness/vendor/cordis/src/fiber.ts)：插件运行前执行 Schema 验证；验证失败时插件不会进入正常加载。

## 代码结构

```text
s06_config_validation/
├── README.md
├── deno.json
└── src/
    ├── context.ts
    ├── greeting-plugin.ts
    ├── loader.ts
    ├── main.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期输出：

```text
[loader] validating greeting
[loader] loading greeting
[greeting] Hello, alpha!
[greeting] Hello, beta!
[loader] loaded greeting
--- invalid config ---
[loader] validating greeting
[main] invalid config: $.targets expected array of strings
```

无效配置没有出现 `[loader] loading greeting` 或插件输出，说明 `apply()` 未运行。

## 观察结果

第一个配置没有提供 `greeting`，Schema 将它补为 `Hello`，同时保留 `targets`。第二个配置把 `targets` 写成字符串，Loader 在调用 `apply()` 前报告路径和预期类型。

## 简化与边界

- 示例实现一个只支持字符串与字符串数组默认值的 Schema，不依赖 Schemastery。
- Cordis 接受 Standard Schema 验证器，并把校验失败记录为插件 Fiber 的失败；本例捕获错误后继续展示输出，实际 CLI 可能以非零状态退出。
- 本课不实现 volatile 配置、配置表单或配置变更后的 Fiber 更新。
