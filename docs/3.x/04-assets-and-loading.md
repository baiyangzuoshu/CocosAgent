# 3.8.7：资源身份、加载与释放

## 范围与官网基线

公开行为以 3.8 手册的[资源工作流](https://docs.cocos.com/creator/3.8/manual/zh/asset/asset-workflow.html)、[`.meta` 文件](https://docs.cocos.com/creator/3.8/manual/zh/asset/meta.html)、[加载资源](https://docs.cocos.com/creator/3.8/manual/zh/asset/dynamic-load-resources.html)、[Asset Manager](https://docs.cocos.com/creator/3.8/manual/zh/asset/asset-manager.html)、[Asset Bundle](https://docs.cocos.com/creator/3.8/manual/zh/asset/bundle.html)和[资源释放](https://docs.cocos.com/creator/3.8/manual/zh/asset/release-manager.html)为基准。手册说明 `resources.load` 使用 `assets/resources` 下的相对路径；其他动态资源通常通过 Bundle；预加载只下载、不完成反序列化/初始化；已加载的资源进入 Asset Manager 缓存。贴图子资源例如 SpriteFrame 需要使用手册所列子路径与类型，不能仅凭图片文件名判断返回对象。

本篇追踪 `engine/3.8.7engine/cocos/asset/asset-manager/` 与场景切换。`.meta` 的生成和导入器属于 Creator 编辑器工作流；`library/` 是生成结果。JSON 动态加载/引用释放及真实磁盘场景切换均已分别在 Chrome 预览和 Mac 原生进程打点；`native/cocos/` 的底层下载实现及 Android/iOS 等其他原生平台仍需单独研究。

## 示例中的身份链

`assets/scene/main.scene.meta` 的 UUID 为 `7c3e7fab-7b1e-4865-ba84-3cf81b48b9fb`。场景 `.scene` 中的三个预制体实例分别以 `__uuid__` 指向 `islands.prefab`（`ccc3a755-7d3d-4304-aa3b-ca4792d79d9f`）、`soldier.prefab`（`cfc53c4e-7956-482b-aebc-3fb1dcd36eef`）和 `grassGoup.prefab`（`5e4d48c4-0e34-45af-a268-89485197e8bc`）。场景还在 `:2182-2190` 引用 skybox 的纹理立方体子资源 `5af201b5-5951-4e2c-a81f-ac4aad9132cb@b47c0`；其源文件 `sunnySkyBox.jpg.meta` 的主 UUID 没有 `@`。`soldier.FBX.meta` 则展示同一 FBX 下多个 Mesh、Skeleton、Animation 子资源的 `主 UUID@子 ID`。因此引擎诊断要追到**被引用的子资源 UUID**，再回到主源文件及导入设置。

## 请求、序列化和缓存

```text
resources / Bundle.load(path, type)
  → Bundle.load：RequestType.PATH + bundle 名
  → assetManager.loadAny
  → pipeline：preprocess → load
  → config/请求项 → packManager/fetch → parser.parse(import)
  → deserialize → dependUtil/getDepends → 依赖子请求
  → setProperties → Asset.onLoaded（若适用）→ assets 缓存 → 回调
```

`bundle.ts::load` 转给 `AssetManager.loadAny`。`asset-manager.ts` 将正常管线设为 `preprocess → load`，下载管线设为 `preprocess → fetch`；路径转换管线为 `parse → replaceOverrideAsset → combine`，其中资源覆盖替换是 3.8.7 这版的额外步骤。`config.ts::getInfoWithPath/getSceneInfo` 参与 Bundle 路径/场景名查找；`load.ts::loadOneAssetPipeline` 缓存命中时给 Asset `addRef()`，未命中时经 `packManager`、`parser`、`deserialize.ts` 与 `depend-util.ts` 找依赖。`loadDepends` 临时持有资源，子请求完成后填回引用、调用 `Asset.onLoaded`、加入缓存并将结果交给回调。这里的 `Asset.onLoaded` 是资源加载钩子，不是组件脚本的 `onLoad`。

`asset-manager.ts::preloadAny` 走下载管线，不能把它的完成回调当作已获得 Prefab/Texture。`bundle.ts::loadScene` 得到 `SceneAsset`，给内部 Scene 设置 ID 与名称；真正运行仍由 `Director.loadScene/runSceneImmediate` 决定。`shared.ts` 对 `assets` 采用 `EDITOR ? WeakCache : Cache`，`files/parsed/bundles` 仍是普通缓存；这是**编辑器标志控制的分支**，不要把编辑器进程与浏览器预览混称同一缓存行为。

`config.ts::getInfoWithPath` 按规范化路径查表，同路径资源未指定类型时返回第一项；`getSceneInfo` 使用 `.scene` 名称。`url-transformer.ts::parse` 处理 Bundle 重定向，并在目标 Bundle 尚未加载时报错；`replaceOverrideAsset` 仅在 `assetsOverrideMap` 有对应项时改目标请求；`combine` 以 UUID、版本、扩展名和 import/native 基地址组成 URL。`fetch.ts` 还会发现依赖并提交下载子任务，但不完成对象构造。`utilities.ts::cache` 排除 SceneAsset 和默认资源，并受 `cacheAsset` 配置控制，所以 `assets.has(uuid)` 不是任何加载结果都应为真的通用断言。

## 引用、场景与释放

`cocos/asset/assets/asset.ts::addRef/decRef` 保存引用数。`release-manager.ts::_free` 在非强制释放时检查正引用和循环依赖，从 `assets` 缓存移除目标，递减其依赖引用；非编辑器环境递归尝试释放依赖并销毁对象。此实现有 `_dontDestroyAssets` 排除表；在 `EDITOR` 条件下不递归销毁依赖，也不对资源对象调用 `destroy`。资源对象缓存与浏览器/平台的原始文件缓存是两层，排查时分别看待。

`load.ts` 命中缓存和把对象交给请求项时会暂时增加引用；`utilities.ts::setProperties` 将依赖对象填回其拥有者时也 `addRef`。但 `load.ts` 在调用完成前执行 `clear(task,true)`，会对请求项 `decRef(false)`；加载期间的其他临时引用也会撤销。因此**获得加载回调并不保证净引用数增加 1**。单个 `refCount` 数字没有“节点数量”的直接含义，必须结合请求项清理、依赖边和显式持有者解释。

`director.ts::runSceneImmediate:394-465` 先初始化新场景并重接常驻节点；旧场景 `destroy()` 后，在非 `EDITOR` 分支调用 `releaseManager._autoRelease`，随后清理延迟销毁。`_autoRelease` 递减旧场景依赖，把常驻节点记录的资源引用转给新场景。此示例 `main.scene:39` 的 `autoReleaseAssets` 为 `false`，所以旧场景依赖的 `decRef(false)` 不会仅因该调用而安排自动释放；不能把“场景切换”推断成“所有旧资源立刻销毁”。3.8 手册同样强调动态引用可能不在静态依赖表内，长期持有应按 `addRef/decRef` 管理。

`assetManager.releaseAsset(asset)` 和 `Bundle.release(path)` 传 `force=true`，跳过目标资源的引用数保护；`releaseUnusedAssets` 则非强制尝试。`releaseAll` 也强制释放。对仍被场景使用的资源调用强制释放会造成失效。`removeBundle` 管的是 Bundle 配置缓存，与释放其中全部 Asset 不是同一操作。

## 游戏开发诊断顺序

1. 从手册允许的入口确定 `resources` 或具体 Bundle、相对路径、类型及子资源后缀；从场景 `__uuid__` 和 `.meta` 对上主/子资源身份。
2. 沿 `Bundle.load → loadAny → config/preprocess → packManager → parser/deserialize → loadDepends` 找首个失败点；分开判断配置、文件、反序列化、依赖和初始化钩子。
3. 释放问题记录 UUID、`refCount`、场景静态依赖、动态持有、常驻节点、`autoReleaseAssets`、`EDITOR` 标志与实际释放 API；不要直接用 `releaseAsset` 验证仍在渲染的资源。

2026-10-02 在 Creator 3.8.7 Chrome 预览中，以示例场景没有直接引用的 `hdcSky.prefab` 做冷缓存实验（[原始转录](../agent-foundation/traces/3.8.7-asset-lifecycle.jsonl)）：起初 `assets.has(uuid)=false`；`preloadAny` 成功并返回 8 个请求项，缓存仍为 false；`loadAny` 返回 `Prefab`，与缓存对象同一实例，直接依赖 2 项，但回调所见 `refCount=0`。显式 `addRef` 后 `releaseUnusedAssets` 仍保留它；`decRef` 使引用归零，当场仍在缓存，约 200ms 后缓存移除且对象无效。这些结果只证明此浏览器预览及该预制体。

后续隔离探针复测同一预制体得到相同的预加载请求项数、缓存身份、直接依赖数与释放结果。对 `main.scene` 的 UUID 单独 `preloadAny` 得到 5 个请求项，随后 `loadAny` 返回 `SceneAsset`；场景 UUID 始终不在 `assets` 缓存，活动 Scene 没有切换。再以两个内存 Scene 和一个只登记在旧 Scene 依赖表的内存 Asset **直接**调用 `_autoRelease`：`autoReleaseAssets=false` 使引用降至 0 后仍缓存有效；`true` 使缓存移除、对象失效。独立内存 Asset 在 `refCount=1` 时经非强制释放仍保留，而 `releaseAsset` 在引用数仍为 1 时强制移除。这验证了资源管理器的分支，不等于已经测试 Director 实际场景切换。

2026-10-03 又在 Chrome 预览中通过 `cc.director.runSceneImmediate` 真正切换内存 Scene：将独立内存 Asset 登记为旧场景依赖后，`autoReleaseAssets=false` 分支引用降至 0，200ms 后仍缓存有效；`true` 分支引用也降至 0，但随后从缓存移除并失效。再给常驻 Node 的 Sprite 组件赋予独立 Asset 并登记旧场景依赖：注册常驻节点后资源引用为 2；切到另一内存 Scene 时节点确实转移，资源仍缓存且引用为 2；移除常驻身份并再次切换后引用归零，资源从缓存移除、失效（[原始转录](../agent-foundation/traces/3.8.7-asset-lifecycle.jsonl)）。新内存 Scene 均预先建立 `dependUtil._depends` 记录，使 `_autoRelease` 可以将常驻节点依赖登记为新场景的 `persistDeps`。

预览已重载，活动场景 UUID 恢复为示例 `main.scene` 的 `7c3e7fab-7b1e-4865-ba84-3cf81b48b9fb`。上述探针没有修改工程或引擎文件；它验证的是浏览器预览中的内存对象路径。

## 磁盘资源、编辑器导入与 Mac 原生核验

2026-10-03 对真实 `main.scene` 核对：场景文本共 6 次 `__uuid__` 引用、4 个不同 UUID；Chrome 预览中活动 Scene 的依赖表有 5 条直接边（4 个不同 UUID），递归依赖 53 项均已缓存。单看 `soldier.prefab` 有 14 条直接边、17 项递归依赖，其中 11 个 UUID 带 `@` 子资源标识，包含 FBX 导入的 Mesh、Skeleton 和 AnimationClip。这些是当前示例与预览的观测数，不是引擎常量；记录见[3.8.7 磁盘/导入转录](../agent-foundation/traces/3.8.7-disk-import-validation.jsonl)。

示例 `assets/resources/stage4-probe.json` 由 Creator 3.8.7 导入，编辑器生成 `resources.meta` 和 `json` importer `.meta`（UUID `f6a2d4ff-2327-4d1c-abe8-a8578a43d9fe`），并产生 `library/f6/` 下的导入文件。新预览页面起初对象缓存没有该 UUID；`resources.load('stage4-probe', JsonAsset)` 返回数据版本 `3.8.7` 的 `JsonAsset`，与缓存同实例，回调净 `refCount=0`；只增减探针自己的引用后，它从缓存移除并失效。资源及编辑器生成的 `.meta` 保留用于复测。

2026-10-03 用 Creator 3.8.7 资源管理器创建第二个真实场景 `assets/scene/stage4-empty.scene`（UUID `c89ae6fc-2958-4647-ab1a-63bbdfbcabc8`），在 Chrome 预览中调用 `director.loadScene('stage4-empty')`。旧 `main.scene` 的静态依赖包含 `soldier.prefab`（`cfc53c4e-7956-482b-aebc-3fb1dcd36eef`）；新场景的静态依赖仅有两个 skybox 子资源，不含该 Prefab。切换前 Prefab 缓存命中且 `refCount=1`。源场景默认 `autoReleaseAssets=false` 时，切换回调里引用降为 0，缓存仍在且对象有效，350ms 后采样仍然如此。重新载入预览后，仅把**活动的磁盘反序列化 Scene 对象**的 `autoReleaseAssets` 在内存中设为 `true`，再次切换：回调里引用降为 0，对象暂时仍有效；350ms 后采样已从缓存移除并失效（[原始转录](../agent-foundation/traces/3.8.7-disk-scene-switch.jsonl)）。这只证明当前 3.8.7 Chrome 预览的该真实依赖分支；源 `.scene` 仍为 `false`，未验证保存开关后的编辑器/构建流程，采样间隔也不是固定释放耗时。

按[3.8 原生发布手册](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/native-options.html)完成 Mac 构建、Make 和运行，生成 Xcode 工程与 `CocosGame.app`；资源包中有新 JSON，原生窗口显示示例的岛屿、树木、角色及天空。随后在生成包的 `application.js` 临时注册场景启动后探针，原生进程记录冷缓存 `resources.load` 回调：UUID/版本正确、与缓存同实例、净 `refCount=0`；探针 `addRef` 后为 1，非强制 `releaseUnusedAssets` 仍保留它；`decRef` 后立即仍缓存，350ms 后采样已移除且对象失效（[原生日志](../agent-foundation/traces/3.8.7-mac-native-asset-lifecycle.jsonl)）。3.8 Mac 沙盒需把日志写入 `jsb.fileUtils.getWritablePath()`。

随后将 `stage4-empty.scene` 纳入 Mac 包场景列表，并在生成包 `application.js` 临时注册真实 `director.loadScene('stage4-empty')` 探针。旧 `main.scene` 独有 `soldier.prefab` 切换前缓存命中、`refCount=1`；源场景 `autoReleaseAssets=false` 时，切换回调引用降至 0 但仍缓存有效，约 350ms 采样仍有效；另一次独立启动将活动旧 Scene 开关改为 `true`，回调时仍缓存有效，采样时已移出缓存并失效（[原生场景切换日志](../agent-foundation/traces/3.8.7-mac-native-disk-scene-switch.jsonl)）。Mac 原生与 Chrome 的观测分支一致；源 `.scene` 仍为 `false`，未验证将开关保存到场景后的构建行为。探针日志写入 `jsb.fileUtils.getWritablePath()`；包内脚本已恢复并以 SHA-256 核对。350ms 是采样等待，不等于固定释放耗时。`native/cocos/` 底层下载实现及 Android/iOS 仍需另行研究。各运行面的证据界限见[验证矩阵](../agent-foundation/asset-validation-matrix.md)。
