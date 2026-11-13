# 第 94 课：从首场景走到 Web 资源

**本课目标：** 把 89–93 课的输出文件、Asset 身份、依赖、加载管线和 URL 串成一次完整的场景加载。

## 先弄清楚这五个名词

| 名词 | 本课里是什么 | 例子 |
| --- | --- | --- |
| UUID | 运行时识别某个 Asset 的身份 | SceneAsset、SpriteFrame、Texture2D 各有一个 |
| URL | 浏览器取得文件的位置 | `.../import/05/05dd1dc0e.29693.json` |
| import pack | 存放序列化 Asset 数据的构建文件 | Scene 与 SpriteFrame 共用一个 pack |
| native 文件 | 由专用解析器读取的文件 | Texture2D 的 PNG |
| Asset 对象 | 加载后可被场景使用的运行时对象 | `CCAsset` 的课程简化版 |

UUID、URL、文件、Asset 对象在流程中相连，但不是同一个东西。比如两个 UUID 可以落在同一个 pack URL 里，加载后仍然是两个 Asset 对象。

## 一次 load 如何流过代码

先从 `src/main.ts` 的 `manager.load(sceneUuidForExample)` 开始，沿调用顺序读：

~~~text
main.ts
  └─ CCAssetManager.load(uuid)                  对外入口
       └─ LoadPipeline.load(uuid)               管理顺序和 Asset 缓存
            ├─ Fetcher.fetch(record)             取得文件，按 URL 去重
            ├─ Parser.parse(record)              区分 import pack / native
            ├─ 对每个 dependency 递归 load      先准备依赖
            └─ new CCAsset(...)                  创建并按 UUID 缓存
~~~

照这个顺序观察页面日志：

1. 场景 UUID 没有 Asset 缓存，先从 `example-assets.ts` 找到它的记录。
2. `Fetcher` 请求 import pack。SpriteFrame 也指向同一个 pack URL，因此不会再次 GET。
3. `Parser` 标记 pack 已处理；继续加载场景记录中的 SpriteFrame 依赖。
4. SpriteFrame 的依赖指向 Texture2D。Texture2D 使用 native PNG URL，Fetcher 为它发起第二个 GET。
5. 依赖加载完成后，递归逐层创建并缓存 Texture2D、SpriteFrame、SceneAsset。
6. 再次 load 同一个场景 UUID，会在 `LoadPipeline` 开头命中 Asset 对象缓存。

结果是 **2 个不同文件 URL、3 个 Asset 对象**。缓存文件并没有把两个 Asset 合成一个对象。

## 代码目录：每个文件只做一件事

| 文件 | 读它时要回答的问题 | 对应源码职责 |
| --- | --- | --- |
| `src/main.ts` | 从哪个 UUID 开始？结果显示在哪里？ | 课程入口 |
| `src/example-assets.ts` | 真实工程里有哪些 UUID、依赖边和文件 URL？ | 从构建配置、场景和 `.meta` 摘出的样例数据 |
| `src/cocos2d/core/asset-manager/types.ts` | 一条资源记录保存哪些信息？ | 请求/资源描述数据 |
| `src/cocos2d/core/asset-manager/CCAssetManager.ts` | 外部如何发起 load？ | `CCAssetManager.js` 的门面职责 |
| `src/cocos2d/core/asset-manager/load.ts` | 缓存、递归、对象创建的顺序是什么？ | `load.js` |
| `src/cocos2d/core/asset-manager/fetch.ts` | 文件 URL 如何去重？ | `fetch.js` 的加载边界；真实文件 I/O 在 `downloader.js` |
| `src/cocos2d/core/asset-manager/parser.ts` | import 与 native 为什么分开？ | `parser.js` 的解析职责模型 |
| `src/cocos2d/core/assets/CCAsset.ts` | 加载完成后缓存的对象是什么？ | `CCAsset.js` |

这里把示例数据放在 `example-assets.ts`，把处理流程放在引擎职责目录里。读代码时先读入口，再进 `load.ts`，需要看文件时跳到 `fetch.ts`，遇到解析再读 `parser.ts`。

## 这份示例有意简化了什么

- `example-assets.ts` 的依赖边已从 `.fire` 和 `.meta` 整理好；本课不会重新解析这些文件。
- `Fetcher` 用内存 Set 模拟按 URL 缓存，没有发真实 HTTP 请求。
- `Parser` 只记录“pack 已解析”的状态，没有反序列化真实 JSON 或 PNG。
- `CCAsset` 只保留 UUID 和类型，完整 Asset 还有引用计数、销毁和序列化状态。
- 没有实现并发去重、循环依赖保护、错误重试和 HTTP 缓存。

所以本课的日志是**课程模型的流程记录**，不是 Creator 引擎的运行日志，也不是浏览器 Network 面板的实测结果。

## 运行并核对真实构建

先运行课程模型：

~~~sh
deno task check
deno task build
deno task serve
~~~

再单独观察 `2.4NewProject/build/web-mobile/`：运行 `python3 -m http.server 8104 --bind 127.0.0.1`，打开 `http://127.0.0.1:8104` 和浏览器 Network 面板，过滤 `assets/main`。找到 import pack 和 native PNG 请求后，与 `example-assets.ts` 中的 URL 核对。两者是不同页面：课程页面解释职责顺序，Creator 构建页提供真实请求证据。

## 引擎源码位置

- `engine/2.4.15engine/cocos2d/core/asset-manager/bundle.js`：`Bundle.loadScene` 从场景名进入加载流程。
- `engine/2.4.15engine/cocos2d/core/asset-manager/config.js`、`urlTransformer.js`：配置查找和 URL 形成。
- `engine/2.4.15engine/cocos2d/core/asset-manager/pack-manager.js`：处理合并 pack。
- `engine/2.4.15engine/cocos2d/core/asset-manager/fetch.js`、`downloader.js`、`parser.js`：从缓存/依赖处理到实际下载和资源解析。
- `engine/2.4.15engine/cocos2d/core/asset-manager/load.js`、`depend-util.js`：解析依赖、递归加载和缓存。
- `engine/2.4.15engine/cocos2d/core/assets/CCAsset.js`：Asset 对象。

本课只把相关职责重排成容易单步阅读的 TypeScript 模型，不是 Creator 运行时的逐行移植。引擎快照也不含完整 Editor Builder。
