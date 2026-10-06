# 阶段 8：同一行为的首轮对照

先读[2.4 独立研究](../2.x/08-animation-and-effects.md)和[3.8 独立研究](../3.x/08-animation-and-effects.md)。本表只比较两版都有的开发行为；公开用法以各自官网手册为准：2.4 [动画](https://docs.cocos.com/creator/2.4/manual/zh/animation/index.html) / [缓动](https://docs.cocos.com/creator/2.4/manual/zh/scripting/tween.html)，3.8 [动画](https://docs.cocos.com/creator/3.8/manual/zh/animation/index.html) / [缓动](https://docs.cocos.com/creator/3.8/manual/zh/tween/index.html)。缓动及普通属性剪辑与同属性竞争已有各自 Web 固定时钟轨迹；其他多数行为仍是源码对照。

| 同一开发行为 | 2.4.15 | 3.8.7 | 待验证的可观察点 |
| --- | --- | --- | --- |
| 组件播放剪辑 | `CCAnimation.play` 经 `playAdditive` 取得 `AnimationState`，再停掉其余状态；`AnimationManager` 更新状态并派发延迟事件。 | `AnimationComponent.play` 经 `crossFade(name, 0)`；`AnimationManager` 先处理过渡、状态和混合缓冲，再派发延迟事件。 | 开始、采样、循环/完成事件与 `update/lateUpdate` 的先后。 |
| 链式缓动 | `cc.tween` 生成动作，加入 Director 的 `ActionManager`；它由 Scheduler 驱动。 | `tween` 生成动作，加入 `TweenSystem` 的 ActionManager；系统由 Director 驱动。 | `to` 的固定时钟逐帧读数、暂停/恢复、停止与完成已测；`by`、目标销毁仍待测。 |
| 暂停一条缓动 | 本快照 `Tween` 无实例级 `pause/resume`；`Node.pauseAllActions/resumeAllActions` 作用于该节点所有动作，普通对象可查 ActionManager target。 | `Tween.pause/resume` 改该 Tween 的最终 Action 暂停标志。 | 单条 Node Tween 的暂停/恢复逐帧轨迹已测；同 target 多 Tween 的暂停范围仍待测。 |
| 同帧动画与缓动 | ActionManager、AnimationManager 都在 Scheduler 系统优先级，初始化时前者先调度。 | AnimationManager 优先级 200，TweenSystem 优先级 100，Director 先更新前者。 | 固定时钟同属性竞争已测：2.4 剪辑后写，最终样本 100；3.8 Tween 后写，最终样本 200。 |
| 禁用音频组件 | `CCAudioSource.onDisable` 调用 `stop()`。 | `AudioSource.onDisable` 对普通节点调用 `pause()`；常驻节点分支直接返回。 | 本次 WebAudio 停用/重新启用已测：2.4 停止且时间归零，3.8 暂停并保留位置；常驻节点和原生仍待测。 |
| 手动暂停游戏 | `cc.game.pause()` 调 `cc.audioEngine._break()` 暂停其 ID；`AudioSource` 组件响应的是另发的 `EVENT_HIDE/SHOW`，不在这条 ID 表中。 | `game.pause()` 发 `Game.EVENT_PAUSE`；Web/原生普通播放器注册中断监听。one-shot 没有相同监听，`AudioManager.pause()` 在本地没有调用点。 | 分开测手动暂停和真实后台切换，以及普通播放与短音效的时间位置、事件和可听输出。 |
| 播放短音效 | 2.4 手册同时给出 `cc.AudioSource` 与 `cc.audioEngine.play(AudioClip, ...)`，后者按播放 ID 管理实例。 | 3.8 手册统一用 `AudioSource`，`playOneShot(AudioClip)` 独立播放短音效，组件不能再控制该次播放。 | 2.4 ID 与 3.8 WebAudio one-shot 的跨场景底层存续已分别测，3.8 WebAudio 达限淘汰也已测；真实听感与原生仍待测。 |
| 短音效过量时的管理器淘汰 | `cc.audioEngine` 按 `clip.nativeUrl` 限制同一路径最多 24 个受管实例；满时停止该路径最早的 ID。组件 `AudioSource` 不经这条路径。 | `AudioManager` 合计普通与一次性播放器，对当前后端的 `maxAudioChannel` 限额；满时先停止最早的一次性音效，否则停最早的普通播放器。 | 分别制造同音频和多音频并发，记录 ID/播放器状态、实际可听中断；按 Web、小游戏、原生分别验证。 |
| 2D 粒子开始与停发射 | `CCParticleSystem` 的 `playOnLoad` / `resetSystem`、`stopSystem`；`lateUpdate` 推进 Simulator。 | `ParticleSystem2D` 同样提供 `playOnLoad` / `resetSystem`、`stopSystem`；`lateUpdate` 推进 Simulator，再经 UI Batcher 渲染。 | 自然帧粒子数、自动移除及停后 100 ms 画面已测；停用组件、导入资源和原生仍待测。 |
| 2D 粒子自动移除 | 停发射后粒子清空，`_finishedSimulation` 关闭 RenderFlow 渲染标志，若 `autoRemoveOnFinish` 开启则 `node.destroy()`。 | 同样在粒子清空后 `node.destroy()`，但先标记 UIRenderer 待更新；`Simulator.step` 无 `renderData` 时会在完结检查前返回。 | 零粒子/排空、`destroy` 和有效性已测；3.8 无 `renderData` 早退与主动脏更新分支仍待测。 |

剪辑采样的内部差别尤其影响调试：2.4 `initClipData → clip.createCurves → AnimationState.sample` 逐条曲线采样，事件曲线也放进曲线数组；3.8 `AnimationState.initialize → clip.createEvaluator → PoseOutput`，AnimationManager 在状态更新后统一 `blendStateBuffer.apply()`，事件与嵌入式播放器分别使用 evaluator。两版都会延迟派发状态事件，但 3.8 的姿态混合层是独立排查点。上述源码路径已有下段普通剪辑固定时钟轨迹核对；自然帧、复杂混合和多个事件键仍待测。

源码已定位同属性实验中的实际 setter：2.4 的 `DynamicAnimCurve.sample` 与 `TweenAction.update` 都直接赋给 Node 的 `x`，其管理器顺序是 Tween 所在 ActionManager 先、剪辑所在 AnimationManager 后；3.8 的位置剪辑经混合缓冲 `node.setRTS` 应用，Tween 再经 `Node.position` setter 写入，其系统顺序是 AnimationManager 先、TweenSystem 后。当前固定时钟运行值支持这一后写覆盖关系；自然帧、剪辑结束后的其他动作和混合权重变化仍需单独核验。

普通剪辑的相同行为已按各自官网 API 准备两份[2.4 探针](../agent-foundation/probes/stage8-clip-tween-2.4.js)与[3.8 探针](../agent-foundation/probes/stage8-clip-tween-3.8.js)：均以独立剪辑为基线，再让剪辑和 Tween 写同一节点属性，采集管理器前后值、组件状态事件和临时接收组件上的时间轴函数事件。两份[2.4 原始轨迹](../agent-foundation/traces/2.4.15-stage8-clip-tween-headless-web.jsonl)与[3.8 原始轨迹](../agent-foundation/traces/3.8.7-stage8-clip-tween-headless-web.jsonl)已取得：每版单播剪辑都以 `0,20,40,…,100` 采样；同播时第 1 个非零步 2.4 的 ActionManager 先写 40、AnimationManager 后写 20，最终样本 100；3.8 的 AnimationManager 先写 20、TweenSystem 后写 40，最终样本 200。两版均在第 2 步触发 0.1 秒函数事件，读数为 40，第 5 步收到剪辑 `stop/finished`。只测一个事件键，未区分首次采样与后续跨键事件的完整调度差异。

两版[2.4 Web 轨迹](../agent-foundation/traces/2.4.15-stage8-tween-web.jsonl)与[3.8 Web 轨迹](../agent-foundation/traces/3.8.7-stage8-tween-web.jsonl)都在页面可见时暂停自然循环，以 `dt=0.05` 手动推进 20 步；相同参数下得到相同的关键属性序列：第 1 步对象和节点均为 20，节点在第 1 步后暂停而第 2、3 步保持 20，第 3 步后恢复，最终为 100；另一个缓动停在约 30。对象在第 5 步、节点在第 7 步完成。**实现顺序不同**：2.4 的 ActionManager 先于 AnimationManager，3.8 的 AnimationManager 先于 TweenSystem。这里只测试单条 Node Tween，不能据相同数值推断两版暂停 API 的作用范围相同，也不能推断自然帧率；同属性竞争由上段独立探针验证。

2.4 `stopSystem` 停发射而已有粒子继续模拟至消亡；3.8 **2D** 的 `ParticleSystem2D.stopSystem` 保留相近模拟语义，**3D** 的 `ParticleSystem.stopEmitting` 也表示停发射，而 3D `stop` 会立即 `clear`。这来自两版源码及[2.4 API](https://docs.cocos.com/creator/2.4/api/zh/classes/ParticleSystem.html)、[3.8 2D 组件手册](https://docs.cocos.com/creator/3.8/manual/zh/particle-system/2d-particle/2d-particle.html)。3.8 2D `_canRender` 又要求 `!_stopped`；本轮停发射后旧粒子仍可见，因渲染标志未立即重算。主动触发脏更新的分支仍待验证。音频异步边界各有实现：2.4 的 `CCAudio` 将操作延后到 `AudioClip._ensureLoaded` 回调，`src` 会忽略旧 clip 的迟到加载；3.8 `AudioSource` 缓存加载期间的操作并在播放器就绪后回放，迟到的旧播放器会销毁。两版都有防旧加载覆盖的处理，但操作队列和播放器所有权不同；实际平台时序仍需打点。

音频淘汰的粒度来自两套独立实现：2.4 的 `CCAudioEngine.js::getAudioFromPath` 只管理 `cc.audioEngine` 的同 URL ID 列表，`_audioPool` 的 32 不是播放限额；3.8 的 `AudioManager.discardOnePlayingIfNeeded` 把普通播放和 `playOneShot` 放进同一额度，额度由平台后端给出。3.8 的一次性音效加载完成后会独立启动；其 Promise 分支没有组件销毁检查，当前 WebAudio 成功加载路径已观察到组件销毁后的迟到启动。两版公开入口分别以 [2.4 音频播放手册](https://docs.cocos.com/creator/2.4/manual/zh/audio/audio.html)和 [3.8 AudioSource 手册](https://docs.cocos.com/creator/3.8/manual/zh/audio-system/audiosource.html)为准。

已准备两版各自的[2.4 音频探针](../agent-foundation/probes/stage8-audio-2.4.js)与[3.8 音频探针](../agent-foundation/probes/stage8-audio-3.8.js)，以及各示例两段独立的 `stage8-tone-a/b.wav`。WAV 已完成文件格式检查，脚本已通过语法检查；Creator 已为两版新增音频生成 `audio-clip` `.meta`，两份探针现均已在各自 Web 预览运行并取得局部轨迹。2.4 直接观测播放 ID；3.8 普通组件可读状态，一次性音效无公开状态句柄，本次另有 WebAudio source 的直接打点。

场景切换要同时检查组件、Clip 和独立播放器：2.4 组件在旧场景销毁时停播并销毁自己的音频对象，`cc.audioEngine` ID 独立于节点，但 `AudioClip.destroy → cc.audioEngine.uncache` 会停止对应 ID；3.8 普通 `AudioSource` 销毁时停止并清空 clip，`playOneShot` 没有组件回收句柄，`AudioClip.destroy` 处理的是 Clip 自己持有的播放器。两版动态 `resources.load` Clip 在本次真实磁盘场景切换的 `autoReleaseAssets=false/true` 两组条件下均保持缓存；显式释放时才销毁 Clip。此结果不代替静态场景依赖的测试。两版自动释放条件分别见[2.4](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/release-manager.html)和[3.8](https://docs.cocos.com/creator/3.8/manual/zh/asset/release-manager.html)官方手册。

应用暂停也不是同一层：2.4 `cc.game.pause/resume` 调 `cc.audioEngine._break/_restore`，组件另监听 `EVENT_HIDE/SHOW`；3.8 `game.pause/resume` 发事件，由普通平台播放器注册中断监听，`AudioManager.pause()` 虽定义却没有本地调用点，一次性播放器类也没有相同的事件监听。后台声音仍可能受平台音频策略影响，这里只比较引擎接线。

进一步沿渲染开关追踪：2.4 `stopSystem` 不直接关 `RenderFlow.FLAG_RENDER`，`_finishedSimulation` 才调用 `disableRender`；3.8 的 `stopSystem` 也不立即标记 UIRenderer 为脏，但 `_canRender` 在下一次脏更新时会因 `_stopped` 返回 false。因此两版旧粒子的**模拟寿命**相近，3.8 的**可见寿命**还可能受渲染器何时重新计算 `_renderFlag` 影响。最小实验应在停发射前后同时记录 `particleCount`、Simulator 的 `active/finished`、组件 `_stopped`、3.8 `_renderFlag`、2.4 `node._renderFlag` 和实际画面；再单独施加一次可控的渲染数据更新，判断是否提前隐藏。

两版的第一轮自然帧状态与同步截图现已完成：[2.4 轨迹](../agent-foundation/traces/2.4.15-stage8-particle2d-headless-web.jsonl)及[停后截图](../agent-foundation/traces/2.4.15-stage8-particle2d-headless-web-after-100ms.png)、[3.8 轨迹](../agent-foundation/traces/3.8.7-stage8-particle2d-headless-web.jsonl)及[停后截图](../agent-foundation/traces/3.8.7-stage8-particle2d-headless-web-after-100ms.png)。四组条件相同：零粒子/发射中 × 自动移除开/关，内存贴图、白色不透明、停止约 100 ms 后同步冻结画面。两版发射中组仍有粒子并可见；2.4 节点渲染标志保持，3.8 虽然 `_canRender=false`，`_renderFlag=true` 且仍可见。零粒子及排空后的 `autoRemoveOnFinish=true` 都调用 `node.destroy()`，默认 `isValid` 与严格检查在调用后的同帧值分别为 true/false，随后本帧 `onDestroy`；开关关闭时，两版 `_finishedSimulation` 均在后续帧重复触发。此对照只覆盖 Creator Web 无头预览；3.8 主动使 UIRenderer 变脏时是否提前隐藏、导入资源、原生和相邻源码构建仍待验证。

两版 `autoRemoveOnFinish` 都在粒子清空且发射已停止后调用 **`node.destroy()`**，所以与粒子同节点的其他组件也属于销毁范围；节点实际回收延后到帧逻辑结束。无粒子时调用 `stopSystem` 可能在下一次有效模拟步进就触发销毁。3.8 的完结检查位于 `renderData` 空值早退之后，是两版源码中的额外诊断点；这不证明正常配置会缺失 `renderData`。公开节点销毁语义分别见[2.4](https://docs.cocos.com/creator/2.4/manual/zh/scripting/create-destroy.html)、[3.8](https://docs.cocos.com/creator/3.8/manual/zh/scripting/life-cycle-callbacks.html)手册。零粒子和排空后的自动移除、同帧有效性与回调顺序已有上述 Web 轨迹；3.8 无 `renderData` 的早退分支尚未运行验证。

2.4 的[动作系统](https://docs.cocos.com/creator/2.4/manual/zh/scripting/actions.html)和 3.8 的[程序式动画（实验性）](https://docs.cocos.com/creator/3.8/manual/zh/animation/marionette/procedural-animation/index.html)是各自的专属研究线，不为它们编造一对一的 API 对应。2.4 动作手册页本轮返回 503，公开细节待重新核对。

两版也都包含 **3D** 粒子，但不能只比较同名 `ParticleSystem`：2.4 的公开类型是 `ParticleSystem3D`，`update` 内处理发射与粒子缓冲，`stop` 清空；3.8 的 3D `ParticleSystem` 有额外的 `stopEmitting` 路径。2.4 的[3D 粒子手册](https://docs.cocos.com/creator/2.4/manual/zh/3d/particle-system-3d.html)也提示其功能尚与 Creator 3D 有差异。两版自然帧状态已有轨迹；当前 3.8 临时 CPU 粒子可见，2.4 当前预览虽有活动粒子计数，截图仍未见粒子，不能将两版画面结论合并。

同一“播放一个非循环 3D 特效并等待结束”的实现是：两版 `_emit` 都在时长越界时停发射，`update` 继续更新存活粒子并在数量归零后调用 `stop`；两版主动 `stop` 都调用 `clear`，组件启用时实际清空粒子。差别在控制与状态：2.4.15 没有公开 `stopEmitting`，且 `stop` 不清 `_isEmitting`，因此手动停止后 `isStopped=true`、`isEmitting=true` 可以同时出现；3.8 `stopEmitting` 支持单独停发射，`stop` 会把发射标志清零。3.8 的[主模块手册](https://docs.cocos.com/creator/3.8/manual/zh/particle-system/main-module.html)另规定 RenderCulling 三种模式；开启后 `Pause` 可推迟粒子排空和自动停止，`Pause and Catchup` 在剔除期间只推进系统时间，`Always Simulate` 继续模拟。两版 3D 类都没有 2D 的 `autoRemoveOnFinish`；特效结束后的节点回收应由游戏逻辑另管。两版[2.4 自然帧轨迹](../agent-foundation/traces/2.4.15-stage8-particle3d-natural-headless-web.jsonl)与[3.8 自然帧轨迹](../agent-foundation/traces/3.8.7-stage8-particle3d-natural-headless-web.jsonl)均验证了默认、非循环条件下的停发射与排空。3.8 [活动期](../agent-foundation/traces/3.8.7-stage8-particle3d-natural-headless-web-active.png)/[排空后](../agent-foundation/traces/3.8.7-stage8-particle3d-natural-headless-web-drained.png)截图确认紫红粒子出现后消失；2.4 的[两帧截图](../agent-foundation/traces/2.4.15-stage8-particle3d-natural-headless-web-active.png)没有显示粒子，材质、相机与渲染通路仍需隔离。截图期间的暂停会改变后续 `dt`，不可直接比较两版耗费帧数。RenderCulling、GPU、导入资产与原生均未测。

版本专属路径已进一步定位：2.4 `CCNode.runAction` 把动作交给 Director ActionManager，节点反激活会暂停该 target、预销毁会移除动作；2.4.15 的 `DebugInfos.json` 对该入口发出使用 Tween 的弃用提示。3.8 的 `AnimationController` 在组件 `update` 阶段推进 Marionette 图并应用最终 Pose，而普通 `Animation` 的状态由高优先级 AnimationManager 系统更新。两条路径的同目标写入结果尚无实测，不写成固定优先级规则。

3D 骨骼动画有对应主题，但内部路线差别更大。[2.4 手册](https://docs.cocos.com/creator/2.4/manual/zh/3d/skeleton-animation.html)使用继承 `Animation` 的 `SkeletonAnimation` 和 `SkeletonAnimationClip`；源码按 Model 的 `precomputeJointMatrix` 选择普通属性曲线或预计算关节矩阵曲线。[3.8 手册](https://docs.cocos.com/creator/3.8/manual/zh/animation/skeletal-animation.html)使用 `SkeletalAnimation.useBakedAnimation` 切换 GPU 预烘焙和实时骨骼节点求值。3.8 示例士兵的[Web 快照](../agent-foundation/traces/3.8.7-stage8-skeletal-web.jsonl)已确认 `Take 001` 播放中、baked 帧索引随自然帧变化、四个蒙皮渲染器关联该剪辑；2.4 示例缺骨骼资源，尚无对应运行轨迹。不能把两版名为“预计算/预烘焙”的分支视为相同数据格式或同一采样实现。

同为“预先计算骨骼数据”，数据最后进入画面的路径不同：2.4 的 `JointMatrixCurve` 按帧把矩阵写入场景关节节点的 `_jointMatrix`，`SkinnedMeshRenderer` 在 `fillBuffers` 时逐关节组装本组件的矩阵数组，再按设备容量选 uniform 或该渲染器的关节贴图；3.8 baked 状态只推进 `IAnimInfo` 帧索引，`JointTexturePool` 按剪辑预备共享贴图和逐帧包围盒，`BakedSkinningModel` 在渲染时绑定贴图和帧索引。3.8 的 Socket 另走 CPU 目标节点变换。两版都可能出现“骨骼贴图”一词，但 2.4 是当前帧关节矩阵的上传载体，3.8 是预烘焙剪辑帧的采样数据；排障时应先找组件类型与开关所在层级。

## 2026-10-05 同行为 Web 对照

| 行为 | 2.4.15 | 3.8.7 |
| --- | --- | --- |
| 音频达到 24 通道后再启动一个声音 | `cc.audioEngine` 对**同一 URL**的第 25 个受管 ID 淘汰最早 ID；两个 URL 合计 25 个 ID 在采样时都受管。[轨迹](../agent-foundation/traces/2.4.15-stage8-audio-web.jsonl) | 24 个普通播放器后插入 one-shot，最早普通播放器停止；23 普通 + one-shot 后补普通，one-shot 的 WebAudio source 先收到 `stop()`，24 个普通组件继续播放。[组件轨迹](../agent-foundation/traces/3.8.7-stage8-audio-web.jsonl)、[后端轨迹](../agent-foundation/traces/3.8.7-stage8-audio-oneshot-eviction-headless-web.jsonl) |
| 非循环 3D 粒子停止发射、排空 | 直接步进时活动数 6→0 后停止；`getParticleCount()` 在本快照读池容量 16，需另读活动数。[轨迹](../agent-foundation/traces/2.4.15-stage8-particle3d-web.jsonl) | 直接步进时 `getParticleCount()` 为 6→0 后停止；`stopEmitting` 可单独停发射并排空。[轨迹](../agent-foundation/traces/3.8.7-stage8-particle3d-web.jsonl) |
| 发射中手动停止 3D 粒子 | 活动数清零，`isStopped=true` 且 `isEmitting=true` | 活动数清零，`isStopped=true` 且 `isEmitting=false` |

这些是各自 Creator Web 预览的局部轨迹，尚未核实是否使用相邻源码构建；本表的手动步进与并发结果不外推到原生。2D/3D 粒子的自然帧和同步画面见上文独立实验。

## 2026-10-06 音频生命周期对照

| 同一开发行为 | 2.4.15 | 3.8.7 |
| --- | --- | --- |
| 3 秒 Clip 自然结束 | `cc.AudioSource.audio` 收到 `ended`，内部状态为 STOPPED。[轨迹](../agent-foundation/traces/2.4.15-stage8-audio-lifecycle-headless-web.jsonl) | 节点收到 `AudioSource.STARTED/ENDED`；`ENDED` 回调内状态仍为 PLAYING，稍后为 INIT。[轨迹](../agent-foundation/traces/3.8.7-stage8-audio-lifecycle-headless-web.jsonl) |
| 停用再启用临时节点 | `onDisable → stop`，时间归零；`playOnLoad=false` 时重新启用后仍停止。 | `onDisable → pause`，保留播放位置；`playOnAwake=false` 时重新启用后仍暂停。 |
| 播放中销毁旧场景节点 | 组件停播并销毁自己的音频对象；另一个 `cc.audioEngine` ID 仍播放。 | 普通组件先暂停，`onDestroy` 停止并清 Clip；WebAudio one-shot 在本次底层轨迹中仍运行。 |
| 旧场景 `autoReleaseAssets=false/true` 时动态 Clip | 两组真实 `helloworld → stage4-empty` 切换后，动态加载 Clip 都保持缓存，独立 ID 仍 PLAYING；显式释放 Clip 后 `uncache` 才停止 ID。[false](../agent-foundation/traces/2.4.15-stage8-audio-scene-keep-headless-web.jsonl) / [true](../agent-foundation/traces/2.4.15-stage8-audio-scene-release-headless-web.jsonl) | 两组真实 `main → stage4-empty` 切换后，动态加载 Clip 都保持缓存；显式释放后才从缓存移除。[false](../agent-foundation/traces/3.8.7-stage8-audio-scene-keep-headless-web.jsonl) / [true](../agent-foundation/traces/3.8.7-stage8-audio-scene-release-headless-web.jsonl) |

3.8 的[WebAudio one-shot 底层轨迹](../agent-foundation/traces/3.8.7-stage8-audio-oneshot-backend-headless-web.jsonl)记录 `AudioBufferSourceNode.start`、场景切换、Clip 显式释放和约 3 秒后的 `ended`，中间没有 `stop` 调用；它只支持本次 WebAudio 底层节点存续，不证明真实可听输出。两版 Clip 都由 `resources.load` 动态加载、初始 `refCount=0`，不属于源场景序列化静态依赖；因此 `autoReleaseAssets` 两分支相同并不表示静态音频依赖会相同。无头浏览器为隔离生命周期放宽了首次用户手势策略，默认自动播放、原生、后台切换与其他后端竞态仍需分别验证。

3.8 新增两条独立 WebAudio 证据：[满额淘汰](../agent-foundation/traces/3.8.7-stage8-audio-oneshot-eviction-headless-web.jsonl)时先停止 one-shot 的底层 source，再启动第 24 个普通 source；[慢加载后销毁节点](../agent-foundation/traces/3.8.7-stage8-audio-oneshot-slow-load-headless-web.jsonl)时，请求放行前源节点已严格失效，之后仍启动 one-shot 的底层 source。2.4 对应短音效入口是可按 ID 管理的 `cc.audioEngine`，已有同 URL 限额与组件销毁独立性的轨迹；不要将 3.8 的无句柄 one-shot 规则套给它。两条新增轨迹仅覆盖当前 WebAudio、成功请求和放宽手势的无头浏览器；真实听感、Native 与 DOM Audio 仍未测。

### 静态场景音频依赖

前述动态 Clip 不在源场景的序列化引用中。3.8 新建了含 `AudioSource._clip` 的磁盘场景；[两条独立 Web 轨迹](../agent-foundation/traces/3.8.7-stage8-audio-static-scene-headless-web.jsonl)确认 Clip 是 Scene 依赖，加载时 `refCount=1`。切换到空场景后引用数降到 0；`autoReleaseAssets=true` 时下一帧销毁 Clip，`false` 时仍缓存。两分支都在切换前正常播放、切换回调时普通组件已失效且停播。2.4 源 `.fire` 已写入同类 Clip UUID，但当前 Creator 导入缓存仍保留先前的 `_clip=null`；必须按[2.4 官方 AssetDB 刷新说明](https://docs.cocos.com/creator/2.4/manual/zh/extension/asset-management)重新导入并运行，才能形成同条件版本对照。当前不从 3.8 轨迹推断 2.4 结果。

2.4 已另做[内存构造 Scene 依赖的 Web 轨迹](../agent-foundation/traces/2.4.15-stage8-audio-injected-scene-dependency-headless-web.jsonl)：动态加载 Clip 后，探针登记旧 Scene 对它的依赖并增加一次引用，再通过 `director.loadScene` 切换。两分支均为引用数 1→0；关闭自动释放时 Clip 和独立 `cc.audioEngine` ID 仍保留，开启时 Clip 在切换回调之后同帧销毁并通过 `uncache` 停止 ID。2.4 这条轨迹验证释放管理器在**给定依赖记录**时的行为；3.8 轨迹还验证了编辑器序列化 Clip 被正式导入为场景依赖。由于入口条件不同，暂不把 2.4 同帧销毁、3.8 下一帧销毁写成固有版本差异。
