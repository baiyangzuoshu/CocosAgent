# 第 91 课：从场景引用画出依赖

**本课目标：** 看懂“场景依赖 SpriteFrame，SpriteFrame 依赖 Texture2D”这句话是从哪些字段读出来的。这里先不计算 URL，也不讨论下载顺序。

## 先从真实字段画两条边

第 90 课确认了场景中的 `_spriteFrame.__uuid__` 是 SpriteFrame 子资源 UUID。现在再读 `.meta` 中的 `rawTextureUuid`：

```text
helloworld.fire:  _spriteFrame.__uuid__ = 31bc...17dc
HelloWorld.png.meta: rawTextureUuid     = 6aa0...a6a

SceneAsset → SpriteFrame → Texture2D
```

箭头表示“要使用左边这个资源，还需要右边这个资源”。它不表示文件路径，也不表示这两个 Asset 一定各自发出一次网络请求；第 92、93 课才讨论文件和 URL。

## 场景里的两个引用字段

- `__uuid__` 是外部 Asset 的 UUID。这里 `_spriteFrame.__uuid__` 指向另一个资源文件/资源条目。
- `__id__` 是同一个 `.fire` 序列化文件中的对象编号。它用于把文件内部的节点、组件互相接起来，不是新的 Asset UUID。

因此本课不能把所有数字都当依赖。本地 `depend-util.js` 会递归检查序列化数据中的 UUID 引用；本课只取其中与图片有关的字段，避免把整份场景文件搬进示例。

## 按代码的执行顺序读

1. `src/example-dependencies.ts` 里的 `serializedSpriteReference` 是从场景 Sprite 组件摘出的最小字段；`spriteFrameMeta` 是 `.meta` 中的纹理引用。
2. `collectUuidReferences()` 遍历这个小对象，只返回 `__uuid__` 的值。输入是 SpriteFrame UUID，所以得到第一条边 `SceneAsset → SpriteFrame`。
3. `DependencyGraph.add()` 把“拥有引用的资源 UUID”和“被引用 UUID”存起来。
4. 第二次 `add()` 用 `rawTextureUuid` 建立 `SpriteFrame → Texture2D`。
5. `collect(sceneUuid)` 从场景 UUID 开始沿边递归，结果应按 `SceneAsset → SpriteFrame → Texture2D` 到达两个依赖。

课程代码对的是抽取后的片段，不是完整 `.fire` 解析器。实际字段来源请回到 `helloworld.fire` 和 `HelloWorld.png.meta` 核对。

## 对照 2.4.15 Runtime 源码

- [depend-util.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/depend-util.js)：从 `parse()` 进入，继续看 `_parseDepsFromJson()` 如何递归收集引用。
- [load.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/load.js)：看 `loadDepends()` 如何把已发现的依赖加入加载流程。
- [CCAsset.js](../../engine/2.4.15engine/cocos2d/core/assets/CCAsset.js)：Asset 自身的数据与引用计数；本课不模拟引用计数释放。

引擎对循环依赖、重复 UUID、native 依赖等还有处理。本课图只表达当前例子的两个 Asset 依赖。

## 学完后自查

如果删除 `rawTextureUuid` 这条边，为什么从场景递归就到不了 Texture2D？用一句话区分“Asset 依赖”和“请求文件”。下一课看 AssetManager 怎样执行这些依赖。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
