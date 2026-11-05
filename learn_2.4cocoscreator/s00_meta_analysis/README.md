# 第 0 课：`.meta` 元数据分析

**目标：** 从贴图的 `.meta` 字段找到 SpriteFrame 子资源 UUID，并看清它如何关联主贴图。

## 本课增量

示例读一份精简 `.meta` 字段样本，输出主资源 UUID、子资源 UUID 和 `rawTextureUuid` 关系。Creator 2.4 的场景可能直接引用 SpriteFrame UUID；运行时根据构建配置解析 UUID，不在游戏运行时读取编辑器 `.meta` 文件。

## 源码与样例位置

- `docs/2.x/04-assets-and-loading.md:11-13`：记录研究样例 `HelloWorld.png.meta` 的主 UUID、SpriteFrame 子 UUID 和 `rawTextureUuid`。
- `engine/2.4.15engine/cocos2d/core/asset-manager/config.js:177-206`：运行时 Config 按路径查资源信息。
- `engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js:486-496`：`loadAny` 把请求交给 Asset Manager 管线。
- `samples/HelloWorld.png.meta.sample.json`：只保留本课需要的 UUID 字段节选。

## 简化

样例用于认识字段关系，不是 Creator 生成的完整 `.meta`，不能直接导入工程。`.meta` 属于编辑器导入工作流；Web 运行时使用构建产物中的资源配置。完整运行时加载会在后续课程展开。

## 运行

~~~sh
deno task check
deno task analyze
~~~

输出主资源 UUID `6aa0…`、SpriteFrame UUID `31bc…`，并验证 `rawTextureUuid` 指回主贴图。浏览器宿主准备见课程入口的“运行准备”。
