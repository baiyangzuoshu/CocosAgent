# 第 90 课：`.meta` 与资源身份

**本课问题：** 一个源文件的 UUID、SpriteFrame 子 UUID 和场景引用怎样对应？

## 本课内容

读取 `HelloWorld.png.meta` 的主资源 UUID 和 `subMetas.HelloWorld`，再用场景中的 UUID 找到这个子资源。文件名帮助人阅读，运行时引用依靠 UUID。目录 Bundle 标记也来自 2.4 目录 `.meta`。

## 源码位置

- `2.4NewProject/assets/Texture/HelloWorld.png.meta`：贴图 UUID、SpriteFrame 子 UUID、`rawTextureUuid`。
- `2.4NewProject/assets/Scene/helloworld.fire`：场景序列化引用。
- `2.4NewProject/assets/BundleMain.meta`：`isBundle: true`。
- `engine/2.4.15engine/cocos2d/core/asset-manager/config.js:70-103`：将运行时 UUID 索引和路径索引建成查找表。
- 编辑器 AssetDB 导入器未包含在运行时源码快照中；本课把 `.meta` 当作编辑器生成的数据读取。

## 独立代码

- [资源元数据模型](src/cocos2d/core/assets/AssetMeta.ts)
- [场景引用查找](src/main.ts)

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://127.0.0.1:8000>，观察场景引用怎样命中子资源，而不是贴图主 UUID。
