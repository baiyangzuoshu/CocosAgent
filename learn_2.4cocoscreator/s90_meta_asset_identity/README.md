# 第 90 课：.meta、UUID 与资源身份

**本课目标：** 看懂一个图片源文件为什么能对应多个运行时资源，以及场景引用的是哪一个 UUID。

## 先区分三样东西

- **源文件：** 美术导入的 HelloWorld.png。
- **Asset 身份：** Creator 用 UUID 标识导入后的资源；文件名和路径用于编辑器管理，运行时引用依靠 UUID。
- **子资源：** 一个源文件可导入出多个可单独引用的资源，例如图片对应的 SpriteFrame。

所以“一个文件”不一定等于“一个 Asset”。

## 2.4 样例：PNG 和 SpriteFrame

看 2.4NewProject/assets/Texture/HelloWorld.png.meta 中这三处：

| 字段 | 样例值 | 含义 |
| --- | --- | --- |
| uuid | 6aa0aa6a-ebee-4155-a088-a687a6aadec4 | PNG 导入后的贴图主资源 UUID |
| subMetas.HelloWorld.uuid | 31bc895a-c003-4566-a9f3-2e54ae1c17dc | 从 PNG 导入出的 SpriteFrame UUID |
| subMetas.HelloWorld.rawTextureUuid | 6aa0aa6a-ebee-4155-a088-a687a6aadec4 | 这个 SpriteFrame 使用哪张主贴图 |

再看 Scene/helloworld.fire 里的 _spriteFrame.__uuid__。场景记录的是 31bc...，也就是 SpriteFrame 子资源，不是 PNG 主 UUID。

~~~text
HelloWorld.png.meta
  PNG 主资源：6aa0...
  └─ SpriteFrame 子资源：31bc...
       └─ rawTextureUuid 指回 PNG 主资源：6aa0...

helloworld.fire 的 Sprite._spriteFrame
  └─ __uuid__ = 31bc...
~~~

2.4 的 Bundle 目录也有 .meta。样例 BundleMain.meta 中 isBundle 为 true，表示该目录被编辑器作为 Bundle 处理。这是编辑器工程数据，不是浏览器运行时的资源文件。

## 运行代码时看什么

代码用从上述文件摘出的最小字段构造一个 AssetMeta 对象，再用 findSource 查 UUID 属于主资源还是子资源。它是字段查找练习，不是 Creator 的完整 .meta 解析器。

`src/example-meta.ts` 只放本课摘录的 UUID 与字段；`src/cocos2d/core/assets/AssetMeta.ts` 实现查询；`src/main.ts` 把两者连起来并显示结果。可以从 `main.ts` 的 `findSource` 调用跳进查询函数，再回到 `example-meta.ts` 看输入字段。

~~~sh
deno task check
deno task build
deno task serve
~~~

页面中先看 SpriteFrame/Mesh UUID，再看它们的父源资源。注意 .meta 是编辑器导入数据；构建后，运行时主要查 Bundle config，不会到浏览器里读取工程 .meta。

## 源码对照与下一课

- 样例数据：2.4NewProject/assets/Texture/HelloWorld.png.meta、2.4NewProject/assets/Scene/helloworld.fire。
- 引擎索引：engine/2.4.15engine/cocos2d/core/asset-manager/config.js 的 _initUuid、_initPath、_initScene。
下一课会把这些引用画成图，并解释加载一个 Asset 时为什么还要处理它依赖的资源。
