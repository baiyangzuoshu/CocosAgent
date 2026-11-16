# 第 102 课：Auto Atlas 怎样把散图变成共享贴图

**本课问题：** UILive.prefab 引用的几张散图，怎样经过 Creator 2.4.15 构建变成一张 Web 贴图，同时让 Sprite 仍然按原来的 SpriteFrame UUID 绘制？

本课取证于工作区里的 2.4NewProject，静态对照其 .pac、UILive.prefab、.meta 和现有 web-mobile 构建产物。课程代码读取随课保存的证据快照，打印资源引用、过滤结果和图集帧位置；它不依赖本机的 2.4NewProject，也不是 Editor Builder 或 Creator Runtime 的替代实现。项目 build/ 目录按项目 .gitignore 排除，因此本课只保留解释流程所需的 Config、UUID 和帧数据。

## 先说本例结果

AutoAtlas.pac 位于 assets/Live，配置 algorithm 为 MaxRects、allowRotation 为 true、filterUnused 为 true。目录中有 7 张候选图片；UILive.prefab 只引用 1.png、2.png 和 6.png 的 SpriteFrame。构建输出的 BundleMain 只有这 3 个 SpriteFrame 帧记录，它们共同指向生成贴图 1ac845df8；未被引用的 3.png、4.png、5.png、title.png 没进入这张图集。

生成文件是 build/web-mobile/assets/BundleMain/native/1a/1ac845df8.ba8ed.png，实际尺寸为 122×707。SpriteFrame UUID 仍是工程里的原 UUID；Auto Atlas 改的是它们构建后的贴图依赖和纹理矩形，不要求 Prefab 改成引用一个新的 SpriteAtlas 资源。

注意 UILive.prefab 中 Sprite 的 _atlas 字段为 null。这不代表 Auto Atlas 没起作用：Auto Atlas 是 Editor 构建阶段的图集打包配置，Prefab 仍通过 _spriteFrame 引用帧；生成的贴图及帧元数据在构建产物中体现。Auto Atlas .meta 中 packable:false 是 .pac 资源本身的标记，不是关闭图集打包。

## 从工程输入到 Web 构建文件

```text
assets/Live/AutoAtlas.pac.meta
  ├─ 图集范围：当前文件夹及子文件夹
  ├─ Filter Unused：根据工程引用过滤未使用帧
  └─ MaxRects / padding / rotation / bleed 等打包设置
                   ↓ Creator Editor Builder
BundleMain/config.42389.json
  ├─ UUID 表和 packs 索引
  ├─ import/04/0460cc30d.4e302.json：Prefab 与 SpriteFrame 序列化数据
  └─ native/1a/1ac845df8.ba8ed.png：生成的共享纹理
                   ↓ Creator 2.4.15 Runtime
SpriteFrame 的 rect、rotated、offset、originalSize + Texture2D
  → 计算 UV → Sprite assembler → 采样共享纹理
```

各阶段分别回答不同问题：

1. **范围**：.pac 按所在目录及子目录收集 SpriteFrame 候选资源，不会自动扫描项目所有图片。
2. **筛选**：本例 Filter Unused 已开启。构建时从被打包资源的引用关系判断是否使用；本例 Prefab 的三个 SpriteFrame 进入图集，其余四帧被过滤。它是构建筛选，不会删除工程源图。
3. **排版**：配置写明 MaxRects、padding=2、允许旋转、非强制 2 次幂。输出帧记录中的 rotated=1 与配置相符；裁剪矩形、偏移和原始尺寸仍需保留，才能还原 Sprite 原来的显示尺寸和 UV。
4. **序列化**：Bundle Config 将资源 UUID 映射到下标和 pack；帧记录保存矩形及共享贴图依赖，PNG 作为 native 文件单独输出。压缩 UUID 是发布索引形式；SpriteFrame 的逻辑 UUID 没有因打包而换掉。
5. **运行时**：CCSpriteFrame 反序列化帧矩形、旋转和尺寸，并连接 Texture2D；随后根据贴图尺寸计算 UV。Sprite 从 SpriteFrame 取得纹理，assembler 将 UV 写入顶点数据。

### 直接从本例核对的数据

