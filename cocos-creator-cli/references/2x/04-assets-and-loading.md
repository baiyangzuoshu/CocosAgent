# 2.4.15：资源身份、加载与释放

## 范围与官网基线

本篇以 2.4 手册的[资源工作流程](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/index.html)、[Asset Manager](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/index.html)、[Asset Bundle](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/bundle.html)和[资源释放](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/release-manager.html)为公开行为基线，分析 `engine/2.4.15engine/` 的 Web 运行时代码，并用 `2.4.15NewProject/` 的源文件核对资源身份。官网把 `cc.resources.load` 与 Bundle 的 `load` 作为动态加载入口；预加载只完成必要下载，不完成反序列化和初始化；加载结果进入 `cc.assetManager` 缓存。`cc.loader` 仍有兼容入口，但本研究以 2.4 新的 Asset Manager 为主。

手册要求资源及对应 `.meta` 一起维护 UUID。此处的引擎源码覆盖运行时反序列化、依赖和释放；编辑器导入器、生成 `library/`、构建 Bundle 配置的完整实现不在这条运行时调用链里。因此下面将**源资源身份**和**运行时请求/缓存身份**分开。

## 示例中的身份链

`assets/Texture/HelloWorld.png.meta` 的主 UUID 是 `6aa0aa6a-ebee-4155-a088-a687a6aadec4`，其中 `HelloWorld` 子资源 `sprite-frame` 的 UUID 是 `31bc895a-c003-4566-a9f3-2e54ae1c17dc`，`rawTextureUuid` 又指向主贴图 UUID。`assets/Scene/helloworld.fire:431-432` 的 `cc.Sprite._spriteFrame` 保存的是**子资源 UUID**。同样，`singleColor.png.meta` 的 SpriteFrame UUID `410fb916-8721-4663-bab8-34397391ace7` 被场景 `:340-341` 引用，贴图主 UUID 是 `a8027877-d8d6-4645-97a0-52d4a0123dba`。

这说明“场景文本没写贴图主 UUID”不等于贴图无用：场景 → SpriteFrame → Texture 是两层资源依赖。源 `.meta` 提供 UUID 与导入设置；预览/构建时的运行时 `Config` 把路径、场景名或 UUID 解析成请求项及文件地址（`cocos2d/core/asset-manager/config.js::getInfoWithPath/getSceneInfo`，`preprocess.js`）。不能把 `library/` 中的生成文件当成维护 UUID 的源文件。

## 从请求到资源对象

```text
cc.resources / Bundle.load(path, type)
  → Bundle.load：标记 RequestType.PATH 与 bundle 名
  → cc.assetManager.loadAny
  → pipeline：preprocess → load
  → 请求解析为 UUID/URL → packManager/fetch → parser.parse(import)
  → deserialize → dependUtil/getDepends → 子请求加载
  → setProperties 填回引用 → asset.onLoad（若适用）
  → assets 缓存 → 回调获得 Asset
```

入口分别见 `bundle.js::load` 和 `CCAssetManager.js::loadAny`。`CCAssetManager.js` 构造函数把正常管线接成 `preprocess → load`，下载管线接成 `preprocess → fetch`，URL 转换管线接成 `parse → combine`。`load.js::loadOneAssetPipeline` 先从 `assets` 查缓存，缓存命中会给资源 `addRef()`；未命中经 `packManager.load`、`parser.parse`、`loadDepends`。`deserialize.js` 委托 `cc.deserialize`，`depend-util.js` 从序列化数据提取依赖；`loadDepends` 在加载依赖期间临时 `addRef`，完成后 `decRef(false)`，填引用、调用资源对象的 `onLoad` 并缓存。这里的 `Asset.onLoad` 不是组件生命周期 `Component.onLoad`。

