# 第 89 课：先看懂 Web 构建目录

**本课目标：** 在 Creator 3.8 的 Web 构建输出中认出页面入口、启动设置、Bundle 索引和资源文件。这里先认位置，不需要理解 UUID 怎么生成。

## 先区分三种目录

- `3.8NewProject/assets/`：工程输入，场景、Prefab、FBX 和 `.meta` 在这里。
- `3.8NewProject/build/web-mobile/`：当前 Web 构建输出，浏览器从这里加载脚本、索引和资源。
- `engine/3.8.7engine/`：Runtime 源码快照，解释运行时怎样读取输出；它不是完整 Editor Builder。

构建会把工程资源整理成 Runtime 能查找的形式。`config.json` 是索引；`import` 文件存序列化资源条目；`native` 文件存 Mesh 等单独数据。它们分别承担不同工作。

## 按浏览器运行顺序看文件

打开 `3.8NewProject/build/web-mobile/`：

| 文件 | 它负责什么 | 本课要观察的内容 |
| --- | --- | --- |
| `index.html` | 浏览器页面 | 页面加载入口 |
| `application.js`、`index.js`、`cocos-js/cc.js` | 应用启动、项目入口、引擎代码 | 这几类脚本用途不同，不是资源包 |
| `src/settings.json` | 启动配置 | `launch.launchScene`、`assets.preloadBundles`、`assets.projectBundles` |
| `assets/main/config.json` | main Bundle 的资源索引 | `scenes`、`uuids`、`packs`、`versions` |
| `assets/main/import/06/0693a7d89.json` | 场景和 Prefab 等序列化数据 | 一个 pack 可包含多个 Asset 条目 |
| `assets/main/native/e3/e3553cad-2f15-4293-859a-8f43c780f289@18751.bin` | Mesh 的独立数据文件 | 与 `@18751` 子资源 UUID 对应 |

当前 `settings.json` 的首场景是 `db://assets/scene/main.scene`；`assets.projectBundles` 列出 `internal` 和 `main`，本次输出也只有这两个 Bundle。Bundle 是一组资源的发布单元。

注意 `preloadBundles` 表示启动时预加载的 Bundle，`projectBundles` 表示项目输出中登记的 Bundle；这两个字段回答不同问题。当前输出没有 `BundleMain`，但不能只凭这个结果推断它为什么没有生成。

## 再读本课代码

`src/example-build.ts` 是从当前构建目录抄出的文件清单；`BundleOutputMap.ts` 负责给清单加角色说明；`src/main.ts` 负责显示。代码**不扫描目录，也不执行构建**。它的价值是把文件角色摆在一起，真正的文件存在与否仍回到 `build/web-mobile/` 检查。

## 对照 Runtime 源码

当前样例由 Creator 3.8.8 构建，本地源码快照为 3.8.7：

- [asset-manager.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/asset-manager.ts)：搜索 `loadBundle`。
- [bundle.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/bundle.ts)：搜索 `loadScene`，看场景名怎样进入加载流程。
- [config.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/config.ts)：从 `_initScene()`、`_initUuid()` 看 Runtime 如何使用构建索引。

## 学完后自查

自己指出页面、启动设置、资源索引、import pack、native 文件在哪里。再说明：`config.json` 是资源内容本身，还是找到资源内容的索引？下一课从 FBX `.meta` 追子资源 UUID。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
