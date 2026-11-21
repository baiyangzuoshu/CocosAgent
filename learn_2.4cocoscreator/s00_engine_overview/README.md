# 第 0 课：Creator 2.4.15 引擎功能流程图索引

**目标：** 依据 Creator 2.4.15 源码，分别追踪模块装配、游戏启动、场景、组件更新、资源、输入、绘制和销毁八项功能；各图是独立的源码职责链，不拼成一张覆盖所有系统的总流程图。

## 阅读范围

本课以 `engine/2.4.15engine/` 的源码为唯一实现依据，主线选择非编辑器主进程的 Web Runtime。课程建立引擎级调用地图，后续课程再深入其中一个子系统。

## 功能流程图

以下各图分别描述一项源码职责。图与图之间通过调用者、事件或共享对象连接；不将它们拼成一条假设所有功能都会经过的串行总流程。

### 模块装配

```mermaid
graph TD
  A["index.js"] --> B["创建或复用全局 cc"]
  B --> C["加载预定义、polyfill 和 core predefine"]
  C --> D{"CC_EDITOR 且 Editor 主进程？"}
  D -->|否| E["require cocos2d Runtime 入口"]
  D -->|是| F["跳过 cocos2d Runtime 入口"]
  E --> G["require extends.js"]
  F --> G
  G --> H["加载 core 和 animation"]
  H --> I{"CC_EDITOR 且 Editor 主进程？"}
  I -->|否| J["加载 particle、tilemap、video、webview、NodePool、actions"]
  I -->|是| K["加载 ParticleAsset、TiledMapAsset"]
  J --> L["加载 Spine 和 DragonBones"]
  K --> L
  L --> M{"非 Editor，或不是 Editor 主进程？"}
  M -->|是| N["加载 deprecated 接口"]
  M -->|否| O["结束扩展装配"]
```

`modules.json` 描述构建期可选模块及依赖；运行时入口实际执行的是 `index.js`、`extends.js` 中的 `require` 与环境分支。

### 游戏启动

```mermaid
graph TD
  A["CCGame.run(config, onStart)"] --> B["读取配置并保存 onStart"]
  B --> C["prepare → _loadPreviewScript"]
  C --> D{"CC_PREVIEW quick compile 脚本可用？"}
  D -->|是| E["加载预览脚本后继续"]
  D -->|否| F["直接继续准备"]
  E --> G["_initEngine"]
  F --> G
  G --> H["初始化 Renderer"]
  H --> I{"非 Editor Runtime？"}
  I -->|是| J["调用 _initEvents"]
  I -->|否| K["跳过 Runtime 系统事件"]
  J --> L{"registerSystemEvent 启用？"}
  L -->|是| M["注册 CCInputManager 系统输入"]
  L -->|否| N["跳过系统输入注册"]
  M --> O["发出 EVENT_ENGINE_INITED"]
  N --> O
  K --> O
  O --> P["CCDirector 一次性监听调用 init"]
  P --> Q["_setAnimFrame"]
  Q --> R["初始化内建资源 builtins.init"]
  R --> S["标记 prepared 并启动主循环"]
  S --> T["安排 requestAnimationFrame"]
  T --> U["发出 EVENT_GAME_INITED"]
  U --> V["调用宿主提供的 onStart"]
```

### 场景加载与激活

