# 分阶段运行轨迹索引

## 2026-10-05：阶段 8、9 缺口复测

[2.4 音频](2.4.15-stage8-audio-web.jsonl)、[3.8 音频](3.8.7-stage8-audio-web.jsonl)记录两套 Creator Web 预览中从真实 `AudioClip` 加载到按钮触发的并发采样；[2.4 3D 粒子](2.4.15-stage8-particle3d-web.jsonl)、[3.8 3D 粒子](3.8.7-stage8-particle3d-web.jsonl)记录临时组件直接 `update(0.05)` 的状态。物理[后端身份](stage9-backend-web.jsonl)、[3.8 TypeScript Box2D 查询](3.8.7-stage9-2d-query-web.jsonl)、[两版当前后端 3D 射线](stage9-3d-ray-web.jsonl)、[3.8 接触监听](3.8.7-stage9-2d-contact-web.jsonl)及[2.4 接触监听登记时点](2.4.15-stage9-2d-contact-web.jsonl)分开记录。这九份 JSONL 从浏览器控制台的原始 `STAGE8_*`/`STAGE9_*` 消息按字段结构化转录；粒子样本用 `sampleColumns` 压缩表示，未列出的浏览器日志和真实声音没有采集。预览是否使用相邻源码构建未确认；本轮没有修改生成脚本或场景。解释和剩余缺口见[清点](../stage8-9-gap-audit.md)。

阶段 11：[2.4 Mac 本地存储](2.4.15-stage11-mac-native-storage.jsonl)和[3.8 Mac 本地存储](3.8.7-stage11-mac-native-storage.jsonl)分别以唯一临时键做首次写入、另一进程重启后读取和删除。两版均观察到 `sys.localStorage === window.localStorage` 且键值跨进程保留；生成包脚本已逐字节恢复，临时键已删。3.8 当前包使用 Creator 内置引擎。可复跑探针和未验证范围见[验证记录](../skills/auxiliary-capabilities-validation.md)。

阶段 11 回环 HTTP：[2.4 Mac XHR](2.4.15-stage11-mac-native-http.jsonl)与[3.8 Mac XHR/fetch](3.8.7-stage11-mac-native-http.jsonl)记录同一临时本机服务的 200/503 结果。XHR 对两种状态均 `onload`，3.8 `fetch` 对两种状态均 resolve。[2.4 连接被拒绝](2.4.15-stage11-mac-native-connection-refused.jsonl)与[3.8 连接被拒绝](3.8.7-stage11-mac-native-connection-refused.jsonl)另记录 XHR 超时、XHR 错误及 fetch 拒绝；TLS 或其他网络失败仍未测。探针恢复了包内临时改动，细节见[验证记录](../skills/auxiliary-capabilities-validation.md)。

阶段 11 WebSocket：[2.4 客户端](2.4.15-stage11-mac-native-websocket.jsonl)/[服务器](2.4.15-stage11-mac-native-websocket-server.jsonl)与[3.8 客户端](3.8.7-stage11-mac-native-websocket.jsonl)/[服务器](3.8.7-stage11-mac-native-websocket-server.jsonl)记录本机握手、文本回显和正常关闭。2.4 全局 `WebSocket` 可用但 `jsb.WebSocket` 未暴露；3.8 两者均可用。此组只验证当前 Mac 包的 `ws://` 文本正常关闭，未覆盖 `wss://` 或二进制。

阶段 11 WebSocket 异常断开：服务器收到文本后重置 TCP，未发送 Close 帧。[2.4 客户端](2.4.15-stage11-mac-native-websocket-abrupt.jsonl)/[服务器](2.4.15-stage11-mac-native-websocket-abrupt-server.jsonl)与[3.8 客户端](3.8.7-stage11-mac-native-websocket-abrupt.jsonl)/[服务器](3.8.7-stage11-mac-native-websocket-abrupt-server.jsonl)两轮都只有 `open → close` 客户端事件，没有 `onerror`；3.8 `close` 为 `1001/false`。此切口不覆盖握手失败、`wss://` 或移动网络中断。

