# 第 0 课：最小插件启动器

**目标：** 看清启动器怎样创建 Context，并把它交给插件的 `apply(ctx)`。

## 本课问题

一个插件需要实现什么？启动器和插件分别负责什么？

## 本课增量

启动器创建最小 Context，再把一个插件交给 `mount()`。插件通过 `apply(ctx)` 输出一条日志；启动器在调用前后打印加载状态。

```text
main.ts
  → createContext()
  → mount(ctx, helloPlugin)
      → helloPlugin.apply(ctx)
```

## 源码对照

- [`vendor/cordis/bin.js`](../../../deepseek-harness/vendor/cordis/bin.js)：真实教程启动器创建 Cordis Context、挂载 Loader，并让 Include Loader 读取 `cordis.yml`。
- [`docs/cordis-tutorial/01-first-plugin.md`](../../../deepseek-harness/docs/cordis-tutorial/01-first-plugin.md)：插件模块导出 `name` 和 `apply(ctx)`，由 Loader 调用。
- [`docs/architecture.md` 的 Cordis 章节](../../../deepseek-harness/docs/architecture.md#cordis)：Harness 的模型、工具、Session 和 AgentLoop 都由插件提供。

## 代码结构

```text
s00_minimal_plugin/
├── README.md
├── deno.json
└── src/
    ├── context.ts
    ├── loader.ts
    ├── main.ts
    ├── types.ts
    └── plugins/
        └── hello.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期输出：

```text
[loader] loading hello
[hello] hello from my first plugin
[loader] loaded hello
```

## 观察结果

`mount()` 持有加载流程，插件只声明自己的 `name` 和 `apply(ctx)`。Context 是启动器与插件之间传递运行能力的对象。下一课会把单一 `log()` 扩展为可注册和读取的 Service。

## 简化与边界

- 示例直接导入插件并调用 `mount()`；真实 Harness 通过 Cordis Loader 解析配置并建立插件树。
- Context 只提供日志函数；本课没有依赖注入、卸载、事件或配置。
- 示例只用来解释调用关系，不依赖真实 Cordis，也不能替代其插件实现。
