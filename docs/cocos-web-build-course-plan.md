# Creator Web 资源导入、打包与运行时课程计划

本专题从工程资源出发，沿 `.meta` 身份、编辑器构建结果、Bundle 配置，追到 Web 运行时的 `Asset` 与 `AssetManager`。目标是理解职责和数据如何交接，不复刻闭源 Builder，也不把构建产物误当作引擎源码。

## 先看整条链

~~~text
源文件 + .meta
  → 编辑器识别主资源和子资源 UUID
  → 场景/Prefab 保存 UUID 引用
  → 构建输出 Bundle config、import pack、native 文件
  → AssetManager 用 Config 把请求转成文件 URL
  → 浏览器取得文件，解析依赖，创建并缓存 Asset
~~~

学习时把这四个词分开：

- **UUID：** 资源身份，不是 URL。
- **URL：** 浏览器请求的文件地址。
- **文件：** import pack 或 native 数据；一个 pack 可能含多个资源。
- **Asset：** 解析后在运行时使用和缓存的对象。

所以一个文件可以装多个 Asset；一个 Asset 也可能依赖多个文件。课程从这条区别展开。

## 版本与证据边界

| 项目 | 样例/编辑器版本 | 源码基线 | Web 输出 |
| --- | --- | --- | --- |
| Creator 2.4 | 2.4.15 | `engine/2.4.15engine/` | `2.4NewProject/build/web-mobile/` |
| Creator 3.8 | 3.8.8 | `engine/3.8.7engine/` | `3.8NewProject/build/web-mobile/` |

- 两份样例都已有 Web 构建，本专题先读取现有输出，不重复构建。实际浏览器加载结果须在对应课程中另行观察。
- `.meta`、场景序列化文件和 `build/web-mobile/` 是样例工程/编辑器输出证据；AssetDB 导入器与完整 Builder 不属于本地运行时源码快照。
- `engine/` 仅用于追踪运行时职责；课程 TS 代码每课独立，目录与职责尽量映射到本版本源码，并明确删去的旁支。
- 2.4 与 3.8 的文件名和配置字段不强求一致。样例使用 Creator 3.8.8，源码说明限定在本仓库 3.8.7 快照。

## 已观察到的构建事实

- 2.4 输出包含 `assets/main`、`assets/internal` 和 `assets/BundleMain`。Bundle 配置文件为 `config.<hash>.json`；`src/settings.f161e.js` 记录启动场景和各 Bundle 版本。
- 3.8 输出当前包含 `assets/main` 和 `assets/internal`，没有 `assets/BundleMain`。`src/settings.json` 记录 `projectBundles`、`bundleVers` 等设置。现有输出能证明本次构建结果，不能单凭它解释 Bundle 为什么未生成。
- 2.4 `assets/BundleMain.meta` 有 `isBundle: true`；3.8 的同名目录 `.meta` 没有 Bundle 配置数据。Creator 3.8 手册说明 Bundle 配置从 3.8 起移至“项目设置 → Bundle 配置”，所以要从 3.8 工程配置和构建日志继续核实，不能把两版 `.meta` 当成同一种 Bundle 配置。
- 2.4 `Texture/HelloWorld.png.meta` 展示贴图主 UUID、SpriteFrame 子 UUID 和 `rawTextureUuid`；3.8 模型 `.FBX.meta` 展示主资源及多个导入子资源。两者用于从源文件追到场景引用和构建索引。
- 2.4 的配置键包含 `uuids`、`paths`、`scenes`、`packs`、`deps`、`redirect`、`versions`；3.8 另有 `extensionMap`、`dependencyRelationships`、`hasPreloadScript` 等字段。本专题以当前构建文件为准，不把字段差异抹平。

## 课程序列（第 89–94 课，已落地）

