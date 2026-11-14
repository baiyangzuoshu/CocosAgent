# 第 92 课：AssetManager 下载什么、创建什么

**本课目标：** 理解 `preload` 和 `load` 的差别，并能区分“文件已下载”和“Asset 对象已创建”。本例继续使用 `SceneAsset → SpriteFrame → Texture2D`。

## 先记住两种缓存

| 缓存 | 缓存的东西 | 本课的观察值 |
| --- | --- | --- |
| 下载文件缓存 | 浏览器取得的文件内容 | 一个 import pack + 一个 PNG，共 2 个 URL |
| Asset 缓存 | 解析后可供引擎使用的对象 | SceneAsset、SpriteFrame、Texture2D，共 3 个 UUID |

为什么文件是 2 个、Asset 是 3 个？SceneAsset 和 SpriteFrame 是两个不同 UUID，但本次构建把它们打进同一个 import pack；Texture2D 的 PNG 是另一个文件。文件和 Asset 不是一回事。

## `preload` 只准备数据，`load` 才创建对象

课程代码把两条管线写在 `src/cocos2d/core/asset-manager/CCAssetManager.ts`：

```text
preload: preprocess → fetch
load:    preprocess → load
```

按页面运行顺序理解：

1. `src/main.ts` 对场景 UUID 调用 `preloadAny()`。
2. `preprocess()` 用 UUID 找到本课的 `AssetRecord`，得到类型和 URL。真实 Runtime 会经 Config/URL 转换构造 RequestItem；本课把结果提前写在记录里。
3. `fetchTree()` 取得 Scene 所在的 import pack。它读取课程样例中摘录的依赖字段，继续确认 SpriteFrame 和 Texture2D 需要准备哪些文件。
4. Scene 与 SpriteFrame 的 URL 相同，因此文件缓存只取一次；Texture2D 指向 PNG，再取一次。
5. 此时 `downloaded.size` 是 2，`assets.size` 是 0：只有文件准备好了，还没有 Asset 对象。
6. `main.ts` 再调用 `loadAny()`。Loader 读取当前 UUID 对应的序列化条目，递归 load 依赖，最后创建并缓存 Texture2D、SpriteFrame、SceneAsset。
7. 第二次 load 同一个场景 UUID，先命中 Asset 缓存，直接返回之前的 SceneAsset。

页面结果应是：**preload 后 2 个文件 / 0 个 Asset；load 后 2 个文件 / 3 个 Asset；再次 load 复用同一场景对象。**

## 代码文件按调用顺序读

1. `src/example-files.ts`：真实 UUID、URL 和依赖的课堂摘录；同时用小 Map 假造 pack 内的资源条目。
2. `CCAssetManager.ts`：组装 `fetchPipeline` 与 `pipeline`，对外提供 preload/load。
3. `pipeline.ts`：按顺序调用每个 stage。它传递的 `PipelineTask` 保存 UUID、查到的记录、文件或 Asset。
4. `load.ts`：`preprocess()` 查记录；`fetchTree()` 递归准备文件；`load()` 读取数据、递归依赖并创建 Asset。
5. `fetch.ts`：只负责从课堂 Map 取文件并按 URL 去重。
6. `parser.ts`、`depend-util.ts`、`deserialize.ts`：分别示范读取条目、找依赖、创建对象。

`example-files.ts` 不是 Creator 构建文件：真实 pack 的二进制/序列化格式已简化成 `UUID → 字符串`。这是为了让你能看清 Loader 的职责交接；第 94 课会再把它与实际 Web 请求区分开。

## 对照 Creator 2.4.15 Runtime

- [CCAssetManager.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js)：AssetManager 如何组装加载管线。
- [preprocess.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/preprocess.js) 与 [request-item.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/request-item.js)：UUID 怎样成为带有请求类型和 ID 的 RequestItem。
- [fetch.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/fetch.js)、[pack-manager.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/pack-manager.js)：文件取得、依赖预取、pack 拆分和文件缓存。
- [load.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/load.js)：解析、`loadDepends()` 和 Asset 缓存。

真实 Runtime 的文件缓存按 RequestItem.id（UUID 加 `@import`/`@native` 类型）组织；PackManager 会把一个下载到的 pack 拆成多个资源条目。本课为了讲清“下载文件”和“创建 Asset”的区别，按 URL 统计下载文件。两种缓存的键不同，不要把课程 Map 当成 Runtime 缓存实现。

## 学完后自查

为什么 preload 结束时没有 SceneAsset？为什么两个 import UUID 只产生一个文件 URL？用自己的话说出 `preprocess → fetch → parse/dependencies → deserialize/cache` 各负责哪一步。下一课单独手算 UUID 到 URL。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
