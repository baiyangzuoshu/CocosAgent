# 第 92 课：AssetManager 加载管线

**本课问题：** Creator 3.8 的 AssetManager 如何从 Bundle 请求走到 Asset 对象？

## 本课内容

3.8 的正常管线是 `preprocess → load`，预加载走 `preprocess → fetch`。完整加载会解析 import 数据、递归加载依赖、调用 `Asset.onLoaded` 并缓存。URL 转换管线另有 `replaceOverrideAsset` 阶段，这是与 2.4 的一处差异。

## 源码位置

- `engine/3.8.7engine/cocos/asset/asset-manager/asset-manager.ts:123-152`：正常、下载和 URL 转换管线。
- `engine/3.8.7engine/cocos/asset/asset-manager/asset-manager.ts:600-619`：`preloadAny` 进入下载管线。
- `engine/3.8.7engine/cocos/asset/asset-manager/load.ts:102-174`：下载、解析和缓存命中。
- `engine/3.8.7engine/cocos/asset/asset-manager/parser.ts`、`deserialize.ts`、`depend-util.ts`：反序列化与依赖。

## 独立代码

- [AssetManager](src/cocos/asset/asset-manager/asset-manager.ts)
- [资源下载与解析](src/cocos/asset/asset-manager/)
- [浏览器运行入口](src/main.ts)

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

示例用内存中的文件传输器隔离管线职责，不模拟网络错误、压缩包或编辑器构建。
