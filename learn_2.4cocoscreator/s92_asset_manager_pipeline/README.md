# 第 92 课：AssetManager 加载管线

**本课问题：** `Bundle.load` 背后的 AssetManager 如何区分预加载与完整加载？

## 本课内容

2.4 的正常管线是 `preprocess → load`，预加载走 `preprocess → fetch`。完整加载再解析数据、加载依赖、创建 Asset 并放入缓存；预加载只下载文件，不创建资源对象。

## 源码位置

- `engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js:60-103`：正常、下载与 URL 转换管线。
- `engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js` 中 `preloadAny/loadAny`：请求进入不同管线。
- `engine/2.4.15engine/cocos2d/core/asset-manager/load.js:89-155`：下载、解析和 Asset 缓存命中。
- `engine/2.4.15engine/cocos2d/core/asset-manager/parser.js`、`deserialize.js`、`depend-util.js`：解析与依赖。

## 独立代码

- [AssetManager](src/cocos2d/core/asset-manager/CCAssetManager.ts)
- [资源下载与解析](src/cocos2d/core/asset-manager/)
- [浏览器运行入口](src/main.ts)

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

示例用内存中的文件传输器隔离管线职责，不模拟网络错误、压缩包或编辑器构建。