`CCAssetManager.js::preloadAny` 走 `fetchPipeline`，返回下载后的请求项，不返回已反序列化的 Asset。Bundle 的 `preload`/`load` 同样分两步；预加载后仍要调用 `load`。`bundle.js::loadScene` 加载 `SceneAsset` 并设置场景 ID/名称，**不运行场景**；真正切换由 `CCDirector.loadScene/runSceneImmediate` 负责。`cc.resources` 本质上是内建 Bundle，不意味着任意 `assets/` 路径都能用 `cc.resources.load` 访问。实际 Chrome 预览中，`helloworld` 场景预加载完成返回 4 个请求项且 `assets` 没有场景 UUID；之后 `loadAny` 返回 `cc_SceneAsset`，当前场景仍为 `helloworld`，场景 UUID 仍不在对象缓存中（[原始转录](../agent-foundation/traces/2.4.15-asset-lifecycle.jsonl)）。

请求解析还有两处容易误判。`config.js::getInfoWithPath` 按规范化路径查表，若未传类型而同路径有多项，返回第一项；`getSceneInfo` 则按 `.fire` 场景名查找。`urlTransformer.js::parse` 会处理 Bundle 重定向，目标 Bundle 尚未加载时直接报错；`combine` 才结合 Bundle 的 import/native 基地址、UUID、版本号和扩展名生成请求 URL。`fetch.js` 不只下载顶层文件，还从数据中取得依赖并通过子任务继续下载；其完成不代表 `load.js` 已建立对象。`shared.js` 分别保存 `assets`（资源对象）、`files`（下载结果）、`parsed`（解析结果）与 `bundles`（配置实例）。`utilities.js::cache` 特意排除 SceneAsset，故“所有加载结果都能在 `assets` 中找到”不是此版本源码的无条件规则。

## 引用、缓存与场景切换

`cocos2d/core/assets/CCAsset.js::addRef/decRef` 维护 `refCount`；`decRef()` 默认交给 `releaseManager.tryRelease`。`releaseManager.js::_free` 在非强制模式下检查正引用与循环引用，然后从 `assets` 移除、递减依赖资源引用并尝试递归释放，最后 `destroy` 资源。释放是资源对象和依赖图的操作，不是仅删 `files/parsed` 下载缓存。`releaseManager.js::visitNode/visitComponent` 会走访常驻节点组件属性中的 Asset 引用，`_addPersistNodeRef` 等方法用于场景切换时转移其引用。

引用计数的来源不止业务代码显式 `addRef`：`load.js` 的缓存命中会暂时增加一次引用，`utilities.js::setProperties` 把依赖对象填入拥有者时也 `addRef`；`load.js` 在完成前调用 `clear(task,true)`，对请求项执行 `decRef(false)`，加载中的其他临时引用也会撤销。故**回调里拿到资源不等于净引用数增加 1**；需要长期持有时业务侧应按手册显式 `addRef`。预览中对已缓存 SpriteFrame 再次 `loadAny`，回调前后均为 `refCount=2`；这个数字包含先前额外加载的 SceneAsset，不是启动基线。不能把 `refCount` 简单当成“持有它的节点数”。

`CCDirector.js::runSceneImmediate:422-470` 先调用 `scene._load`、重接常驻节点，再在非编辑器运行时调用 `_autoRelease(oldScene,newScene,persistNodes)`，之后销毁旧场景并执行延迟销毁。`_autoRelease` 会递减旧场景静态依赖；传给 `decRef` 的 `autoRelease` 参数来自 `oldScene.autoReleaseAssets`（测试环境另论）。此示例的 `helloworld.fire:51` 为 `autoReleaseAssets: false`，因此不能以此场景直接声称“切换后自动销毁所有旧资源”。手册也提醒动态赋给节点/组件的资源可能未进入原场景的静态依赖，长期持有时应按引用计数管理。

显式 `cc.assetManager.releaseAsset(asset)` 与 `Bundle.release(path)` 调用 `tryRelease(asset, true)`；`releaseManager._free` 的强制分支跳过根资源的 `refCount` 检查。依赖资源仍沿非强制路径检查引用。对仍被场景显示对象使用的纹理、SpriteFrame 或预制资源强制释放会破坏正在使用的对象。`releaseUnusedAssets` 才走非强制尝试；`releaseAll` 是强制释放。`removeBundle` 删除 Bundle 配置缓存的含义需要与资源对象释放分开，不能据名称推断它清空了已加载资源。

## 游戏开发诊断顺序