阶段 11 WebSocket 二进制：[2.4 客户端](2.4.15-stage11-mac-native-websocket-binary.jsonl)/[服务器](2.4.15-stage11-mac-native-websocket-binary-server.jsonl)与[3.8 客户端](3.8.7-stage11-mac-native-websocket-binary.jsonl)/[服务器](3.8.7-stage11-mac-native-websocket-binary-server.jsonl)记录 `binaryType='arraybuffer'` 下五个字节 `0,1,127,128,255` 的原样回显。只覆盖本机单帧小消息。

阶段 11 WebSocket 握手拒绝：[2.4 客户端](2.4.15-stage11-mac-native-websocket-rejected-handshake.jsonl)/[服务器](2.4.15-stage11-mac-native-websocket-rejected-handshake-server.jsonl)与[3.8 客户端](3.8.7-stage11-mac-native-websocket-rejected-handshake.jsonl)/[服务器](3.8.7-stage11-mac-native-websocket-rejected-handshake-server.jsonl)记录服务端返回 HTTP 403、不升级连接后，客户端 `error → close` 且没有 `open`；3.8 `close` 为 `code=0/wasClean=true`。不要据此推断握手曾成功。

阶段 11 热更新入口：[2.4 Mac 包](2.4.15-stage11-mac-native-hotupdate-inventory.jsonl)与[3.8 Mac 包](3.8.7-stage11-mac-native-hotupdate-inventory.jsonl)只读记录资源管理器、原生热更新构造器类型与搜索路径；两份轨迹采样于各自不同初始化阶段，未构造管理器或执行更新。详见[验证记录](../skills/auxiliary-capabilities-validation.md)。

阶段 10：[2.4 已发布 Mac 包](2.4.15-stage10-mac-native-startup.jsonl)与[3.8 已发布 Mac 包](3.8.7-stage10-mac-native-startup.jsonl)均记录初始化、场景前首个绘制回调、场景启动及场景后首个绘制回调；[初始冒烟记录](stage10-mac-native-startup-smoke.jsonl)仅记录进程输出。两包探针脚本已逐字节还原。Web 一侧复用阶段 1 的同场景预览轨迹，正式 Web 发布与小游戏仍待验证，详见[验证记录](../skills/publishing-native-validation.md)。

阶段 7 UI 探针：[2.4.15](2.4.15-ui-system.jsonl)记录 Hello World 场景原有 Canvas/Widget/Label 的运行值，以及 DevTools 临时三项 Layout/Button 列表在创建当刻、下一次 `EVENT_AFTER_DRAW` 和真实鼠标点击后的状态。后续事件记录三项→四项→空列表：空列表更新后尺寸仍为 300×266 且持续标脏，销毁后根节点无效。另记录直接 `cc.view.setDesignResolutionSize(1280,720,SHOW_ALL)` 后 View scale/visibleSize 改变、Canvas/背景保持原尺寸且没有 `canvas-resize`；恢复 960×640/FIXED_HEIGHT 后重载清除监听器。[3.8.7](3.8.7-ui-system.jsonl)记录临时 Canvas/UI Camera 上动态列表与空容器高 10；另确认临时 UI 能绘制到 3D 场景。早期 Graphics/Label/Button 组合的两次点击未触发回调；后续最小 Canvas/Button 组合实测收到 `TOUCH_START`、`TOUCH_END` 和 Button click，且主相机掩码是否包含 UI_2D 不影响该结果。两组设置的具体差异仍待定位。3.8 四边拉伸 Widget 的 View 设计分辨率响应现已实测：setter 时同步标脏并保留旧尺寸，下一次 `AFTER_UPDATE` 完成 Canvas UITransform 拉伸和中心位置调整，恢复过程相同。两版 ScrollView 手势及真实窗口 resize 仍待测试；对应研究和待验证项见[UI 验证记录](../skills/ui-system-validation.md)。