```mermaid
graph TD
  A["宿主 onStart 调用 Director.loadScene"] --> B{"找到包含该场景的 Bundle？"}
  B -->|否| C["报告场景查找错误并结束"]
  B -->|是| D["发出 EVENT_BEFORE_SCENE_LOADING"]
  D --> E["Bundle.loadScene 经 AssetManager 加载"]
  E --> F{"加载成功？"}
  F -->|否| G["回调错误并结束"]
  F -->|是| H["CCDirector.runSceneImmediate"]
  H --> I["Scene._load 初始化场景内容"]
  I --> J["将常驻根节点接入新场景"]
  J --> K{"非 Editor Runtime？"}
  K -->|是| L["ReleaseManager 自动释放旧场景不再引用的资源"]
  K -->|否| M["跳过 Runtime 自动释放"]
  L --> N{"旧场景仍有效？"}
  M --> N
  N -->|是| O["oldScene.destroy"]
  N -->|否| P["跳过旧场景销毁"]
  O --> Q["Director 调用 _deferredDestroy 清理队列"]
  P --> Q
  Q --> R["发出 EVENT_BEFORE_SCENE_LAUNCH"]
  R --> S["设置 Director 当前 Scene"]
  S --> T["Scene._activate"]
  T --> U["NodeActivator 递归激活节点和组件"]
  U --> V["按序执行 preload、onLoad、onEnable"]
  V --> W["恢复游戏并回调、发出 EVENT_AFTER_SCENE_LAUNCH"]
```

### 组件生命周期与帧更新

```mermaid
graph TD
  A["NodeActivator 激活节点和组件"] --> B["preload → onLoad → onEnable"]
  B --> C["ComponentScheduler 注册组件调度状态"]
  C --> D["CCGame requestAnimationFrame 回调"]
  D --> E["CCDirector.mainLoop 计算 deltaTime"]
  E --> F{"Director 未暂停？"}
  F -->|否| G["跳过更新阶段，继续帧尾绘制"]
  F -->|是| H["发出 EVENT_BEFORE_UPDATE"]
  H --> I["startPhase：新启用组件的 start"]
  I --> J["updatePhase：组件 update"]
  J --> K["Director Scheduler 更新"]
  K --> L["lateUpdatePhase：组件 lateUpdate"]
  L --> M["发出 EVENT_AFTER_UPDATE"]
  M --> N["CCObject._deferredDestroy"]
  N --> O["发出 EVENT_BEFORE_DRAW"]
  G --> O
  O --> P["Renderer.render；细节见场景绘制图"]
  P --> Q["EVENT_AFTER_DRAW 与帧监听器"]
  Q --> R["进入下一帧"]
```

### 资源请求

```mermaid
graph TD
  A["Scene、Prefab 或组件发起 loadAny 请求"] --> B["创建 Task 并进入 pipeline"]
  B --> C["preprocess：规范化请求"]
  C --> D["load：逐项处理请求"]
  D --> E{"已存在可复用文件或 Asset？"}
  E -->|是| F["复用缓存 Asset；按需补载依赖并增加引用"]
  E -->|否| G["复用文件缓存，或由 PackManager / Downloader 获取文件"]
  G --> H{"资源类型？"}
  H -->|native 文件| I["按扩展名解析 native 数据"]
  H -->|import 资源| J["解析导入数据，创建 Asset"]
  J --> K["递归加载依赖并设置资源引用"]
  K --> L["调用 Asset.onLoad 并按配置缓存"]
  F --> M["汇总结果和进度"]
  I --> M
  L --> M
  M --> N["完成回调把结果交给请求方"]
```

缓存、打包资源、native/import 类型和 `cacheAsset` 配置会改变具体步骤；图中展示普通 `loadAny` 管线的主要分支。

### 输入与事件派发

```mermaid
graph TD
  A["非 Editor Runtime 初始化 _initEvents"] --> B{"registerSystemEvent 启用？"}
  B -->|否| C["不注册平台输入监听"]
  B -->|是| D["CCInputManager 注册浏览器输入监听"]
  D --> E["收到触摸、鼠标或键盘事件"]
  E --> F["转换触摸/鼠标坐标并构造引擎事件"]
  F --> G["CCEventManager.dispatchEvent"]
  G --> H["按事件类型和监听优先级分发"]
  H --> I{"匹配到节点触摸/鼠标监听？"}
  I -->|是| J["检查节点命中并调用节点监听"]
  I -->|否| K["调用匹配的全局或其他类型监听"]
  J --> L["业务组件处理事件"]
  K --> L
```