1. 先确认请求使用 `resources`、哪个 Bundle、相对路径和资源类型，再从 `.meta` 与场景 `__uuid__` 确认真实资源身份；同名或主/子资源不能混为一项。
2. 加载失败时沿 `Bundle.load → loadAny → preprocess/config → packManager → parser/deserialize → loadDepends` 找到首个错误，区分“未进入 Bundle 配置”“文件下载失败”“反序列化类型/依赖失败”。
3. 释放异常时分别记录资源 UUID、`refCount`、是否场景静态依赖、是否动态赋值、常驻节点和场景 `autoReleaseAssets`；确认调用的是 `decRef`、`releaseAsset`、`Bundle.release` 还是 `releaseAll`。

2026-10-02 在 Creator 2.4.15 Chrome 预览中还创建了一个仅存在于内存的 `cc.Asset`，给予临时 UUID 并加入 `assets` 缓存：`addRef` 后调用非强制 `tryRelease`，200ms 后资源仍有效且 `refCount=1`；再 `decRef` 后立即缓存仍在、`refCount=0`，约 200ms 后缓存移除且对象无效（[转录](../agent-foundation/traces/2.4.15-asset-lifecycle.jsonl)）。这验证了释放管理器的引用门槛和异步清理，但**不是磁盘资源从冷缓存加载的实验**。

后续隔离探针分别创建两个内存 Scene 和一项仅属于旧 Scene 依赖表的内存 Asset，直接调用 `_autoRelease`：`autoReleaseAssets=false` 时引用降至 0，约 150ms 后仍在缓存且有效；`true` 时同样降至 0，但缓存移除且对象无效。另对 `refCount=1` 的独立内存 Asset 先做非强制 `tryRelease`，它保持有效；随后 `releaseAsset` 立即使缓存移除、对象失效，虽然 `refCount` 仍为 1。这些结果验证释放管理器本身的分支，**未经过 Director 真正切场景**。本轮还复核了场景预加载得到 4 个请求项、`loadAny` 返回不入对象缓存的 SceneAsset；同一 SpriteFrame 再次加载返回缓存中的同一实例，前后引用数净值均为 3。该数字受此前多次加载 SceneAsset 影响，不能当作启动基线。

2026-10-03 又在 Chrome 预览中通过 `cc.director.runSceneImmediate` 真正切换内存 Scene：将独立内存 Asset 登记为旧场景依赖后，`autoReleaseAssets=false` 分支引用降至 0，180ms 后仍缓存有效；`true` 分支引用也降至 0，但随后从缓存移除并失效。再给常驻 Node 的 Sprite 组件赋予独立 Asset 并登记旧场景依赖：注册常驻节点后资源引用为 2；切到另一内存 Scene 时节点确实转移，资源仍缓存且引用为 2；移除常驻身份并再次切换后引用归零，资源从缓存移除、失效（[原始转录](../agent-foundation/traces/2.4.15-asset-lifecycle.jsonl)）。这验证了 Director 路径的分支和常驻节点转移，但这些场景与资源均由控制台构造，不能代替磁盘场景中复杂依赖的验证。

内存 Scene 探针必须为新场景建立 `dependUtil._depends` 记录；`_autoRelease` 只有在该记录存在时才能把常驻节点依赖写入新场景的 `persistDeps`。首次省略记录时，移除常驻身份后资源仍有 1 个引用；补齐记录后再次切场景才释放。浏览器预览已重载并核对活动场景回到 `helloworld`。探针未修改工程或引擎文件，也没有强制释放活动场景资源。

## 磁盘资源、编辑器导入与 Mac 原生核验

2026-10-03 对真实 `helloworld.fire` 逐层核对：场景文本直接出现 2 个不同资源 UUID；Chrome 预览中活动 Scene 的依赖表有 5 条直接边（3 个不同 UUID），递归依赖 6 项均已缓存，包括 `HelloWorld` SpriteFrame 和对应贴图主资源。直接边包含场景文本未以 `__uuid__` 写出的材质，不能把文本引用数当成运行时完整依赖数。原始计数与环境见[2.4.15 磁盘/导入转录](../agent-foundation/traces/2.4.15-disk-import-validation.jsonl)。

