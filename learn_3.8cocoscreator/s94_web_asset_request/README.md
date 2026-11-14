# 第 94 课：从场景路径追到浏览器文件

**本课目标：** 把前 89–93 课接成一条可解释的链：输入场景路径，找到 UUID，生成 RequestItem，取得文件，读出依赖，创建 Asset。读完后你应能分清每一步的输入和输出。

## 先看全链，再读代码

```text
场景路径
  → Bundle Config 查到 SceneAsset UUID
  → RequestItem 带上 UUID、import/native 类型和 URL
  → Fetcher 按 URL 取得文件
  → Parser 从 pack 中取出当前 UUID 的序列化条目
  → depend-util 找到 Prefab / Mesh UUID
  → 递归创建 Mesh、Prefab、SceneAsset 并按 UUID 缓存
```

当前例子里 SceneAsset 和 Prefab 是两个 Asset，但在同一个 import pack；Mesh `@18751` 是另一个 native 文件。因此最终是 **2 个文件 URL、3 个 Asset 对象**。

## 从入口逐步追踪

### 1. Bundle 把场景名字变成 UUID

`src/main.ts` 调用 `manager.loadScene("db://assets/scene/main.scene")`。`Bundle.loadScene()` 通过 `BundleConfig` 查到 SceneAsset UUID。场景路径是工程里的名字，UUID 才是运行时资源身份。

`example-assets.ts` 保存第 93 课查表后的结果；第 93 课已逐步说明如何从真实 config 的 `scenes → uuids → packs` 得出结果。本课重点是把结果传给加载管线。

### 2. preprocess 生成 RequestItem

`Preprocessor` 用 UUID 查 AssetRecord，生成带有 UUID、`import`/`native` 类型和 URL 的 RequestItem。UUID 回答“加载哪个 Asset”；URL 回答“去哪里取文件”。

### 3. Fetcher 取得文件

SceneAsset 和 Prefab 的 URL 相同，Fetcher 只记录一次 pack GET。Mesh 的 URL 指向 `.bin` 文件，单独产生一个 GET。此时 `downloaded` 里有两个文件，`assets` 还没有对象。

### 4. Parser 取当前 UUID 的条目

import pack 可以包含多个 UUID。Parser 按 RequestItem 中的 UUID 从 pack 里取出对应场景或 Prefab 条目；它不是每次都把整个 pack 当成一个 Asset。native 分支在本课只用文件名表示 Mesh 数据。

### 5. 依赖工具发现引用，Loader 递归创建

`collectDependencies()` 从 Scene 序列化片段找到 Prefab UUID，再从 Prefab 片段找到 Mesh UUID。Loader 递归处理依赖，先创建 Mesh，再创建 Prefab，最后创建 SceneAsset。每个 Asset 进入按 UUID 索引的对象缓存；第二次加载场景时直接命中 SceneAsset。

## 本课代码与源码职责对应

| 本课文件 | 它做什么 | Creator 3.8.7 Runtime 对照 |
| --- | --- | --- |
| `asset-manager.ts` | 组装 Config、Bundle、缓存和加载管线 | `asset-manager.ts` |
| `bundle.ts`、`config.ts` | 场景名查 UUID | `asset-manager/bundle.ts`、`config.ts` |
| `preprocess.ts`、`request-item.ts` | UUID 形成请求项 | `preprocess.ts`、`request-item.ts` |
| `fetch.ts` | 取得文件 | `fetch.ts`、`downloader.ts` |
| `parser.ts`、`depend-util.ts` | 读取资源条目、提取 UUID 依赖 | `parser.ts`、`depend-util.ts` |
| `pipeline.ts`、`load.ts`、`deserialize.ts` | 串接阶段；递归加载、创建和缓存 Asset | `pipeline.ts`、`load.ts`、`deserialize.ts` |
| `asset.ts` | 本课最小 Asset 对象 | `assets/asset.ts` |

课程代码保留 Runtime 的职责分层，只省去完整 Bundle Config 数据、并发队列、错误重试、反序列化格式兼容和真实网络实现。样例由 Creator 3.8.8 构建，本地 Runtime 快照是 3.8.7。

## 课程日志和浏览器 Network 是两种证据

课程页面的 `GET` 是 Fetcher 对文件 Map 的模拟。观察实际请求时，在终端进入 `3.8NewProject/build/web-mobile/`，运行：

```sh
python3 -m http.server 8105 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:8105`，在 Network 面板过滤 `assets/main`。将场景 pack 和 Mesh 文件请求与第 93 课算出的 URL 比较。启动页面还会请求引擎、internal 和其他场景资源，所以实际请求总数不会是 2。

## 源码入口

- [Bundle `loadScene()`](../../engine/3.8.7engine/cocos/asset/asset-manager/bundle.ts)
- [Config 查表](../../engine/3.8.7engine/cocos/asset/asset-manager/config.ts) 与 [URL 生成](../../engine/3.8.7engine/cocos/asset/asset-manager/url-transformer.ts)
- [RequestItem](../../engine/3.8.7engine/cocos/asset/asset-manager/request-item.ts)、[fetch](../../engine/3.8.7engine/cocos/asset/asset-manager/fetch.ts)、[pack-manager](../../engine/3.8.7engine/cocos/asset/asset-manager/pack-manager.ts)
- [依赖解析](../../engine/3.8.7engine/cocos/asset/asset-manager/depend-util.ts)、[load](../../engine/3.8.7engine/cocos/asset/asset-manager/load.ts)、[deserialize](../../engine/3.8.7engine/cocos/asset/asset-manager/deserialize.ts)

## 学完后自查

不用看代码，依次说出“场景路径、UUID、URL、文件、Asset”分别在什么时候出现。再解释为什么 SceneAsset 和 Prefab 是两个 Asset，却可以只共用一个 import pack 请求。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