### 场景绘制

```mermaid
graph TD
  A["CCGame 初始化时按配置和能力选择 WebGL / Canvas"] --> B{"选择的 Web Runtime 后端？"}
  B -->|WebGL| C["initWebGL：GFX Device、ModelBatcher、ForwardRenderer"]
  B -->|Canvas| D["initCanvas：Canvas Device、组件 Handle、ForwardRenderer"]
  C --> E["Director.mainLoop 调用 Renderer.render(Scene, dt)"]
  D --> E
  E --> F["RenderFlow.render 重置批次并遍历 Scene"]
  F --> G["校验 Renderer，按渲染标记访问节点"]
  G --> H["组件 Assembler 生成渲染数据"]
  H --> I["Handle / ModelBatcher 完成批次数据"]
  I --> J["所选 ForwardRenderer 提交绘制"]
  J --> K{"后端类型？"}
  K -->|WebGL| L["GFX Device 发出 WebGL 绘制调用"]
  K -->|Canvas| M["Canvas ForwardRenderer 绘制到 2D Context"]
```

此图只展开 Web Runtime 的 WebGL 和 Canvas 后端；JSB 原生渲染器由原生侧提供设备与渲染实现，不能套用 WebGL Device 的末端调用。

### 销毁与场景切换

```mermaid
graph TD
  A["Node 或 Component 调用 destroy"] --> B["设置 ToDestroy 并加入销毁队列"]
  B --> C["Director 更新后调用 _deferredDestroy"]
  C --> D["CCObject._destroyImmediate"]
  D --> E["执行 _onPreDestroy / _destruct 并标记 Destroyed"]
  F["新场景加载成功，进入 runSceneImmediate"] --> G["保留常驻节点并接入新场景"]
  G --> H{"非 Editor Runtime？"}
  H -->|是| I["ReleaseManager 自动释放旧场景不再引用的资源"]
  H -->|否| J["跳过 Runtime 自动释放"]
  I --> K["旧场景 destroy 并登记延迟销毁"]
  J --> K
  K --> L["Director 立即调用 _deferredDestroy 清理旧场景"]
  L --> M["设置新场景并调用 Scene._activate"]
  M --> N["恢复游戏；完整激活顺序见场景加载与激活图"]
```

## 源码阅读顺序