阶段 6 图形渲染探针：[2.4.15](2.4.15-graphics-rendering.jsonl)记录 Hello World Sprite 的 Simple assembler、节点变换标志、灰度材质临时切换及场景 draw call；[3.8.7](3.8.7-graphics-rendering.jsonl)记录 3D 示例的 Builtin WebPipeline 分支、MeshRenderer 的 Model 边界更新、共享材质/实例与 SubModel Pass 身份。两份都是已打开 Creator 对应浏览器预览里的 DevTools 内存探针，操作后恢复原始对象并重载两页；`seq` 只给出单份转录的顺序，不是统一时钟或性能量测。场景 draw call 包含整个画面，不能归因于单个 Sprite 或 MeshRenderer。

阶段 5 输入事件探针记录：[2.4.15 输入事件](2.4.15-input-events.jsonl)在 Creator 2.4.15 Hello World 浏览器预览中，以 DevTools 临时内存节点测试重叠节点的触摸/鼠标分发、父子传播、拖出后的 touch cancel 和 Touch 坐标。

[3.8.7 输入事件](3.8.7-input-events.jsonl)在 Creator 3.8.7 3D 示例的浏览器预览中，以 DevTools 临时 Canvas、UITransform 节点和 UI 相机验证触摸/鼠标拦截、父子传播、触摸取消和 `getLocation()`/`getUILocation()` 坐标。原示例不含 UI Canvas，因此这组记录只说明临时 UI Node 的路由，不代表原示例模型可直接接收 Node 点击，也未测试 3D Raycast。

阶段 5 收口补测：[2.4.15](2.4.15-input-events-completion.jsonl)记录 `EventCustom` 与普通自定义类型 `useCapture` 的实际顺序、内部吞噬开关实验及全局键盘；[3.8.7](3.8.7-input-events-completion.jsonl)记录 `preventSwallow` 的 sibling 穿透、UI/GLOBAL dispatcher 边界、`systemEvent` 兼容桥和自定义事件传播。两份都是 DevTools 内存探针配合真实浏览器点击，项目文件未修改；补测结束后分别重载预览。

这两份 JSONL 分别对应 Creator 2.4.15 的 Hello World 示例和 Creator 3.8.7 的 3D 示例，在各自编辑器启动预览后，由 Chrome 图形界面完成一次导航。`ms` 是该页面 `performance.now()` 的毫秒数；两个页面的数值不能互相比较，也不是固定的性能指标。`seq` 是单页探针顺序。

- [2.4.15 记录](2.4.15-preview-startup.jsonl)：预览服务 `http://localhost:7456/`。读取实际返回的 `settings.js` 与 `app/editor/static/preview-templates/boot.js`；在 `boot.js` 调用 `cc.game.run` 前注册 `game`/`director` 一次性事件监听，记录 `onStart`、场景资源回调和前三次 `director.mainLoop`。
- [3.8.7 记录](3.8.7-preview-startup.jsonl)：预览服务 `http://localhost:7457/`。读取实际返回的 `settings.js?scene=current_scene`、`preview-app/index.js`、`preview-app/main.js`；在 `main.js` 调用 `game.init` 前注册各初始化阶段和 `director` 一次性事件监听，记录 `game.run` 回调、场景资源回调、前五次 `_updateCallback` 和前三次 `director.tick`。

探针由临时本机 HTTP 代理插入到返回给浏览器的宿主脚本；引擎和示例工程文件未修改。探针记录的是监听回调执行的时点，不是事件分发内部每条语句的时点。场景加载、首帧耗时随机器和资源缓存变化。宿主脚本由编辑器提供，分析结论仅适用于这两次编辑器浏览器预览；构建版和其他平台需重新核对宿主。

阶段 3 的[2.4.15 组件时序](2.4.15-script-timing.jsonl)和[3.8.7 组件时序](3.8.7-script-timing.jsonl)另由对应 Chrome 预览的 DevTools 控制台临时创建内存组件后读取事件，再转录成 JSONL。`frame` 是各页面的 `director._totalFrames`，仅表示该页面内先后；这两份记录没有使用上述启动阶段的宿主脚本代理，也没有修改示例工程。

