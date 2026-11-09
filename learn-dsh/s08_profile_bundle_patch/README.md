# 第 8 课：Profile、Bundle 与 patch

**目标：** 看清 Profile 选择哪些 Bundle，以及后续 patch 怎样按 `id` 修改最终插件树。

## 本课问题

多个 Bundle 和用户 patch 依次应用时，哪一层的配置最终生效？

## 本课增量

示例按顺序合成 base Bundle、headless Bundle、Profile 自己的 patch、Harness home patch 和 `--patch` 覆盖。它从空列表插入插件项，再通过稳定 `id` 修改项；后应用的层覆盖先前层写入的字段。

```text
空插件列表
  → @deepseek-ai/dsh-base
  → @deepseek-ai/dsh-headless
  → Profile patch
  → Harness home patch
  → --patch
  → 最终插件树
```

## 源码对照

- [`docs/architecture.md#profiles-and-bundles`](../../../deepseek-harness/docs/architecture.md#profiles-and-bundles)：Profile 选择有序 Bundle，并叠加各层 patch。
- [`packages/bundle/README.md`](../../../deepseek-harness/packages/bundle/README.md)：各 Bundle 的职责与 Profile 组合方式。
- [`packages/bundle/headless/cordis.patch.yml`](../../../deepseek-harness/packages/bundle/headless/cordis.patch.yml)：headless Bundle 如何补充启动插件并覆盖配置。
- [`packages/boot/app-boot/src/profile.ts`](../../../deepseek-harness/packages/boot/app-boot/src/profile.ts)：按 Bundle 顺序读取 patch，再应用 Profile、home 和启动参数层。
- [`vendor/include/src/patch.ts`](../../../deepseek-harness/vendor/include/src/patch.ts)：按 `id` 定位插件项、插入项目及字段覆盖规则。

## 代码结构

```text
s08_profile_bundle_patch/
├── README.md
├── deno.json
└── src/
    ├── compose.ts
    ├── layers.ts
    ├── main.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期最终插件树会保留前面 Bundle 插入的顺序；`hmr`、`credentials` 和 `headless-runner` 被禁用，`sandbox-policy` 使用最后一个 `--patch` 的配置，Profile 插入的 `profile-metrics` 仍在树中。

## 观察结果

- Bundle 的顺序来自 Profile 声明；这里先应用 base，再应用 headless。
- 插入项进入组合列表。之后的层可用相同 `id` 覆盖已有项。
- 覆盖按字段进行。`disabled` 和 `inject` 等字段分别覆盖；`config` 字段本身被整体替换，不会递归合并对象。
- 用户 patch 需要重新写出希望保留的完整 `config`。示例最后一层明确重写 `mode`、`workspaceRoot` 和 `additionalWritableRoots`。
- patch 的 `name` 在本课只作目标名称校验，不会替换插件名。

## 简化与边界

- 示例直接用 TypeScript 对象表达层，不读取 package manifest 或 YAML，也不做 npm 包解析、Profile 初始化、HMR 或插件启动。
- 只实现根列表插入，不实现 Cordis 的 group、preset 内嵌 patch、`!!js` 表达式、复杂校验与完整错误处理。
- 为保证演示可重复，示例要求插入项提供唯一 `id`；真实 Loader 会为缺少 id 的项补生成身份。

---

下一课：[CLI 与 Headless 启动](../s09_cli_headless_boot/README.md) 会从命令入口追到选定 Profile 的启动过程。
