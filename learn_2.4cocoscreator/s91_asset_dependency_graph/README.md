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

## Asset 是对象，不是磁盘文件

`cc.Asset` 是资源加载后在 Runtime 中使用的对象基类。Creator 2.4.15 的 [CCAsset.js](../../engine/2.4.15engine/cocos2d/core/assets/CCAsset.js) 里，`_uuid` 标识对象身份；`_native` 描述对应的原生文件；`nativeUrl` 按 UUID、文件名和扩展名计算地址；`_nativeAsset` 保存解码后的底层对象。比如 PNG 可对应一个 SpriteFrame Asset 和一个 Texture2D Asset：它们是不同 UUID 的对象，Texture2D 还可能装有浏览器解码出的图片/纹理对象。

Asset 依赖图回答“加载这个对象还需要哪些对象”；Bundle Config 与请求 URL 回答“Runtime 从哪里取到序列化内容或原生文件”。一个 import pack 可以含多个 Asset 条目，所以 Asset 数量、下载文件数和浏览器 GET 数不必相等。

Asset 的 `refCount` 是引擎生命周期记账。`addRef()` 增加计数；`decRef()` 减少计数并默认把对象交给 `releaseManager` 尝试回收。它不等同于 JavaScript 变量数，也不等同于场景中引用该资源的节点数。强制释放、依赖释放和场景自动释放的差别见[资源身份、加载与释放研究](../../docs/2.x/04-assets-and-loading.md)。

还有一个 2.4.15 的边界：`SceneAsset` 会被加载并返回给调用者，但 `utilities.js::cache()` 不把 SceneAsset 放进共享 `assetManager.assets` 缓存。不要把“Asset 对象存在”和“对象在通用缓存表中”当成同一件事。

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

## 本课必须保留的机制

保留 SceneAsset `__uuid__`→SpriteFrame、`rawTextureUuid`→Texture2D 两条依赖边；只把外部 Asset `__uuid__` 视作依赖，文件内部 `__id__` 不创建 Asset 依赖。

## 最小观察宿主

以摘录的场景 Sprite 字段和 `.meta` 字段构造小型依赖图，从 SceneAsset UUID 递归遍历并显示 SpriteFrame、Texture2D。

## 模型化简化与 Creator Runtime 边界

只处理当前例子的两个字段和两条边，不解析完整 `.fire`、不执行 Downloader/Loader，也不模拟循环、重复 UUID、native 依赖、请求 URL 或释放过程；课程依赖图不是 Runtime 加载器。

## 学完后自查

如果删除 `rawTextureUuid` 这条边，为什么从场景递归就到不了 Texture2D？用一句话区分“Asset 依赖”和“请求文件”。下一课看 AssetManager 怎样执行这些依赖。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
