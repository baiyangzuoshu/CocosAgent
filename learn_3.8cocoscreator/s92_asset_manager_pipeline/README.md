# 第 92 课：AssetManager 加载管线

**本课目标：** 读懂 load 与 preload 的区别，并追踪一个 UUID 如何变成可使用的 Asset 对象。

## 先看三条管线

~~~text
完整加载：preprocess → load
                         ├─ 查 Asset 缓存
                         ├─ 取得文件（可能已下载）
                         ├─ 解析 import 数据
                         ├─ 加载依赖
                         └─ 反序列化、onLoaded、写入 Asset 缓存

预加载：  preprocess → fetch
                         └─ 取得文件，不创建 Asset 对象

URL 转换：parse → replaceOverrideAsset → combine
          请求输入    资源重定向/覆盖     得到文件 URL
~~~

这里有两个容易混淆的 parse：URL 转换管线里的 parse 把请求参数整理成 RequestItem；资源 parser.parse(import) 则解析下载到的资源内容。第 93 课会把 URL 转换规则单独拆开讲。

## 用本课样例走一次

1. 根资源是 soldier.prefab。
2. preloadAny 只取得根资源文件，Asset 缓存仍为空。
3. loadAny 执行完整加载，解析 Prefab 数据并发现 Mesh 依赖。
4. Mesh 依赖加载完成后，反序列化 Prefab，调用资源 onLoaded 并放入 Asset 缓存。
5. 再次用同一 UUID 请求，复用同一个 Asset 对象。

## 代码目录各自负责什么

| 文件 | 职责 |
| --- | --- |
| asset-manager.ts | 选择完整加载、仅下载或 URL 转换管线 |
| pipeline.ts | 按顺序执行阶段 |
| fetch.ts | 从课程内存文件表取得文件，模拟下载边界 |
| parser.ts | 把 import JSON 字符串解析成普通数据对象 |
| depend-util.ts | 从数据里找出依赖 UUID |
| deserialize.ts | 把解析数据包装成运行时 Asset |
| load.ts | 缓存检查、依赖递归、反序列化和 Asset 缓存 |

`src/example-files.ts` 是输入文件表，`src/main.ts` 只负责先 preload 再 load。阅读时从入口追到 `asset-manager.ts`，然后按表里的职责进入具体模块；不要把样例输入误认为 AssetManager 实现。

## 跑代码时观察什么

~~~sh
deno task check
deno task build
deno task serve
~~~

页面先显示 preload 后 Asset 缓存为 false，再显示完整加载得到 Prefab、重复请求复用对象。执行记录里应看到 Prefab 和 Mesh 分别解析。

本课的 Fetcher 读取内存 Map，不访问真实 HTTP；它只隔离模块职责。真实 Bundle 配置和 URL 在第 93 课看。

## 源码对照

- engine/3.8.7engine/cocos/asset/asset-manager/asset-manager.ts：pipeline 是 preprocess → load，fetchPipeline 是 preprocess → fetch，transformPipeline 有三个阶段。
- engine/3.8.7engine/cocos/asset/asset-manager/load.ts：下载、解析、依赖加载和缓存。
- engine/3.8.7engine/cocos/asset/assets/asset.ts：Asset 的资源完成回调是 onLoaded。

## 本课边界

省略 RequestItem 归一化、错误重试、并发队列、压缩包解包和浏览器 HTTP 缓存。下一课补上 Bundle Config，让请求不再直接拿 UUID 查内存文件表。