## 阶段 2：对象与场景

- [2.4.15 对象记录](2.4.15-object-scene.jsonl)
- [3.8.7 对象记录](3.8.7-object-scene.jsonl)

两次实验均在 `EVENT_AFTER_SCENE_LAUNCH` 后运行：在内存中创建含一个子节点的 `Prefab.data`，调用 `instantiate`，给克隆根挂一个记录 `onLoad/onEnable/onDisable/onDestroy` 的组件，将根接入当前场景，切换 `active`，再调用 `destroy()`。探针分别记录克隆的父节点与活动状态、回调顺序、普通与严格 `isValid`，以及稍后节点是否从场景 children 消失。内存预制体不含示例工程的资产引用和覆盖配置；场景文件中的真实 prefab 实例由源码和 JSON 结构另外核对。

## 阶段 4：资源生命周期

- [2.4.15 资源记录](2.4.15-asset-lifecycle.jsonl)：现有场景资源缓存基线、SceneAsset 预加载/加载、缓存命中与内存 `cc.Asset` 的引用释放。
- [3.8.7 资源记录](3.8.7-asset-lifecycle.jsonl)：未被当前场景直接引用的真实预制体的冷缓存预加载/加载，以及 `addRef`、非强制释放、`decRef` 后清理。
- [2.4.15 磁盘/导入记录](2.4.15-disk-import-validation.jsonl)：真实 `.fire` 依赖图、Creator 导入最小 JSON、Chrome 冷缓存加载/释放、Mac 构建与原生场景显示。
- [3.8.7 磁盘/导入记录](3.8.7-disk-import-validation.jsonl)：真实 `.scene` 与预制体依赖图、Creator 导入最小 JSON、Chrome 冷缓存加载/释放、Mac 构建与原生场景显示。
- [2.4.15 Mac 原生资源记录](2.4.15-mac-native-asset-lifecycle.jsonl)：原生进程内对最小 JSON 的加载回调、缓存身份、引用保护和释放采样。
- [3.8.7 Mac 原生资源记录](3.8.7-mac-native-asset-lifecycle.jsonl)：同一行为在 3.8.7 Mac 进程中的独立打点。
- [2.4.15 Mac 原生磁盘场景切换](2.4.15-mac-native-disk-scene-switch.jsonl)：真实磁盘场景切换中，旧场景独有 SpriteFrame 在自动释放开关两种状态下的缓存变化。
- [3.8.7 Mac 原生磁盘场景切换](3.8.7-mac-native-disk-scene-switch.jsonl)：真实磁盘场景切换中，旧场景独有 Prefab 在自动释放开关两种状态下的缓存变化。
- [2.4.15 磁盘场景切换](2.4.15-disk-scene-switch.jsonl)：编辑器保存的两个 `.fire` 场景，经 Chrome 预览 `director.loadScene` 切换后观察旧场景独有 SpriteFrame。
- [3.8.7 磁盘场景切换](3.8.7-disk-scene-switch.jsonl)：编辑器保存的两个 `.scene` 场景，经 Chrome 预览 `director.loadScene` 切换后观察旧场景独有 `soldier.prefab`。

这两份记录来自各自 Chrome 预览 DevTools 控制台的临时脚本，均未修改工程或引擎文件。JSONL 是输出值的转录，不是 DevTools 内部调用日志；约 200ms 的观察点仅用于区分同步与异步清理，不能当作引擎固定释放延迟。2.x 场景加载实验会在内存中形成第二份 SceneAsset，其后 SpriteFrame 的引用数包含这份对象的影响。