| 阶段 | 入口与关键职责 | 主要源码 |
| --- | --- | --- |
| 命名空间与装配 | 建立 `cc`，入口按环境加载核心模块与扩展；`modules.json` 供构建期模块裁剪使用 | [`index.js`](../../engine/2.4.15engine/index.js)、[`extends.js`](../../engine/2.4.15engine/extends.js)、[`modules.json`](../../engine/2.4.15engine/modules.json)、`cocos2d/core/predefine.js` |
| 游戏初始化 | `run`、`prepare`、`_initEngine`、`_prepareFinished`、`_runMainLoop` | [`CCGame.js`](../../engine/2.4.15engine/cocos2d/core/CCGame.js) |
| Director 与场景 | `EVENT_ENGINE_INITED` 监听、`init`、`mainLoop`、`loadScene`、`runSceneImmediate` | [`CCDirector.js`](../../engine/2.4.15engine/cocos2d/core/CCDirector.js)、[`CCScene.js`](../../engine/2.4.15engine/cocos2d/core/CCScene.js) |
| 节点与组件 | 场景树激活、生命周期入队、`start/update/lateUpdate` 调度 | [`node-activator.js`](../../engine/2.4.15engine/cocos2d/core/node-activator.js)、[`component-scheduler.js`](../../engine/2.4.15engine/cocos2d/core/component-scheduler.js)、`CCNode.js` |
| 资源与输入 | AssetManager 规范化请求、获取文件、解析依赖；系统输入经事件管理器分发 | [`CCAssetManager.js`](../../engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js)、[`preprocess.js`](../../engine/2.4.15engine/cocos2d/core/asset-manager/preprocess.js)、[`load.js`](../../engine/2.4.15engine/cocos2d/core/asset-manager/load.js)、[`pack-manager.js`](../../engine/2.4.15engine/cocos2d/core/asset-manager/pack-manager.js)、[`parser.js`](../../engine/2.4.15engine/cocos2d/core/asset-manager/parser.js)、[`bundle.js`](../../engine/2.4.15engine/cocos2d/core/asset-manager/bundle.js)、[`releaseManager.js`](../../engine/2.4.15engine/cocos2d/core/asset-manager/releaseManager.js)、[`CCInputManager.js`](../../engine/2.4.15engine/cocos2d/core/platform/CCInputManager.js)、[`CCEventManager.js`](../../engine/2.4.15engine/cocos2d/core/event-manager/CCEventManager.js) |
| 绘制与销毁 | Director 调用 Renderer；RenderFlow 遍历场景并交给 WebGL 或 Canvas 后端；对象在安全时机清理 | [`renderer/index.js`](../../engine/2.4.15engine/cocos2d/core/renderer/index.js)、[`render-flow.js`](../../engine/2.4.15engine/cocos2d/core/renderer/render-flow.js)、[`model-batcher.js`](../../engine/2.4.15engine/cocos2d/core/renderer/webgl/model-batcher.js)、[WebGL ForwardRenderer](../../engine/2.4.15engine/cocos2d/renderer/renderers/forward-renderer.js)、[Canvas ForwardRenderer](../../engine/2.4.15engine/cocos2d/core/renderer/canvas/forward-renderer.js)、[`CCObject.js`](../../engine/2.4.15engine/cocos2d/core/platform/CCObject.js) |

## 本课必须保留的机制

- 区分 `EVENT_ENGINE_INITED` 与 `EVENT_GAME_INITED`：前者表示引擎初始化事件，后者在内建资源准备并启动主循环后发出。
- `CCGame` 提供 `onStart` 回调；由宿主决定是否以及何时加载首个场景。
- 场景加载、节点激活、组件生命周期、每帧更新和绘制是相互连接但职责不同的阶段。
- 每张图只说明本功能的调用关系；输入、资源、更新、绘制和销毁不能拼成所有游戏都必经的单一串行路径。

## 最小观察宿主

静态阅读本地 Creator 2.4.15 引擎源码。本课不需要浏览器宿主、示例工程或构建命令；按上表从入口函数追调用关系，并逐张对照八个功能流程图核验各自阶段。

## 模型化简化与 Creator Runtime 边界

流程图概括源码调用关系，不是可执行 Runtime，也不声称覆盖每个目标平台。重点路径是非编辑器主进程的 Web Runtime；`CC_EDITOR`、`CC_PREVIEW`、`CC_JSB`、`CC_RUNTIME` 和 `CC_NATIVERENDERER` 等宏会改变模块装配、输入、帧循环或渲染路径，需要按分支分别追踪。Creator 编辑器本体、AssetDB 导入器和完整 Editor Builder 不在此 Runtime 源码快照中。

## 后续课程

- [第 1 课：模块装配](../s01_module_assembly/README.md)到[第 3 课：Director 主循环](../s03_director_loop/README.md)：拆解入口与启动。
- [第 4 课：节点与场景树](../s04_node_scene_tree/README.md)到[第 10 课：Director 到渲染流程](../s10_render_entry/README.md)：拆解场景、组件和首帧绘制。
- [第 14 课：浏览器输入坐标](../s14_browser_input/README.md)到[第 20 课：节点移除与重新挂载](../s20_node_detachment/README.md)：拆解输入、事件、Prefab 与生命周期。
- [资源元数据补充参考](../asset_meta_reference/README.md)：保留 `.meta`、UUID 和 SpriteFrame 子资源分析，不计入课次。
