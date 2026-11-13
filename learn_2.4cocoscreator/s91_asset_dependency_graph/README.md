# 第 91 课：Asset 引用与依赖图

**本课问题：** 场景保存的 UUID 如何变成 Asset 之间的依赖边？

## 本课内容

把 `helloworld.fire` 的 SpriteFrame 引用和贴图 `.meta` 的 `rawTextureUuid` 连起来：场景依赖 SpriteFrame，SpriteFrame 再依赖 Texture。课程代码按 UUID 保存边，并计算递归依赖，避免把“场景文本里出现的 UUID”误当作完整依赖表。

## 源码位置

- `2.4NewProject/assets/Scene/helloworld.fire`、`assets/Texture/HelloWorld.png.meta`：实际序列化引用和子资源依赖。
- `engine/2.4.15engine/cocos2d/core/asset-manager/depend-util.js:196-220`：从序列化资源抽取 UUID 依赖。
- `engine/2.4.15engine/cocos2d/core/asset-manager/load.js:159-222`：加载依赖并把 Asset 引用填回对象。
- `engine/2.4.15engine/cocos2d/core/assets/CCAsset.js:50-75`：资源对象基础字段。

## 独立代码

- [Asset 对象模型](src/cocos2d/core/assets/CCAsset.ts)
- [依赖图](src/cocos2d/core/asset-manager/depend-util.ts)
- [场景依赖示例](src/main.ts)

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

页面只模拟 UUID 引用图；不会反序列化真实 `.fire` 文件。