| 资源 | 原 SpriteFrame UUID | Prefab 引用 | 构建帧矩形 | 旋转 |
| --- | --- | --- | --- | --- |
| 1.png | d6b4baf5-833f-4529-bb16-94f0e363007a | 是 | [3, 3, 180, 116] | 是 |
| 2.png | b77705ea-9931-4694-86df-86382af02e16 | 是 | [3, 450, 254, 72] | 是 |
| 6.png | 9d14b45f-1e42-4b9b-9597-350362f110e7 | 是 | [3, 189, 255, 74] | 是 |
| 3.png、4.png、5.png、title.png | 各自 .meta 中的 SpriteFrame UUID | 否 | 无构建帧记录 | — |

这里的 rect 来自构建 import pack 的解码后帧记录；rotated 标记影响 UV 对应关系。不要只拿 rect 的宽高当作原始 PNG 尺寸，本例原尺寸分别是 196×152、262×82、262×82。

## 对照 Creator 2.4.15 Runtime 源码

- [CCSpriteFrame.js](../../engine/2.4.15engine/cocos2d/core/assets/CCSpriteFrame.js)：_deserialize 读取帧矩形、偏移、原始尺寸和 rotated；_calculateUV 用 rect、贴图尺寸和旋转状态生成 UV。
- [CCSprite.js](../../engine/2.4.15engine/cocos2d/core/components/CCSprite.js)：Sprite 从当前 SpriteFrame 取得纹理并更新材质。
- [simple.js](../../engine/2.4.15engine/cocos2d/core/renderer/webgl/assemblers/sprite/2d/simple.js)：把 SpriteFrame 的 UV 写入渲染顶点。
- [config.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/config.js) 与 [pack-manager.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/pack-manager.js)：Runtime 如何读取 Config 的 UUID/pack 索引并从 pack 取得资源数据。
- [Creator 2.4 Auto Atlas 手册](https://docs.cocos.com/creator/2.4/manual/en/asset-workflow/auto-atlas.html)：目录范围、Filter Unused 和构建打包行为。
- [Creator 2.4 构建流程手册](https://docs.cocos.com/creator/2.4/manual/en/editor/publish/build-guide.html)：构建阶段如何处理 Auto Atlas、资源序列化与压缩。

Creator 2.4.15 引擎快照是 Runtime 源码，不包含完整 Editor Builder。因而 MaxRects 的具体实现细节不能仅从本地 Runtime 源码还原；本课把 .pac 配置和真实构建输出作为 Editor 构建的输入/输出证据，再用 Runtime 源码解释输出帧如何被消费。配置显示使用 MaxRects，不能据此声称已静态审阅编辑器内的排版器实现。

## Auto Atlas 与两种容易混淆的 Atlas

- **Auto Atlas**：.pac 配置供 Editor 构建时收集、筛选并合图；本例构建出一个 native PNG 和 SpriteFrame 记录。
- **SpriteAtlas**：运行时 Asset 类型 cc.SpriteAtlas，通常用于按帧名取得一组 SpriteFrame；它不是本例 .pac 文件的运行时类型。可查看 [CCSpriteAtlas.js](../../engine/2.4.15engine/cocos2d/core/assets/CCSpriteAtlas.js)。
- **Dynamic Atlas**：运行时将满足条件的 SpriteFrame 动态加入纹理图集；不是 Editor 在构建时输出的 Auto Atlas。实现入口在 [dynamic-atlas](../../engine/2.4.15engine/cocos2d/core/renderer/utils/dynamic-atlas)。

共享纹理有利于相同材质状态下合批，但同一图集不保证整个 UI 只有一个 draw call；材质、渲染顺序、遮罩和缓冲区容量都可能形成批次边界。

## 运行课程分析器

```sh
cd learn_2.4cocoscreator/s102_auto_atlas_build_pipeline
deno task check
deno task analyze
```

分析器读取 samples/auto-atlas-build.json，并用 Creator 2.4.15 的压缩 UUID 规则把 Bundle Config 索引映射回资源 UUID。预期观察到 7 张候选图、3 个 Prefab 引用、3 个打包帧，以及一张 122×707 的共享贴图。fixture 是当前工程构建的静态证据快照；项目再次构建后，需要重新比对并更新快照。

## 学完后自查

1. 为什么 AutoAtlas.pac 在 Live 文件夹中，UILive.prefab 却能引用里面的 SpriteFrame？
2. 本例中，Prefab 保存的 SpriteFrame UUID 与构建生成的 atlas texture key 各自是什么？
3. Filter Unused 过滤的是工程文件还是本次构建输入？
4. rotated、rect、offset、originalSize 为什么要一起保存在帧记录中？
5. 运行时从 SpriteFrame 到最终采样纹理，依次经过哪些 Runtime 对象？