同日追加的 `S4V2_` / `S4V3_` 事件又复测了 SceneAsset、3.x 真实预制体、隔离内存资源的强制释放，以及对两组**内存 Scene** 直接调用资源管理器 `_autoRelease` 的开/关分支。它们不经过 `Director.runSceneImmediate`，不能作为完整场景切换时序或常驻节点转移的证据。2.x SpriteFrame 后续记录中的引用数为 3，与前一轮的 2 不同；该页曾额外加载 SceneAsset，两次数字均只代表各自观测时点。

2026-10-03 的 `S4D2_` 与 `S4P2B_` 事件改为通过 2.4 的 `Director.runSceneImmediate` 切换内存 Scene，并验证 `autoReleaseAssets` 开关和常驻节点引用转移。首次 `S4P2_` 探针遗漏了新内存 Scene 的依赖表，故转移未写入 `persistDeps`，转录保留该偏差作为测试前置条件。重载预览后活动场景恢复为 `helloworld`。这些事件证明浏览器预览中的内存对象路径，不能外推到编辑器导入或原生后端。

同日的 `S4D3_` 与 `S4P3_` 事件通过 3.8 的 `Director.runSceneImmediate` 完成相应内存 Scene 验证；新场景预先建立依赖记录。重载预览后，活动 Scene UUID 与示例 `main.scene` 一致。两版事件中的 `persistDeps` 长度均为 2，是该次组件属性遍历的观测值，不应推广为每个常驻节点固定产生两项依赖。

磁盘/导入记录按“场景文件引用 → Chrome 运行时依赖 → 编辑器导入及 `.meta`/`library` → 新预览冷缓存加载 → Mac 原生包”分别取证。两份 `stage4-probe.json` 与各自编辑器生成的 `.meta` 保留为源测试资源；`library/` 和 `build/` 是生成产物。Mac 原生 JSON 生命周期日志按 `before_load → load_callback → after_add_ref → after_nonforced_release → after_dec_ref_immediate → after_dec_ref_delayed` 排序；真实场景切换日志按 `before → switch_requested → accepted → launched → settled` 排序。延迟事件在 `decRef` 或场景切换后约 350ms 采样，不能解释为引擎固定释放时长。探针临时写入生成包脚本，测试后已恢复；3.8 日志取自应用容器的 `jsb.fileUtils.getWritablePath()`，随后复制到此目录。各面结论汇总在[验证矩阵](../asset-validation-matrix.md)。

Chrome 磁盘场景切换转录来自对应 DevTools 控制台；Mac 原生磁盘场景切换转录来自真实打包进程写出的 JSONL。两版均由对应编辑器创建并保存 `stage4-empty`，且确认新场景进入包内场景配置，再观察旧场景独有资源。源场景 `autoReleaseAssets` 均为 `false`；`true` 分支在独立运行中只改活动 Scene 对象的内存属性，未保存到源文件。两分支均调用公开的 `director.loadScene`，记录接收请求、启动回调与约 350ms 后采样。转录并非引擎内部逐语句日志，回调当下仍缓存、稍后失效不能解释为固定释放延迟；Mac 记录仅覆盖当前 Mac 包与这些测试资源，不能代表 Android/iOS。

## 阶段 11：原生热更新同版本检查

- [2.4.15 客户端](2.4.15-stage11-mac-native-hotupdate-check.jsonl)、[服务器](2.4.15-stage11-mac-native-hotupdate-check-server.jsonl)
- [3.8.7 客户端](3.8.7-stage11-mac-native-hotupdate-check.jsonl)、[服务器](3.8.7-stage11-mac-native-hotupdate-check-server.jsonl)

[探针脚本](../probes/stage11-mac-hotupdate-check.py)给两包分别创建唯一临时本地 manifest 与缓存目录，回环服务只提供同版本 manifest。脚本注入生成包后仅调用 `checkUpdate()`，采集构造时搜索路径、状态、事件与请求，再恢复两份生成脚本原字节并删除临时目录。两版均只请求版本文件，事件代码为 `5 → 4`；没有下载资源。3.8 的 JS 状态常量与 C++ 枚举错位，详见[阶段 11 验证矩阵](../skills/auxiliary-capabilities-validation.md)。JSONL 中的临时目录和 URL token 仅对应这次运行，不能作为固定路径。

