# 第 92 课：AssetManager 下载什么、创建什么

**本课目标：** 理解 `preload` 和 `load` 的差别，并能区分“文件已下载”和“Asset 对象已创建”。本例继续使用 `SceneAsset → Prefab → Mesh`。

## 先记住两种缓存

| 缓存 | 缓存的东西 | 本课的观察值 |
| --- | --- | --- |
| 下载文件缓存 | 浏览器取得的文件内容 | 一个 import pack + 一个 Mesh 文件，共 2 个 URL |
| Asset 缓存 | 解析后可供引擎使用的对象 | SceneAsset、Prefab、Mesh，共 3 个 UUID |

SceneAsset 和 Prefab 是两个 Asset，但本次构建把它们放进同一个 import pack；Mesh `@18751` 的 `.bin` 是另一个文件。因此不能用 Asset 数量推算网络请求数量。

## `preload` 只准备数据，`load` 才创建对象

打开 `src/cocos/asset/asset-manager/asset-manager.ts`，可以看到本课照源码职责建立两条小管线：

```text
preload: preprocess → fetch
load:    preprocess → load
```

按页面运行顺序理解：

1. `src/main.ts` 从场景 UUID 调用 `preloadAny()`。
2. `preprocess()` 用 UUID 查课堂 `AssetRecord`，得到资源类型和 URL。真实 Runtime 会经过 Bundle Config、URL 转换和 RequestItem；本课把已算出的结果放进记录。
3. `fetchTree()` 取得场景所在的 import pack，查看样例中的依赖字段，再准备 Prefab 和 Mesh 对应的数据。
4. SceneAsset 和 Prefab 共用 pack URL，只取得一次；Mesh 是另一个 URL。
5. preload 后 `downloaded.size` 是 2、`assets.size` 是 0：数据已准备，但没有创建 Asset。
6. `loadAny()` 再读取各 UUID 对应的序列化条目，递归加载依赖，反序列化后调用本课 Asset 的 `onLoaded()`，按 UUID 缓存对象。
7. 第二次 load 场景 UUID 时，直接返回缓存里的 SceneAsset。

页面结果应是：**preload 后 2 个文件 / 0 个 Asset；load 后 2 个文件 / 3 个 Asset；再次 load 复用同一场景对象。**

## 代码文件按调用顺序读

1. `src/example-files.ts`：从当前工程摘出的 UUID、URL、依赖关系；并把真实资源文件简化为小型 pack 表。
2. `asset-manager.ts`：组装 `fetchPipeline` 和 `pipeline`，公开 preload/load。
3. `pipeline.ts`：按顺序执行 stage，并把 `PipelineTask` 传给下一步。
4. `load.ts`：`preprocess()` 查资源记录；`fetchTree()` 递归准备文件；`load()` 递归创建依赖并缓存 Asset。
5. `fetch.ts`：课堂模型从 Map 取文件，按 URL 复用下载结果。
6. `parser.ts`、`depend-util.ts`、`deserialize.ts`：分别读取资源条目、取出依赖、创建 Asset 对象。

注意 `example-files.ts` 不是构建产物：它把真实 pack 简化成 `UUID → 资源字符串`，把 Mesh 文件简化成一个名称。请先理解 Loader 的步骤，再对照下方 Runtime 源码里的真实下载和 pack 处理。

## 对照 Creator 3.8.7 Runtime

- [asset-manager.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/asset-manager.ts)：加载管线和 URL 转换管线的组装。
- [preprocess.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/preprocess.ts)、[request-item.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/request-item.ts)：如何形成运行时请求。
- [fetch.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/fetch.ts)、[pack-manager.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/pack-manager.ts)：下载、pack 处理和资源条目缓存。
- [load.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/load.ts)：解析、`loadDepends()`、`asset.onLoaded()` 与 Asset 缓存。
- [asset.ts](../../engine/3.8.7engine/cocos/asset/assets/asset.ts)：运行时 Asset 基类。

Runtime 的 files cache 使用 RequestItem.id（UUID 加 `@import`/`@native` 类型）索引；课程代码按 URL 统计“下载文件”。pack 下载一次后会拆出多个 UUID 条目。样例由 Creator 3.8.8 构建，本地源码快照为 3.8.7；结论以各自证据范围为准。

## 学完后自查

preload 后已经有文件，为什么还没有 Prefab 对象？一个 pack 为什么能对应两个 Asset？用自己的话说出 `preprocess → fetch → parse/dependencies → deserialize/cache` 各做什么。下一课单独手算 UUID 到 URL。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
