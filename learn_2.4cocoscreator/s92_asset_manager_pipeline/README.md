# 第 92 课：AssetManager 加载管线

**本课目标：** 读懂 load 与 preload 的区别，并追踪一个 UUID 如何变成可使用的 Asset 对象。

## 先看两条管线

~~~text
完整加载：preprocess → load
                         ├─ 查 Asset 缓存
                         ├─ 取得文件（可能已下载）
                         ├─ 解析 import 数据
                         ├─ 加载依赖
                         └─ 反序列化、onLoad、写入 Asset 缓存

预加载：  preprocess → fetch
                         └─ 取得文件，不创建 Asset 对象
~~~

这里的 preprocess 是整理请求；fetch 是拿到文件内容；parser.parse(import) 是解析下载的资源数据。它们不是同一件事。第 93 课才会继续讲 UUID、版本如何组成最终 URL。

## 用本课样例走一次

1. 根资源是 BundleMain 的 label.prefab。
2. preloadAny 只把根资源文件放进 downloaded 文件缓存。
3. 此时 assets 里还没有 Prefab 对象，所以“文件已下载”不等于“资源已加载”。
4. loadAny 进入完整管线，解析 Prefab 数据，发现它依赖 SpriteFrame。
5. 依赖也完成加载后，才创建 Prefab Asset、调用资源 onLoad 并缓存。
6. 再次 loadAny 同 UUID，直接复用同一个 Asset 对象。

## 代码目录各自负责什么

| 文件 | 职责 |
| --- | --- |
| CCAssetManager.ts | 选择完整加载或仅下载的管线 |
| pipeline.ts | 按顺序执行阶段 |
| fetch.ts | 从课程内存文件表取得文件，模拟下载边界 |
| parser.ts | 把 import JSON 字符串解析成普通数据对象 |
| depend-util.ts | 从数据里找出依赖 UUID |
| deserialize.ts | 把解析数据包装成运行时 Asset |
| load.ts | 缓存检查、依赖递归、反序列化和 Asset 缓存 |

`src/example-files.ts` 是输入文件表，`src/main.ts` 只负责先 preload 再 load。阅读时从入口追到 `CCAssetManager.ts`，然后按表里的职责进入具体模块；不要把样例输入误认为 AssetManager 实现。

## 跑代码时观察什么

~~~sh
deno task check
deno task build
deno task serve
~~~

页面先显示 preload 后 Asset 缓存为 false，再显示完整加载得到 Prefab、重复请求复用对象。执行记录中，fetch 在 parser.parse(import) 之前发生，依赖 SpriteFrame 也会被加载。

本课的 Fetcher 读取内存 Map，不访问真实 HTTP；它只隔离模块职责。真实 Bundle 配置和 URL 在第 93 课看。

## 源码对照

- engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js：pipeline 是 preprocess → load，fetchPipeline 是 preprocess → fetch。
- engine/2.4.15engine/cocos2d/core/asset-manager/load.js：loadOneAssetPipeline 先取得文件，再解析并处理依赖。
- 同一文件的 loadDepends 处理依赖，成功后调用 Asset.onLoad 并写缓存。

注意：2.4 的 onLoad 是资源加载完成回调，不是组件生命周期课中的 Component.onLoad。

## 本课边界

省略 RequestItem 归一化、错误重试、并发队列、压缩包解包和浏览器 HTTP 缓存。下一课补上 Bundle Config，让请求不再直接拿 UUID 查内存文件表。