同一脚本的 `--remote-version 1.0.1` 分支另生成[2.4 客户端](2.4.15-stage11-mac-native-hotupdate-new-version-check.jsonl)/[服务端](2.4.15-stage11-mac-native-hotupdate-new-version-check-server.jsonl)及[3.8 客户端](3.8.7-stage11-mac-native-hotupdate-new-version-check.jsonl)/[服务端](3.8.7-stage11-mac-native-hotupdate-new-version-check-server.jsonl)轨迹。远端完整 manifest 含未提供下载内容的哨兵资产；两包只请求版本与完整 manifest，事件为 `5 → 5 → 3`，临时目录中留下 `project.manifest.temp`，无资源请求。两包均未调用 `update()`；本记录不能说明下载或重启结果。

`--remote-version 1.0.1 --do-update` 分支生成[2.4 客户端/磁盘](2.4.15-stage11-mac-native-hotupdate-update.jsonl)/[服务器](2.4.15-stage11-mac-native-hotupdate-update-server.jsonl)及[3.8 客户端/磁盘](3.8.7-stage11-mac-native-hotupdate-update.jsonl)/[服务器](3.8.7-stage11-mac-native-hotupdate-update-server.jsonl)轨迹。服务端提供一个字节 `A`；两版从发现新版本转到单文件下载，缓存中的 manifest 版本为 `1.0.1`，文件字节为 `41`，临时下载目录已删除。随后用同一隔离缓存另起进程，重新构造管理器后读到缓存版本与前置搜索路径，检查返回代码 4。`phase=update/restart` 标识两次进程；`disk_snapshot` 是进程结束后的目录观察。探针注入发生在宿主启动后，故此记录不证明新版游戏脚本已经在启动前替换。

## 阶段 12：构建来源只读检查

[探针](../probes/stage12-engine-provenance.py)解析两个示例已有配置，写出[来源轨迹](stage12-engine-provenance.jsonl)。3.8 的两条记录来自现有 Mac 生成配置，分别给出 TypeScript 与 Native 的 `builtin` 路径，以及它们与邻接源码目录不同的布尔结果；2.4 两份 builder 配置均没有引擎路径字段，故只记录“来源未确定”。此检查没有改变编辑器项目设置、构建包或引擎文件，也不能代表未来新构建的来源。

原[来源轨迹](stage12-engine-provenance.jsonl)采集于创建阶段 12 编辑器扩展之前，里面 `packages=[]`、`extensions=false` 是**当时的目录快照**。[验收时再次采集](stage12-engine-provenance-current.jsonl)显示两版探针目录已存在，3.8 Mac 构建的 `builtin` 路径与 2.4 builder 配置结论不变。[扩展 UI 与日志轨迹](stage12-editor-extension.jsonl)记录 3.8 的管理器刷新、启用、入口 `load`、菜单点击与 `ping` 回调。2.4 完整重开项目后包出现在 Package Manager，点击 `Packages → Stage 12 Probe` 后控制台出现 `ping`；初次 `load` 与 Reload 后日志未观察到。

[3.8 Native Profiler 编译轨迹](stage12-profiler-macro.jsonl)对应[最小调用文件](../probes/stage12-profiler-object-inc.cpp)。从 `engine/3.8.7engine/` 执行 `clang++ -std=c++17 -fsyntax-only -DCC_PLATFORM=4 -DCC_PLATFORM_WINDOWS=2 -DCC_PLATFORM_MACOS=4 -DCC_USE_PROFILER=1 -I native/cocos -I native/cocos/renderer -I native/external/sources ../docs/agent-foundation/probes/stage12-profiler-object-inc.cpp`：修正前唯一错误是 `C_PROFILER` 未声明；修正后返回 0。将 `CC_USE_PROFILER` 改为 `0` 也返回 0。这里只验证宏展开后的 C++ 语法，不代表完整原生目标构建或运行显示。
