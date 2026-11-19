# 第 94 课：从场景路径追到浏览器文件

**本课目标：** 把前 89–93 课接成一条可解释的链：输入场景路径，找到 UUID，生成 RequestItem，取得文件，读出依赖，创建 Asset。读完后你应能分清每一步的输入和输出。

## 先看全链，再读代码

```text
场景路径
  → Bundle Config 查到 SceneAsset UUID
  → RequestItem 带上 UUID、import/native 类型和 URL
  → Fetcher 按 URL 取得文件
  → Parser 从 pack 中取出当前 UUID 的序列化条目
  → depend-util 找到 SpriteFrame / Texture2D UUID
  → 递归创建 Texture2D、SpriteFrame、SceneAsset；普通 Asset 按 UUID 缓存
```

当前例子里的实际关系是：SceneAsset 和 SpriteFrame 在同一个 import pack；Texture2D 指向另一个 PNG 文件。因此最终是 **2 个文件 URL、3 个 Asset 对象，其中 2 个进入通用 Asset 缓存**。Creator 2.4.15 的 utilities.cache 会跳过 SceneAsset；它仍会从 loadScene 返回，但不会因通用 Asset 缓存命中而复用。

## 从入口逐步追踪

### 1. Bundle 把场景名字变成 UUID

在 `src/main.ts`，入口是 `manager.loadScene("db://assets/Scene/helloworld.fire")`。`Bundle.loadScene()` 用这个场景路径查 `BundleConfig`，得到 SceneAsset UUID。场景路径是工程资源名，UUID 才是运行时资源身份。

这份小例子用 `example-assets.ts` 直接保存第 93 课查表后的结果。真实 config 的 `scenes → uuids → packs/versions` 过程已经在第 93 课逐步手算；本课把查找结果接入加载流程。

### 2. preprocess 为请求补齐信息

`Preprocessor` 用 UUID 取得 AssetRecord，再生成 RequestItem。RequestItem 包含 UUID、`import`/`native` 类型和文件 URL。这里的 UUID 回答“要哪个 Asset”，URL 回答“去哪里取文件”。

### 3. Fetcher 取得文件，不创建 Asset

SceneAsset 的请求 URL 是 import pack；SpriteFrame 的 UUID 也指向同一个 URL，因此第二次不再记录一个新 GET。Texture2D 的 URL 指向 native PNG，会产生另一个 GET。`downloaded` 只存文件；此时 Asset 还没创建。

### 4. Parser 和依赖工具取出资源

import 文件里有多个 UUID 条目。Parser 按当前 RequestItem 的 UUID 取一个条目并解析 JSON；`collectDependencies()` 递归找 `__uuid__`，所以先从 Scene 找到 SpriteFrame，再从 SpriteFrame 找到 Texture2D。`__id__` 是文件内部引用，不作为外部 Asset 依赖。

### 5. 依赖先完成，当前 Asset 后创建

Loader 递归处理依赖，先得到 Texture2D，再得到 SpriteFrame，最后得到 SceneAsset。Texture2D 和 SpriteFrame 进入通用 `assets` 缓存；SceneAsset 返回给 Bundle.loadScene 的调用者，但 Runtime 的 utilities.cache 会跳过它。重复请求 SpriteFrame 可命中 Asset 缓存；SceneAsset 是否同实例不能用来代表普通 Asset 缓存行为。

## 本课代码与源码职责对应

| 本课文件 | 它做什么 | Creator 2.4.15 Runtime 对照 |
| --- | --- | --- |
| `CCAssetManager.ts` | 组装 Config、Bundle、缓存和加载管线 | `CCAssetManager.js` |
| `bundle.ts`、`config.ts` | 场景名查 UUID | `asset-manager/bundle.js`、`config.js` |
| `preprocess.ts`、`request-item.ts` | UUID 形成请求项 | `preprocess.js`、`request-item.js` |
| `fetch.ts` | 取得文件 | `fetch.js`、`downloader.js` |
| `parser.ts`、`depend-util.ts` | 解析资源条目、提取 UUID 依赖 | `parser.js`、`depend-util.js` |
| `pipeline.ts`、`load.ts`、`deserialize.ts` | 串接阶段；递归加载、创建和缓存 Asset | `pipeline.js`、`load.js`、`deserialize.js` |
| `CCAsset.ts` | 课程中的最小 Asset 对象 | `assets/CCAsset.js` |