为验证真正冷缓存普通资源，在示例的 `assets/resources/stage4-probe.json` 放入最小 JSON。Creator 2.4.15 自动生成 `resources.meta` 和该文件的 `json` importer `.meta`（UUID `5ade5460-c142-47dc-8dd0-82322301d6cc`），并产生 `library/imports/5a/` 下的导入产物。新预览页面起初 `assets.has(uuid)=false`；`cc.resources.load('stage4-probe', cc.JsonAsset)` 返回 `cc_JsonAsset`，数据版本为 `2.4.15`，与对象缓存同实例，回调净 `refCount=0`；只增减探针自己的引用后，对象移出缓存并失效。这个资源和编辑器生成的 `.meta` 保留在示例中，供复测。原有 `singleColor.png` 在实验前已入缓存，不能作为冷加载证据。

2026-10-03 又通过 Creator 2.4.15 创建并保存第二个真实场景 `assets/Scene/stage4-empty.fire`（UUID `8e14afdb-015b-4edd-99ce-d8ba7b7f8eee`），在 Chrome 预览中调用 `cc.director.loadScene('stage4-empty')`。旧 `helloworld.fire` 的静态依赖表包含 `HelloWorld` SpriteFrame `31bc895a-c003-4566-a9f3-2e54ae1c17dc`，新场景加载后的静态依赖表为空；这个 SpriteFrame 切换前在对象缓存中，`refCount=1`。源文件默认 `autoReleaseAssets=false` 时，切换回调里它降至 0，但仍缓存有效，350ms 后采样也仍有效。重新载入预览后，仅把**活动的磁盘反序列化 Scene 对象**的 `autoReleaseAssets` 在内存中改为 `true`，再切到同一磁盘场景：回调里引用归零而对象暂时仍有效，350ms 后采样已移出缓存并失效（[原始转录](../agent-foundation/traces/2.4.15-disk-scene-switch.jsonl)）。这验证了当前 2.4.15 Chrome 预览中真实场景依赖的开关分支；源 `.fire` 仍为 `false`，未验证把开关保存进场景后的编辑器/构建行为。350ms 是采样间隔，不是固定释放耗时。

按[2.4 原生发布手册](https://docs.cocos.com/creator/2.4/manual/zh/publish/publish-native.html)在对应 Creator 中构建、编译并运行 Mac 包：生成 Xcode 工程和 `hello_world-desktop.app`，资源包中有该 JSON，窗口显示 Cocos 标志和 `Hello, World!`。随后在生成包的启动脚本中临时加入 JSON 探针，原生进程记录了冷缓存 `cc.resources.load` 回调：UUID/数据版本正确、与缓存同实例、净 `refCount=0`；探针 `addRef` 后为 1，非强制 `releaseUnusedAssets` 仍保留它；`decRef` 后立即仍缓存，350ms 后采样已移除且对象失效（[原生日志](../agent-foundation/traces/2.4.15-mac-native-asset-lifecycle.jsonl)）。包内脚本已恢复。

随后把由 Creator 创建的 `stage4-empty.fire` 纳入 Mac 包场景列表，并在生成包启动脚本中临时加入真实 `cc.director.loadScene('stage4-empty')` 探针。旧 `helloworld.fire` 独有 SpriteFrame 切换前缓存命中、`refCount=1`；源场景 `autoReleaseAssets=false` 时，切换回调中降至 0 但仍缓存有效，约 350ms 采样仍有效；在另一次独立启动中将活动旧 Scene 的开关改为 `true`，回调中仍缓存有效，采样时已移出缓存并失效（[原生场景切换日志](../agent-foundation/traces/2.4.15-mac-native-disk-scene-switch.jsonl)）。这与 Chrome 的观测分支一致；源 `.fire` 仍为 `false`，没有验证将该设置保存到场景后的构建结果。原生包脚本已恢复并核对 SHA-256。350ms 是采样等待，不是固定释放时长；Android/iOS 和其他原生平台仍需另行验证。分面结论见[验证矩阵](../agent-foundation/asset-validation-matrix.md)。
