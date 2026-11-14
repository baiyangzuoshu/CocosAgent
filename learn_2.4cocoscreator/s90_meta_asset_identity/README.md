# 第 90 课：从 `.meta` 找到资源身份

**本课目标：** 解释场景里 Sprite 保存的 UUID 属于哪一个资源，并沿它找到实际 PNG。先只追 `HelloWorld.png` 这一张图。

## 先看工程中的两份文件

打开 `2.4NewProject/assets/Texture/HelloWorld.png.meta`，只抄这三项：

| 字段 | 当前值 | 代表什么 |
| --- | --- | --- |
| 顶层 `uuid` | `6aa0aa6a-ebee-4155-a088-a687a6aadec4` | PNG 导入后 Texture2D 主资源的身份 |
| `subMetas.HelloWorld.uuid` | `31bc895a-c003-4566-a9f3-2e54ae1c17dc` | 这张图导出的 SpriteFrame 子资源身份 |
| `subMetas.HelloWorld.rawTextureUuid` | `6aa0aa6a-ebee-4155-a088-a687a6aadec4` | SpriteFrame 使用的底层 Texture2D 身份 |

再打开 `2.4NewProject/assets/Scene/helloworld.fire`，搜索 `_spriteFrame`。场景里保存的是 `31bc895a-c003-4566-a9f3-2e54ae1c17dc`，因此这个 Sprite 引用的是 **SpriteFrame 子资源**，不是 PNG 主资源。

```text
helloworld.fire 的 _spriteFrame.__uuid__
  = .meta 的 subMetas.HelloWorld.uuid       → SpriteFrame

subMetas.HelloWorld.rawTextureUuid
  = .meta 顶层 uuid                         → Texture2D → PNG
```

读这两条等号时，先比较字符串是否完全相同。它们回答两个不同问题：场景要哪个 SpriteFrame？这个 SpriteFrame 又用哪张纹理？

## 本课代码实际做了什么

打开 `src/example-meta.ts`，会看到同样三项字段被手工抄进 TypeScript。打开 `src/main.ts`：它拿场景中的 UUID 调用 `findSource()`。`AssetMeta.ts` 只做两次比较：先和顶层 `uuid` 比，再和每个子资源的 `uuid` 比。因此本例会把场景 UUID 识别为 `子资源 HelloWorld (sprite-frame)`。

你可以把 `main.ts` 传入的 UUID 改成顶层 UUID，再运行页面；结果会变成 `主资源 texture`。这不是 Creator 正在导入 PNG，而是一个小型“UUID 属于谁”的查表练习。

## `.meta` 不会由浏览器读取

`.meta` 是编辑器导入工程资源时使用的数据。运行时读的是构建生成的 Bundle config；所以不要在 `build/web-mobile/` 里寻找同一份 `.meta`。本地 Runtime 快照也不含完整 Editor AssetDB 导入器。

- [2.4.15 Runtime `config.js`](../../engine/2.4.15engine/cocos2d/core/asset-manager/config.js)：从 `_initUuid()` 看构建后的 UUID 索引。
- 工程证据：`2.4NewProject/assets/Texture/HelloWorld.png.meta`、`2.4NewProject/assets/Scene/helloworld.fire`。

`2.4NewProject/assets/BundleMain.meta` 中的 `isBundle` 是另一个例子：它是目录的编辑器配置，不是上面这张图的身份信息；生成的 Bundle config 才是 Runtime 的索引。

## 学完后自查

闭上文件，回答：场景引用的 UUID 是 PNG 主 UUID 还是 SpriteFrame 子 UUID？`rawTextureUuid` 指向哪一个？下一课把这两种引用画成 Asset 依赖。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
