# 第 7 课：Loader 组合

**目标：** 看清 Loader 如何读取插件配置、按稳定 `id` 保留未变项，并卸载或重挂载发生变化的插件。

## 本课问题

配置文件编辑后，Loader 怎样判断哪些插件要保持运行、启用、卸载或重新加载？

## 本课增量

三个 JSON 文件代表连续读取的三版插件配置。Loader 按 `id` 对照当前运行项和新配置：未变项保持不动，禁用或移除项卸载，配置改变的项先卸载再重挂载。

```text
initial.json
  → logger 启动
  → greeting v1 启动
  → metrics 被禁用
updated.json
  → logger 保持运行
  → greeting 更新为 v2
  → metrics 启动
final.json
  → greeting 被移除
  → logger 和 metrics 保持运行
```

## 源码对照

- [`docs/cordis-tutorial/06-composition-and-hmr.md`](../../../deepseek-harness/docs/cordis-tutorial/06-composition-and-hmr.md)：配置项的稳定 `id`、`disabled`、配置文件更新和插件 HMR。
- [`vendor/cordis/src/registry.ts`](../../../deepseek-harness/vendor/cordis/src/registry.ts)：Cordis Registry 如何解析和注册插件。
- [`vendor/cordis/src/fiber.ts`](../../../deepseek-harness/vendor/cordis/src/fiber.ts)：Fiber 如何管理单个插件实例及其卸载。

## 代码结构

```text
s07_loader_composition/
├── README.md
├── deno.json
└── src/
    ├── configs/
    │   ├── final.json
    │   ├── initial.json
    │   └── updated.json
    ├── main.ts
    ├── plugin-registry.ts
    ├── types.ts
    └── loader.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期输出：

```text
--- load initial config ---
[loader] mount id=logger name=logger
[logger] started
[loader] mount id=greeting name=greeting
[greeting] hello from v1
[loader] skip id=metrics (disabled)
--- apply edited config ---
[loader] unmount id=greeting
[greeting] stopped
[loader] keep id=logger
[loader] mount id=greeting name=greeting
[greeting] hello from v2
[loader] mount id=metrics name=metrics
[metrics] started
--- apply config with greeting removed ---
[loader] unmount id=greeting
[greeting] stopped
[loader] keep id=logger
[loader] keep id=metrics
[loader] unmount id=metrics
[metrics] stopped
[loader] unmount id=logger
[logger] stopped
```

## 观察结果

配置项的 `id` 将配置记录与当前实例对应起来。Loader 只替换配置变化的 `greeting` 项；同一份配置中未变的 `logger` 不会重启。`disabled` 保留配置项但不挂载；后续启用它时，Loader 才启动插件。

## 简化与边界

- 示例使用 JSON 文件作为配置输入，不解析 YAML；每个文件代表一次配置读取，没有文件监听器。
- 本课实现的是稳定 `id` 下的配置差异更新。Harness 的代码 HMR 依赖 Node Loader 内部机制；这里仅对照官方 HMR 资料，不声称复刻了模块替换。
- 配置变化检测用 JSON 序列化比较；Cordis 还会处理插件配置 Schema、依赖状态、分组、服务隔离和更细致的 Fiber 更新。

下一课：[Profile、Bundle 与 patch](../s08_profile_bundle_patch/README.md) 会把多层插件配置组合成一份最终应用树。
