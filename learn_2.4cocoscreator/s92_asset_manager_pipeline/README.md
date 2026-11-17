# 第 92 课：AssetManager 下载什么、创建什么

**本课目标：** 理解 `preload` 和 `load` 的差别，并能区分“文件已下载”和“Asset 对象已创建”。本例继续使用 `SceneAsset → SpriteFrame → Texture2D`。

## 先记住两种缓存

| 缓存 | 缓存的东西 | 本课的观察值 |
| --- | --- | --- |
| 下载文件缓存 | 浏览器取得的文件内容 | 一个 import pack + 一个 PNG，共 2 个 URL |
| Asset 对象 | 反序列化后交给调用者或依赖的对象 | SceneAsset、SpriteFrame、Texture2D，共 3 个对象 |
| 通用 Asset 缓存 | 可按 UUID 复用的普通 Asset | SpriteFrame、Texture2D，共 2 个 UUID；SceneAsset 不进入该表 |

为什么文件是 2 个，Asset 对象是 3 个，而通用缓存里是 2 个？SceneAsset 和 SpriteFrame 是两个不同 UUID，但本次构建把它们打进同一个 import pack；Texture2D 的 PNG 是另一个文件。Creator 2.4.15 的 `utilities.js::cache()` 会跳过 SceneAsset，因此它能从 `load` 返回，但不在 `assetManager.assets` 中。文件、Asset 对象和 Asset 缓存不是一回事。

课程模型根据 AssetRecord 的 type 字符串简化这项判断；引擎 Runtime 由 utilities.js 的场景检测逻辑判别。

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
6. `main.ts` 再调用 `loadAny()`。Loader 读取当前 UUID 对应的序列化条目、递归 load 依赖，然后创建 Texture2D、SpriteFrame 和 SceneAsset。前两者进入通用 Asset 缓存；SceneAsset 返回给调用者但不进此缓存。
7. 重复请求 SpriteFrame 会复用同一 Asset 实例。课程不以 SceneAsset 是否复用来代表普通 Asset 缓存，因为 Runtime 特意跳过 SceneAsset。

页面结果应是：**preload 后 2 个文件 / 0 个缓存对象；load 后 2 个文件 / 2 个通用缓存对象；SceneAsset 被返回但不缓存；重复 load SpriteFrame 复用同一实例。**

## 代码文件按调用顺序读

1. `src/example-files.ts`：真实 UUID、URL 和依赖的课堂摘录；同时用小 Map 假造 pack 内的资源条目。
2. `CCAssetManager.ts`：组装 `fetchPipeline` 与 `pipeline`，对外提供 preload/load。
3. `pipeline.ts`：按顺序调用每个 stage。它传递的 `PipelineTask` 保存 UUID、查到的记录、文件或 Asset。
4. `load.ts`：`preprocess()` 查记录；`fetchTree()` 递归准备文件；`load()` 读取数据、递归依赖并创建 Asset。
5. `fetch.ts`：只负责从课堂 Map 取文件并按 URL 去重。
6. `parser.ts`、`depend-util.ts`、`deserialize.ts`：分别示范读取条目、找依赖、创建对象。

`example-files.ts` 不是 Creator 构建文件：真实 pack 的二进制/序列化格式已简化成 `UUID → 字符串`。这是为了让你能看清 Loader 的职责交接；第 94 课会再把它与实际 Web 请求区分开。

## AssetManager 是协调入口

在 Creator 2.4.15 中，`cc.assetManager` 是单例协调者，不是一个单独的下载函数。它把 Bundle、Config、RequestItem、Pipeline、Downloader、Parser、PackManager、依赖工具和缓存/释放管理接在一起：

| 层 | 负责什么 | 对照源码 |
| --- | --- | --- |
| Bundle / Config | 将 Bundle 内的路径或场景名映射到 UUID、类型和构建记录 | `bundle.js`、`config.js` |
| preprocess | 将输入正规化为带 UUID、请求类型和 URL 信息的 RequestItem | `preprocess.js`、`request-item.js` |
| Downloader / PackManager | 下载普通文件；若是 pack，从一个文件中取出目标 UUID 条目 | `downloader.js`、`pack-manager.js` |
| Parser / deserialize | 按资源类型解析数据并创建 Asset 对象 | `parser.js`、`deserialize.js` |
| dependUtil / load | 递归取得依赖、填入引用，并在完成后缓存适用的 Asset | `depend-util.js`、`load.js`、`utilities.js` |
| ReleaseManager | 按引用与依赖关系尝试回收 Asset 对象及其底层内容 | `releaseManager.js`、`CCAsset.js` |

因此 `preloadAny()` 走 preprocess/fetch 路径，准备文件但不创建 Asset；`loadAny()` 走完整加载路径。真实 Runtime 还维护 `assets`（Asset 对象）、`files`（下载结果）、`parsed`（解析结果）和 `bundles`（Bundle 配置）等不同缓存。本课将下载结果按 URL 建 Map，是为便于观察的模型；2.4 Runtime 的文件缓存键是 RequestItem.id，不是简单 URL。

## 对照 Creator 2.4.15 Runtime

- [CCAssetManager.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js)：AssetManager 如何组装加载管线。
- [preprocess.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/preprocess.js) 与 [request-item.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/request-item.js)：UUID 怎样成为带有请求类型和 ID 的 RequestItem。
- [fetch.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/fetch.js)、[pack-manager.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/pack-manager.js)：文件取得、依赖预取、pack 拆分和文件缓存。
- [load.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/load.js)、[utilities.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/utilities.js)：解析、`loadDepends()`、Asset 缓存策略；其中 SceneAsset 会被跳过。
- [releaseManager.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/releaseManager.js)：引用计数、依赖递减和对象释放。

真实 Runtime 的文件缓存按 RequestItem.id（UUID 加 `@import`/`@native` 类型）组织；PackManager 会把一个下载到的 pack 拆成多个资源条目。本课为了讲清“下载文件”和“创建 Asset”的区别，按 URL 统计下载文件。两种缓存的键不同，不要把课程 Map 当成 Runtime 缓存实现。

## 学完后自查

为什么 preload 结束时没有 SceneAsset？为什么两个 import UUID 只产生一个文件 URL？用自己的话说出 `preprocess → fetch → parse/dependencies → deserialize/cache` 各负责哪一步。下一课单独手算 UUID 到 URL。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
