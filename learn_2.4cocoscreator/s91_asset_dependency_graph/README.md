# 第 91 课：Asset 引用与依赖图

**本课目标：** 从序列化数据和 .meta 字段提取资源引用，分清“场景直接引用谁”和“加载场景最终需要谁”。

## 先理解箭头方向

图里的 A → B 表示：加载 A 时，A 需要资源 B。它不是父子节点关系，也不是“B 文件放在 A 文件夹里”。

2.4 样例里有两条不同来源的依赖：

~~~text
helloworld.fire 中 Sprite._spriteFrame.__uuid__
SceneAsset ───────────────────────────────→ SpriteFrame
SpriteFrame 的 .meta rawTextureUuid
SpriteFrame ─────────────────────────────→ Texture2D
~~~

Scene 直接引用 SpriteFrame；SpriteFrame 再依赖 PNG 主贴图。Scene 文件里出现的 UUID 只是第一条边，不能代表完整的递归依赖。

## 逐步对应真实文件

1. 在 assets/Scene/helloworld.fire 搜索 _spriteFrame，里面的 __uuid__ 是 SpriteFrame UUID。
2. 在 assets/Texture/HelloWorld.png.meta 找 subMetas.HelloWorld。
3. 该子资源的 rawTextureUuid 指回 PNG 主资源 UUID。
4. 把两条边连起来，得到 SceneAsset → SpriteFrame → Texture2D。
5. 递归加载时要先取得这些依赖，场景对象才能拿到实际资源对象。

## Asset 是什么

Asset 是运行时可使用的对象，例如 SceneAsset、SpriteFrame、Texture2D。它与磁盘上的 JSON/PNG 文件不是同一层概念：一个 import pack 可以保存多个 Asset 的序列化内容，PNG 则是 native 文件。

Asset 的 refCount 用于跟踪资源对象被保留的引用，不表示 HTTP 请求次数。本课只调用一次 addRef 展示这个字段，实际引用的建立和释放由引擎加载、节点和资源释放流程协同完成。

## 代码怎么做

- collectUuidReferences 只从对象中找 __uuid__，模拟从场景序列化对象提取外部资源引用。
- rawTextureUuid 来自 .meta，不是场景里的 __uuid__，所以代码单独把它加成第二条依赖边。
- DependencyGraph.collect 从根 UUID 沿边往下走，返回所有直接和间接依赖。
- 示例中的对象是从真实文件摘出的最小片段，不会读取或完整解析 .fire/.meta。

`src/example-dependencies.ts` 放序列化片段与 `.meta` 依赖字段；`src/cocos2d/core/asset-manager/depend-util.ts` 提取引用；`src/main.ts` 组图并遍历。建议依次读数据、提取函数、图遍历调用。

运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

页面先看两条边，再看递归结果。若递归结果只有 SpriteFrame，没有 Texture2D，说明第二条边没有连上。

## 源码对照

- engine/2.4.15engine/cocos2d/core/asset-manager/depend-util.js：_parseDepsFromJson 和 getDepends 收集资源依赖。
- engine/2.4.15engine/cocos2d/core/asset-manager/load.js：loadDepends 加载依赖并把引用写回对象。
- engine/2.4.15engine/cocos2d/core/assets/CCAsset.js：Asset 对象和引用计数相关字段。

下一课会让 AssetManager 按依赖图执行加载，而不只是打印这张图。