| 课 | 主题 | 本课问题 | 独立代码增量与证据 |
| --- | --- | --- | --- |
| 89 | Web 构建产物地图 | 页面入口、引擎脚本、项目脚本、Bundle 配置和资源文件分别在哪里？ | 分别为 2.4/3.8 写一份输出清单模型；读取两份现有 `build/web-mobile/` 和启动设置。 |
| 90 | `.meta`、Asset 身份与导入设置 | 源文件、主 UUID、子资源 UUID、导入器设置和场景引用如何对应？Bundle 配置在两版中保存在哪里？ | 分别建模 2.4 贴图子资源与 3.8 FBX 子资源；对照各自 `.meta`、场景文件和 3.8 项目 Bundle 配置。 |
| 91 | `Asset`、序列化引用与依赖 | 场景中的 UUID 怎样变成资源对象和依赖边？`import` 数据与 `native` 文件各是什么？ | 分别模拟一个场景到 Prefab/贴图子资源的引用图，并映射实际 Bundle 输出。 |
| 92 | `AssetManager` 加载管线 | `Bundle.load` 如何经过请求预处理、查配置、下载、解析、反序列化、依赖加载和缓存？预加载完成了什么？ | 按本版源码职责搭建精简管线：preload 走 `preprocess → fetch` 并递归预取依赖、不创建 Asset；load 走 `preprocess → load`，解析依赖并创建缓存 Asset。 |
| 93 | Bundle 索引与文件 URL | `paths`/UUID/版本/扩展名如何定位 `import` 或 `native` 文件？打包配置如何影响输出结构？ | 分别实现本版 Config 和 URL 组合模型；用真实 Bundle 配置与文件名核对，包含 3.8 的配置差异。 |
| 94 | 从场景到浏览器资源请求 | 首场景中的一项资源如何从 UUID 走到 Network 请求、Asset 对象和依赖缓存？ | 分别完成 2.4、3.8 的端到端追踪；记录浏览器 Network/Console 和场景结果，区分静态文件与运行时证据。 |

每课都在 `learn_2.4cocoscreator/` 与 `learn_3.8cocoscreator/` 下各有独立 README 和完整 TS 代码快照。第 89–94 课按顺序增加能力；源码位置、观察结果和简化范围分别按版本记录。课程代码的输出是职责模型；Creator 工程的实际 Network 请求按第 94 课说明单独观察。

## 源码对照入口

| 主题 | Creator 2.4.15 | Creator 3.8.7 |
| --- | --- | --- |
| `Asset` 对象 | `cocos2d/core/assets/CCAsset.js` | `cocos/asset/assets/asset.ts` |
| AssetManager 与 Bundle | `cocos2d/core/asset-manager/CCAssetManager.js`、`bundle.js` | `cocos/asset/asset-manager/asset-manager.ts`、`bundle.ts` |
| Config 与 URL | `cocos2d/core/asset-manager/config.js`、`urlTransformer.js` | `cocos/asset/asset-manager/config.ts`、`url-transformer.ts` |
| 请求、解析与依赖 | `preprocess.js`、`load.js`、`fetch.js`、`parser.js`、`deserialize.js`、`depend-util.js` | `preprocess.ts`、`load.ts`、`fetch.ts`、`parser.ts`、`deserialize.ts`、`depend-util.ts` |

上游研究资料：[Creator 2.x 资源身份、加载与释放](2.x/04-assets-and-loading.md)、[Creator 3.x 资源身份、加载与释放](3.x/04-assets-and-loading.md)。这些资料已分析运行时资源生命周期；本专题新增重点是拿实际 Web 构建配置和文件验证每一环的数据映射。

编辑器工作流基线：[Creator 2.4 资源工作流](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/)、[Creator 2.4 Asset Manager](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/)、[Creator 2.4 Asset Bundle](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/bundle.html)；[Creator 3.8 资源工作流](https://docs.cocos.com/creator/3.8/manual/zh/asset/asset-workflow.html)、[Creator 3.8 Asset Manager](https://docs.cocos.com/creator/3.8/manual/zh/asset/asset-manager.html)、[Creator 3.8 Asset Bundle](https://docs.cocos.com/creator/3.8/manual/zh/asset/bundle.html)。手册用于确认编辑器约定，具体构建结果仍以两个本地样例为证。

## 与既有课程的边界

- 第 0 课讲 `.meta` UUID 与子资源；第 9 课讲单 UUID 请求和缓存；第 52 课用占位 UUID 演示 Bundle 文件 URL。新课在此基础上使用两份真实构建输出，不重讲同一份简化模型。
- 第 50–53 课继续讲通用目标、引擎/业务代码构建、资源结构和启动；本专题集中研究资源身份、AssetManager、Bundle 与实际文件的映射。
- 第 54 课继续讲 HTTP 缓存和版本发布策略；本专题只解释引擎资源版本字段如何参与查找，不展开部署缓存策略。
- 课程不修改样例工程、构建输出或 `engine/` 快照；用户需要在编辑器改变 Bundle 配置或重建时，再明确执行对应操作。

## 完成记录

1. 第 89 课记录两版当前 Web 构建输出，并分别标注对应 Runtime 源码职责。
2. 第 90–91 课从 `.meta` 与序列化引用建立主/子资源 UUID 和依赖关系。
3. 第 92–93 课分别模拟两版 AssetManager 管线、Config 索引与 URL 组合；使用真实输出核对 pack/native 地址。
4. 第 94 课串接场景、pack、依赖和 Asset/文件缓存。课程模型已执行；实际 Creator 浏览器请求按本课 README 中的本地服务步骤观察，不把静态映射当作 Network 实测。