这些源码文件都可从下方链接打开。课程结构保留“Bundle → Config → RequestItem → Fetch/Parse → Dependencies → Asset”的职责边界，只删去并发队列、错误重试、完整序列化兼容和网络实现。

本课模型中，AssetManager.assets 只保存 Texture2D 和 SpriteFrame。SceneAsset 仍被反序列化并由 loadScene 返回，但 2.4.15 Runtime 的 utilities.cache() 会跳过场景资源；所以参与加载的 Asset 对象数是 3，通用对象缓存数是 2。课程里的缓存判断按此版本规则处理。

本课代码通过 AssetRecord.type 字符串简化识别 SceneAsset；Runtime 使用 utilities.js 中的场景检测逻辑。

## 看代码结果时不要混淆两种证据

课程页面显示的 `GET` 来自本课 `Fetcher` 对文件 Map 的模拟，不是浏览器 Network 记录。要看真实请求，在终端进入 `2.4NewProject/build/web-mobile/`，运行：

```sh
python3 -m http.server 8104 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:8104`，在开发者工具 Network 面板过滤 `assets/main`。找到 import pack 和 PNG 请求后，把地址与第 93 课算出的 URL 对比。启动页面还会请求引擎、internal 等文件，因此 Network 总请求数不会等于本课模型的 2。

## 源码入口

- [Bundle `loadScene()`](../../engine/2.4.15engine/cocos2d/core/asset-manager/bundle.js)
- [Config 查表](../../engine/2.4.15engine/cocos2d/core/asset-manager/config.js) 与 [URL 生成](../../engine/2.4.15engine/cocos2d/core/asset-manager/urlTransformer.js)
- [RequestItem](../../engine/2.4.15engine/cocos2d/core/asset-manager/request-item.js)、[fetch](../../engine/2.4.15engine/cocos2d/core/asset-manager/fetch.js)、[pack-manager](../../engine/2.4.15engine/cocos2d/core/asset-manager/pack-manager.js)
- [依赖解析](../../engine/2.4.15engine/cocos2d/core/asset-manager/depend-util.js)、[load](../../engine/2.4.15engine/cocos2d/core/asset-manager/load.js)、[deserialize](../../engine/2.4.15engine/cocos2d/core/asset-manager/deserialize.js)
- [缓存策略](../../engine/2.4.15engine/cocos2d/core/asset-manager/utilities.js)：utilities.cache() 将 SceneAsset 排除在共享 assets 缓存之外。

## 本课必须保留的机制

保留 `Bundle → Config → RequestItem → Fetch/Parse → Dependencies → Asset` 的输入输出交接；一个 import pack 可服务多个 Asset，依赖先创建，SceneAsset 返回但跳过通用 assets 缓存。

## 最小观察宿主

浏览器页面调用课程 `manager.loadScene()`，以本地 AssetRecord/文件 Map 走完整模型并显示各阶段；`GET` 计数是 Fetcher 模拟。需要验证真实请求时按上文单独运行 `2.4NewProject/build/web-mobile/` 并查看 Network 面板。

## 模型化简化与 Creator Runtime 边界

课程只保留本场景所需字段和职责，按 `AssetRecord.type` 识别 SceneAsset，Fetcher 从 Map 取数据；省略真实网络、完整序列化兼容、并发队列、错误重试。页面计数不是浏览器 Network 证据，也不是完整 Creator AssetManager。

## 学完后自查

不用看页面，按顺序讲出“场景路径、UUID、URL、文件、Asset”分别在何时出现。再说清本例 3 个 Asset 对象与 2 个通用缓存对象的区别，以及为什么 SceneAsset 是例外。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
