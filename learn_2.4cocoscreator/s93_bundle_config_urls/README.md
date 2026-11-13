# 第 93 课：Bundle 索引与文件 URL

**本课问题：** Bundle Config 如何从路径索引找到 UUID，再定位文件或合并资源包？

## 本课内容

使用当前 2.4 构建中的真实配置项：`BundleMain.paths.label → uuids[0] → import/2b/...e273f.json`；主场景则由 `packs` 指向 `import/05/05dd1dc0e.29693.json`。示例实现压缩 UUID 解码、版本查找、pack 路径和单资源 URL。

## 源码位置

- `engine/2.4.15engine/cocos2d/core/asset-manager/config.js:53-150`：Config 建立 UUID、路径、pack 和版本索引。
- `engine/2.4.15engine/cocos2d/core/asset-manager/urlTransformer.js:143-179`：组合 import/native URL。
- `engine/2.4.15engine/cocos2d/core/asset-manager/pack-manager.js`：从 pack 表读取合并资源。
- 实际文件位于 `2.4NewProject/build/web-mobile/assets/`；这里仅记录当前构建证据。

## 独立代码

- [UUID 解码](src/cocos2d/core/asset-manager/decodeUuid.ts)
- [Bundle Config](src/cocos2d/core/asset-manager/config.ts)
- [文件 URL 组合](src/cocos2d/core/asset-manager/urlTransformer.ts)
- [浏览器运行入口](src/main.ts)

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

页面显示的路径对应现有构建中的文件；不重建 Creator Bundle。
