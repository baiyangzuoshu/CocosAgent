# 2.4.15 动画与表现：源码图与首轮 Web 验证

研究基线是官网 [2.4 动画系统](https://docs.cocos.com/creator/2.4/manual/zh/animation/index.html)、[脚本控制动画](https://docs.cocos.com/creator/2.4/manual/zh/animation/scripting-animation.html)、[缓动](https://docs.cocos.com/creator/2.4/manual/zh/scripting/tween.html)、[音频播放](https://docs.cocos.com/creator/2.4/manual/zh/audio/audio.html)、[AudioSource 组件](https://docs.cocos.com/creator/2.4/manual/zh/components/audiosource.html)、[2D ParticleSystem](https://docs.cocos.com/creator/2.4/manual/zh/components/particle-system.html)和[3D 粒子](https://docs.cocos.com/creator/2.4/manual/zh/3d/particle-system-3d.html)。动作系统另以[官方动作页](https://docs.cocos.com/creator/2.4/manual/zh/scripting/actions.html)为专题入口；该页本轮访问返回 503，具体公开约束暂不据此推断。以下内部机制来自本地 `2.4.15engine` 静态阅读；缓动已有 Web 固定时钟验证，其余主题仍须分别打点。

## 四条独立链

| 行为 | 公开入口与源码 | 本轮确认的内部连接 |
| --- | --- | --- |
| 剪辑动画 | `cc.Animation`、`cc.AnimationClip`；`cocos2d/core/components/CCAnimation.js`、`cocos2d/animation/animation-clip.js`、`animation-state.js`、`animation-animator.js`、`animation-manager.js` | `Animation.start` 的 `playOnLoad` 分支播放默认剪辑；`play` 借 `playAdditive` 取得状态并停掉其他状态。`AnimationManager.update` 推进播放中的状态，最后冲刷延迟事件。 |
| 缓动与动作 | `cc.tween`、`cc.Action`；`cocos2d/actions/tween.js`、`CCActionManager.js` | `Tween.start` 将链合成 Action，交给 `director.getActionManager().addAction`；`stop` 从 ActionManager 移除。2.4 手册明确缓动基于动作系统，既可作用于 Node，也可作用于普通对象属性。 |
| 音频 | `cc.AudioSource`、`cc.audioEngine`；`cocos2d/core/components/CCAudioSource.js`、`cocos2d/audio/CCAudio.js`、`CCAudioEngine.js` | 改 `clip` 时停止旧音频、替换 `audio.src` 并可预加载；`onEnable` 可按 `playOnLoad` 播放，`onDisable` 停止。`audioEngine` 是独立的全局 ID/实例管理入口，两条路径最终都用内部 `CCAudio`。 |
| 粒子 | `cc.ParticleSystem`；`cocos2d/particle/CCParticleSystem.js`、`particle-simulator.js` | 组件保存发射参数与播放状态，`playOnLoad` 路径调用 `resetSystem`；`lateUpdate` 驱动模拟器，`stopSystem` 停止发射。2.4 另有 `cocos2d/core/3d/particle/`，不能以 2D 组件解释全部粒子。 |

动画与缓动各有自己的管理器，但都进入同一个 Director 帧循环：`CCDirector.init` 先创建、调度 ActionManager，`sharedInit` 再创建、调度 AnimationManager，两者使用 `Scheduler.PRIORITY_SYSTEM`。`CCDirector.mainLoop` 在组件 `start/update` 后调用 `_scheduler.update(dt)`，再执行组件 `lateUpdate`。由此可定位同帧写入的观察点；**同一属性同时被动画和缓动写入时的最终值尚未运行验证**，不要只凭注册顺序断言优先级。动画 `AnimationState.emit` 将事件送入 `AnimationManager.pushDelayEvent`，管理器在本次状态更新后统一派发；需要用实测记录 `PLAY`、帧事件、`FINISHED` 相对属性采样和组件回调的时序。

`animation-animator.js::initClipData` 把 Clip 的时长、速度、循环方式和采样率写入 State，并用 `clip.createCurves(state, root)` 建立属性曲线；剪辑事件作为 `EventAnimCurve` 加到同一曲线数组。`AnimationState.sample` 遍历曲线并直接采样到目标属性，`process` 在采样后判断是否结束，再把 `finished` 放进延迟事件队列。因此游戏脚本排查“动画有状态但属性不动”时，要查目标节点路径、组件属性绑定和曲线；排查事件顺序时，要把采样与事件队列分开观察。

对于普通数值属性，`DynamicAnimCurve.sample` 最后直接执行 `this.target[this.prop] = value`；`cocos2d/actions/tween.js::TweenAction.update` 则执行 `target[name] = current`。因此同一 Node 的 `x` 被两条链写入时，它们确实会争用同一个属性 setter。已验证的管理器调用顺序是 ActionManager 在前、AnimationManager 在后；在两者本帧都实际写入的条件下，源码提示后采样的剪辑值会覆盖本次缓动写入，但具体步进、剪辑结束帧和最终可见值仍以运行轨迹为准。

本快照的 `cocos2d/actions/tween.js::Tween` 提供 `start/stop`，没有 Tween 实例级的 `pause/resume`；`CCNode.pauseAllActions/resumeAllActions` 经 Director ActionManager 对节点 target 暂停/恢复，作用范围是该节点的**全部**动作。普通对象需要按 ActionManager target 排查暂停。`Tween.start` 还会给没有 `_id` 的普通 target 写入 `_id` 以供动作管理器索引，诊断对象意外新增属性时应识别这一内部行为。

音频的 `CCAudioSource.play` 每次先把播放位置设为 0，再调用内部 `audio.play()`；`onEnable` 的 `playOnLoad` 只在首次启用时自动播放，`onDisable` 则停止并取消游戏隐藏/显示监听。这个停用路径与手动 `pause` 不同。实际 Web/Native 音频后端是否把停止后时间位置归零，仍需分别测。

## 音频入口、异步加载与后端

[2.4 官方音频播放页](https://docs.cocos.com/creator/2.4/manual/zh/audio/audio.html)同时介绍场景组件 `AudioSource` 和脚本 API `cc.audioEngine`，并要求给后者传入完整 `AudioClip`。组件的 `clip` setter 在 `CCAudioSource.js` 中拒绝非 `AudioClip` 值，先 `audio.stop()`，再将新剪辑设为 `audio.src`；`preload=true` 时主动调用 `_ensureLoaded`。`CCAudio.js::src` 为未加载的剪辑注册 `load` 回调，回调到达时先检查 `clip === this._src`，旧 clip 的迟到结果不会重建当前播放器。这项保护在 2.4 已存在。

`CCAudio.play/pause/stop` 都经当前 `AudioClip._ensureLoaded` 延后到资源就绪；`stop` 在回调里暂停底层 element、把 `currentTime` 置零、移除待用户手势播放条目并发出内部 `stop`。`_createElement` 根据已导入资源使用 DOM `HTMLAudioElement` 或 `WebAudioElement`；DOM 自动播放受限时 `_touchToPlay` 把实例加入待播放列表，并在画布的下一次触摸/鼠标事件中重试。官网 [AudioSource 组件页](https://docs.cocos.com/creator/2.4/manual/zh/components/audiosource.html)也提醒移动浏览器/WebView 的用户手势限制。这里描述的是源码预期控制流，实际浏览器拒播、事件和时间位置仍需实测。

`CCAudioEngine.js` 为每次 `play(clip, loop, volume)` 分配管理 ID，按 `clip.nativeUrl` 关联实例；`uncache(clip)` 会停止并删除该路径下受管理的实例。它与组件的 `CCAudioSource.audio` 实例不是同一个所有权入口，诊断“停组件后声音仍在”时应先查播放者究竟是谁。测试 WAV 已有 Creator 生成的 `audio-clip` `.meta` 和 Web 加载、并发播放轨迹；Native 与系统音频缓冲释放仍无运行证据，不能从这些内部方法直接断言释放时刻。

并发上限也只适用于这条 `cc.audioEngine` 路径：`CCAudioEngine.js::getAudioFromPath` 按 `clip.nativeUrl` 维护播放 ID 列表，达到 `_maxAudioInstance=24` 时移出该路径最早的 ID，并对其调用 `stop()`；结束或停止回调再从 ID 映射移除实例并回收到最多 32 个对象的池中。这里的 24 是**同一路径的受管理实例上限**，32 是可复用对象池大小，不是总播放通道数。`getMaxAudioInstance()` 返回该值；本快照的 `setMaxAudioInstance()` 自 2.4 起已弃用且只警告、不改值。`CCAudioSource` 自己持有 `CCAudio`，不经 `getAudioFromPath`，不能将此淘汰规则直接套给组件或平台后端。官网 [2.4 audioEngine API](https://docs.cocos.com/creator/2.4/api/zh/classes/audioEngine.html)提供公开方法；具体淘汰顺序来自本地源码，真实平台可听结果未打点。

为并发验证，2.4 示例的 `assets/resources/` 已加入两段 3 秒、22.05 kHz、16 位单声道、低振幅 WAV（`stage8-tone-a.wav`、`stage8-tone-b.wav`），分别为 440/660 Hz。[2.4 音频探针](../agent-foundation/probes/stage8-audio-2.4.js)等资源加载完后显示一次性按钮，由用户点击触发同 URL 25 次和两 URL 合计 25 次播放，只停止它创建的 ID，记录各 ID 状态。WAV 是按[2.4 音频资源手册](https://docs.cocos.com/creator/2.4/manual/zh/asset/audio.html)支持的格式准备；Creator 已生成 `audio-clip` `.meta`，探针仅通过 `node --check`，**已有运行时加载与 `cc.audioEngine` 并发 Web 轨迹**，组件、结束与原生仍待验证。

声音跨场景时还要把 **组件销毁、播放 ID 与 Clip 释放**分开。`CCAudioSource.onDisable` 调用 `stop()`，`onDestroy` 销毁组件自己的 `audio`；它的游戏隐藏/显示监听只在组件启用期间存在。`cc.audioEngine` 的全局 ID 不属于场景节点，但 `CCAudioClip.destroy()` 会调用 `cc.audioEngine.uncache(this)`，按 `nativeUrl` 停止该 Clip 的受管 ID。`CCDirector.runSceneImmediate` 对旧场景调用自动释放，再销毁旧场景，所以“全局音效跨场景继续”取决于该 Clip 是否实际被释放、是否仍被其他引用保留及具体后端；不能只凭播放入口下结论。官网[资源释放手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/release-manager.html)说明自动释放要通过检查。`cc.game.pause/resume` 又通过 `cc.audioEngine._break/_restore` 暂停/恢复其受管 ID，而组件分别响应 `EVENT_HIDE/SHOW`。这些是源码接线，回调先后和可听结果仍需运行轨迹。

2D 粒子 `CCParticleSystem.stopSystem` 将 simulator 设为不再发射，组件 `lateUpdate` 调用 `particle-simulator.js::step`，在 `active=false` 后仍更新已有粒子；待粒子数归零时调用 `_finishedSimulation`，可能按 `autoRemoveOnFinish` 销毁节点。`resetSystem` 会清空当前粒子并重启发射。这里的“停止发射、旧粒子自然消亡”同时见于[2.4 官方 API](https://docs.cocos.com/creator/2.4/api/zh/classes/ParticleSystem.html)和源码，与资源释放时点不能画等号。

渲染开关的准确位置也要区分：`stopSystem` 本身不调用 `disableRender`，模拟器在粒子仍存活时继续更新缓冲和绘制索引；只有 `_finishedSimulation` 明确关闭 `RenderFlow.FLAG_RENDER`。源码因此保留了旧粒子到自然结束的绘制链。实际画面仍受贴图、组件启用和渲染提交影响；本次内存贴图 Web 条件的同步截图见下段。

`autoRemoveOnFinish` 的销毁点更靠后：`particle-simulator.js::stop` 将 `active=false`、`readyToPlay=false`；`step` 只有在粒子数组已空且这两个标志都为 false 时，才设 `finished=true` 并调用 `_finishedSimulation`。组件随后 `resetSystem → stopSystem → disableRender`，若启用 `autoRemoveOnFinish` 则调用 **`this.node.destroy()`**，删除的是承载粒子组件的整个节点，不只是组件。没有存活粒子时手动 `stopSystem` 也可能在下一次有效 `lateUpdate` 触发这条链；`duration=-1` 持续发射则要有停止发射或其他结束条件。`node.destroy()` 仍按[2.4 节点销毁手册](https://docs.cocos.com/creator/2.4/manual/zh/scripting/create-destroy.html)延后到帧逻辑结束处理，不能把 `stopSystem`、调用 `destroy` 与 `onDestroy` 记作同一时刻。公开属性含义见[2.4 ParticleSystem API](https://docs.cocos.com/creator/2.4/api/zh/classes/ParticleSystem.html)；本次内存贴图 Web 预览的帧数和节点有效性见下段；导入资源与原生仍需独立验证。

[2.4 临时 2D 粒子探针](../agent-foundation/probes/stage8-particle2d-2.4.js)在独立无头 Chrome 打开的 Creator 预览中，用内存中的 8×8 白色贴图并列创建“零粒子/发射中 × 自动移除开/关”四组，不修改场景源文件。[自然帧轨迹](../agent-foundation/traces/2.4.15-stage8-particle2d-headless-web.jsonl)显示：发射中组在停发射前各有 12 粒，停后约 100 ms 仍各有 12 粒且节点渲染标志为 128；[停前](../agent-foundation/traces/2.4.15-stage8-particle2d-headless-web-before-stop.png)与[停后截图](../agent-foundation/traces/2.4.15-stage8-particle2d-headless-web-after-100ms.png)均能看到白色粒子。零粒子自动移除组在停发射后的首个有效帧调用 `_finishedSimulation` 和 `node.destroy()`；发射中自动移除组在粒子数归零后才调用它们。两组 `destroy()` 调用后的同帧采样均为默认 `isValid=true`、严格 `isValid(node,true)=false`，随后本帧调用 `onDestroy`；100/600 ms 采样已失效。自动移除关闭的两组则在后续每帧重复进入 `_finishedSimulation`，因为该函数内部 `resetSystem → stopSystem` 清除了 `finished`。以上只覆盖内存贴图、Web 无头预览；相邻源码构建是否启用、导入资源与原生仍未验证。

2.4 另有公开的 `cc.ParticleSystem3D`，官网[3D 粒子页](https://docs.cocos.com/creator/2.4/manual/zh/3d/particle-system-3d.html)明确它在 2.3 引入且与后续 Creator 3D 有功能差异。本地 `cocos2d/core/3d/particle/particle-system-3d.ts` 的 `play` 设置播放/发射标志，组件 `update` 调 `_emit`、粒子更新、缓冲更新；`stop` 在播放或暂停时调用 `clear`，重置计时和停止标志。本快照没有同名公开 `stopEmitting` 方法，正常时长结束通过内部 `_isEmitting=false` 转入排空。不能把 2D `stopSystem` 套用到 2.4 的 3D 粒子，也不能把 3.8 的 3D API 反推到 2.4。

继续沿 `ParticleSystem3D._emit/update/stop` 核对：非循环系统越过 `duration + startDelay` 时，`_emit` 置 `_isEmitting=false` 并停止新增粒子；`update` 仍调用 assembler 更新旧粒子，待数量为零才调用 `stop()`。手动 `stop()` 则在播放或暂停时调用 `clear()`；粒子实际清空还要求组件 `enabledInHierarchy`。`stop` 源码**没有**把 `_isEmitting` 置 false，所以若在发射中手动停止，`isStopped` 可为 true 而 `isEmitting` 仍为 true。`play()` 才会再次显式置两者为播放/发射状态。这里是 2.4.15 的状态字段推论，需在 2.4 预览记录三个 getter 与粒子数；不可把 `isEmitting` 单独当作正在播放的判据。[2.4 ParticleSystem3D API](https://docs.cocos.com/creator/2.4/api/zh/classes/ParticleSystem3D.html)公开了 `play/pause/stop/clear`，未提供与 3.8 同名的 `stopEmitting`。此 3D 组件也没有 2D `autoRemoveOnFinish` 属性，排空不等于自动销毁节点。

[2.4 3D 粒子状态探针](../agent-foundation/probes/stage8-particle3d-2.4.js)在现有预览中临时创建组件，以直接 `update(0.05)` 分别记录非循环自然结束和发射中手动停止。[自然帧探针](../agent-foundation/probes/stage8-particle3d-natural-2.4.js)另由 Director 正常调度组件 `update`，不直接调用它。

## 2.4 的 3D 骨骼动画

[2.4 骨骼动画组件手册](https://docs.cocos.com/creator/2.4/manual/zh/3d/skeleton-animation.html)说明 `cc.SkeletonAnimation` 继承普通 `Animation`，使用 `cc.SkeletonAnimationClip`，模型导入后的 Prefab 可自动带此组件。本地 `CCSkeletonAnimation.js` 的 `__preload` 把 Model 接到默认和其他骨骼剪辑，`addClip` 也先设置 clip 的 Model，再复用普通 Animation 的注册逻辑。诊断“3D 模型有剪辑却不动”时要先检查 Model 与剪辑的接线。

`CCSkeletonAnimationClip.js::_init` 根据 Model 的 `precomputeJointMatrix` 分支准备曲线。关闭时从二进制缓冲生成位置、缩放和旋转曲线，仍由普通 `AnimationClip.createCurves` 建立采样；开启时预计算各关节矩阵，`CCJointMatrixCurve.sample` 按帧索引写目标 `_jointMatrix`。这是 2.4.15 的两条实现路径，不能等同于 3.8 的 `useBakedAnimation` 和全局动画贴图机制。当前 2.4 示例无骨骼资源，运行表现尚未验证。

### 预计算关节矩阵如何到达蒙皮渲染

[2.4 骨骼动画手册](https://docs.cocos.com/creator/2.4/manual/zh/3d/skeleton-animation.html)将它描述为继承普通动画组件、使用 `SkeletonAnimationClip` 的公开入口；`precomputeJointMatrix` 以下是本快照内部 Model 标志，不应当写成与 3.8 `useBakedAnimation` 对应的公开组件开关。

`SkeletonAnimationClip._generateJointMatrixCurve` 在剪辑初始化时按 `1 / sample` 遍历时间，沿 Model 的节点树把局部位置、旋转、缩放合成矩阵，并对特殊 bind pose 做修正。随后 `_createJointMatrixCurve` 把关节路径绑定到实际场景节点；采样时 `CCJointMatrixCurve.sample` 按比例选帧，将预计算矩阵写到目标节点的 `_jointMatrix`。这条路径把结果留在 CPU 侧的关节节点字段，并非 3.8 的帧索引加共享 GPU 动画贴图。

`CCSkinnedMeshRenderer._useJointMatrix` 读同一 Model 标志，选择 `_calJointMatrix`；该函数逐关节读取 `_jointMatrix`、应用普通 bind pose，并填充本组件的矩阵数组。`skinned-mesh-renderer.js::fillBuffers` 在提交网格前调用 `calcJointMatrix`。最终关节数据能放下时直接走 material 的 `jointMatrices`；关节数超过设备限制时写本组件 `jointsTexture`，每次提交会更新它。这里的“贴图”是渲染器当前关节矩阵的载体，不是 3.8 按剪辑预烘焙、由帧索引采样的共享贴图。具体设备阈值、Web/原生上传次数及画面仍需运行验证。

## 2.4 专属：Action 与 Node 生命周期

[2.4 缓动手册](https://docs.cocos.com/creator/2.4/manual/zh/scripting/tween.html)明确把 `cc.tween` 描述为动作系统之上的链式封装，同时保留 `node.runAction(cc.sequence(...))` 的示例。本地 `CCNode.runAction` 仅在 `node.active` 时把 Action 加入 Director 的 ActionManager；节点激活/反激活分别恢复/暂停该 target，预销毁时移除该节点的全部动作。调用 `runAction` 时还会触发 `cc.warnID(1639)`，`DebugInfos.json` 将其解释为“`cc.Action` 已弃用，请使用 `cc.Tween`”。这是 2.4.15 源码中的警告，不能据此把手册中的 Action 示例从研究范围删掉；诊断老项目仍需识别 `runAction`、`pauseAllActions`、`stopAllActions` 与 Tween 共用 ActionManager 的关系。动作系统专题页当前访问失败，公开说明暂以可访问的缓动手册和本地源码为限。

## 最小验证设计

### 普通属性剪辑：官网用法与源码准备

[2.4 创建剪辑](https://docs.cocos.com/creator/2.4/manual/zh/animation/animation-clip.html)说明剪辑要挂在 `Animation` 组件上，属性关键帧属于剪辑内的数据；[添加动画事件](https://docs.cocos.com/creator/2.4/manual/zh/animation/animation-event.html)说明时间轴事件按函数名寻找组件方法。源码 `animation-clip.js::createTargetCurves` 从 `curveData.props` 为根节点生成属性曲线，`createPropCurve` 用关键帧的秒数除以 `duration` 形成采样比例；`animation-animator.js::initClipData` 另把 `clip.events` 变成 `EventAnimCurve`，加入同一曲线数组。`AnimationState.sample` 直接采样目标属性，状态事件再由管理器延迟派发。这里的事件曲线与 `Animation` 组件的 `play/finished` 状态事件应分别记录。

已准备[2.4 普通剪辑与同属性缓动探针](../agent-foundation/probes/stage8-clip-tween-2.4.js)：页面内临时 Node 上让剪辑驱动 `x: 0→100`，先单播，再与 `x: 0→200` 的 Tween 同播，固定步进采集每个管理器前后读数、组件播放事件和 0.1 秒时间轴函数事件。源码 `EventAnimCurve.sample` 首次采样可直接触发当前帧事件，后续跨越的事件帧进入管理器延迟队列；本次只跨越一个 0.1 秒事件键，不能据此判定两条路径的完整差别。探针已在当前 Web 预览以手动 `Scheduler.update(0.05)` 每相位 8 步运行，[逐步轨迹](../agent-foundation/traces/2.4.15-stage8-clip-tween-headless-web.jsonl)显示单播剪辑 `x=0→100`；同属性同播时第 1 个非零步 ActionManager 将 `x` 写至 40，随后 AnimationManager 改为 20，最终样本为 100。两相位均在第 2 步收到时间轴函数事件，当时 `x=40`；第 5 步 `stop` 与 `finished` 状态事件到达时 `x=100`。该结论只覆盖此临时剪辑和固定时钟，不能推广到自然帧或复杂混合。

`2.4.15NewProject` 没有现成 `.anim` 或粒子资源；新增音频 WAV 已有 Creator 生成的 `.meta` 和 Web 并发播放轨迹。[Web 缓动原始轨迹](../agent-foundation/traces/2.4.15-stage8-tween-web.jsonl)已经在页面可见、游戏未暂停时执行：临时暂停自然循环，手动调用 `Scheduler.update(0.05)` 20 次。前两个步进中 ActionManager 总在 AnimationManager 前；第一次步进只建立动作起点，第二次后普通对象与 Node 都为 20。第 1 步后 `Node.pauseAllActions`，第 2、3 步节点保持 20，对象继续到 40、60；第 3 步后恢复节点、停止另一对象缓动，它停在约 30。完成回调分别在第 5 步（对象）与第 7 步（节点）触发，两者最终为 100。探针临时节点与管理器包装已清理。此结果只适用于本次固定 `dt` 手动步进，不证明自然 RAF 帧率或 `by` 的结果；同一属性动画竞争另有上段独立轨迹。

下一步用对应 Creator 创建可删除的最小动画剪辑，记录自然帧播放与事件。音频已用独立短音频分别测并发与 Web 生命周期，后续补原生及更多失败分支。实验应保存平台、版本、关键参数和事件轨迹，完成后再将结论写入候选 skill。

本篇仍是阶段 8 进行中的索引；音频、粒子和普通剪辑的跨平台行为尚未验证。

### 2026-10-05 Web 补测

[音频并发轨迹](../agent-foundation/traces/2.4.15-stage8-audio-web.jsonl)来自 Creator 2.4.15 示例预览、页面可见且游戏未暂停时的用户点击。两段 `AudioClip` 通过 `cc.resources.load` 返回；`cc.audioEngine` 对 A Clip 连播 25 次后，ID 1 变为 `getState=-1` 且不在 `_id2audio`，ID 2–25 仍为状态 1；A/B 两个 URL 合计 25 次时，ID 26–50 在采样时均为状态 1、受管理。由此只确认**本次 Web 预览中按同 URL 的受管 ID 淘汰**；组件、结束与释放由下文独立探针验证。

[3D 粒子手动步进轨迹](../agent-foundation/traces/2.4.15-stage8-particle3d-web.jsonl)来自临时 `ParticleSystem3D` 的 0.05 秒直接步进。非循环时先停发射，活动粒子数从 6 排到 0 后停止；发射中手动 `stop()` 后，`isStopped=true`、`isEmitting=true` 同时出现。本快照 `particle-system-3d-renderer.ts::getParticleCount` 返回池 `_particles.data.length`，渲染循环使用活动长度 `_particles.length`；前者在该实验中一直是 16。预览生成脚本已还原至 SHA-256 `a8aa3011ee6698012a1dec9fa73549ebf4bb1c49de34e9488c045001d40b1d2e`。

[独立自然帧轨迹](../agent-foundation/traces/2.4.15-stage8-particle3d-natural-headless-web.jsonl)在无头 Chrome 的 Creator 预览中记录到组件 `update` 与 `AFTER_DRAW`，非循环发射先停止，最多 40 个活动粒子随后排空，最后 `isStopped=true`；临时节点仍有效。探针把粒子放在主相机前 5 单位，延长发射至 0.7 秒以避开首帧大步长；`getParticleCount()` 随池扩容变为 64，停止后仍为 64，更不能把它当活动数。同步[活动期](../agent-foundation/traces/2.4.15-stage8-particle3d-natural-headless-web-active.png)与[排空后](../agent-foundation/traces/2.4.15-stage8-particle3d-natural-headless-web-drained.png)截图的场景中心没有可见粒子差异，因此**本次只验证模拟与调度，没有验证 2.4 3D 粒子可见性**；材质、相机、渲染管线还需隔离测试。截图期间短暂暂停游戏，预览使用的引擎来源未确认，不能推及原生或导入粒子资产。

### 2026-10-06 Web 音频生命周期

[组件自然结束/停用/销毁轨迹](../agent-foundation/traces/2.4.15-stage8-audio-lifecycle-headless-web.jsonl)使用 Creator 预览和临时 `cc.AudioSource`。3 秒 Clip 播放后约 3 秒收到内部 `audio` 的 `ended`，状态变为 STOPPED；节点反激活时 `onDisable → stop`，时间归零，重新激活后保持停止。播放中的节点 `destroy()` 先触发同一停播链，帧末 `onDestroy` 销毁组件音频对象；同 Clip 的独立 `cc.audioEngine` ID 在组件销毁 100 ms 后仍为 PLAYING。2.4 的组件 `audio` 实例与全局 ID 是不同所有者，不能用组件销毁推断全局 ID 已停止。

两次独立的真实磁盘场景切换分别把旧 Scene 的 `autoReleaseAssets` 在运行时设为 [false](../agent-foundation/traces/2.4.15-stage8-audio-scene-keep-headless-web.jsonl) 和 [true](../agent-foundation/traces/2.4.15-stage8-audio-scene-release-headless-web.jsonl)。`helloworld → stage4-empty` 时组件经 `onDisable/onDestroy` 停播；由 `resources.load` 动态取得、初始 `refCount=0` 的 Clip 在两组切换回调及 400 ms 后都仍缓存且有效，全局 ID 仍 PLAYING。随后**显式** `assetManager.releaseAsset(clip)` 才移出缓存、调用 `AudioClip.destroy → audioEngine.uncache`，全局 ID 立即变为 `getState=-1`；Clip 约 400 ms 后失效。此 Clip 未在源场景中序列化为静态依赖，因此不能从这个实验推出 `autoReleaseAssets` 对静态音频依赖没有作用。

### 2026-10-06 场景音频依赖的受控补测

[2.4 资源释放手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/release-manager.html)将场景“自动释放资源”定义为切换时释放该场景的依赖，并说明 Asset Manager 只自动统计资源间的静态引用，动态引用由开发者管理。源码 `depend-util.js::parse/_parseDepsFromJson` 从场景 JSON 的 `__uuid__` 解析依赖；`releaseManager.js::_autoRelease` 遍历旧 Scene 的依赖列表，按 `oldScene.autoReleaseAssets` 调用每项 `decRef`，随后移除旧 Scene 依赖记录。

当前 `stage8-audio-static.fire` 的源文件已写入 `AudioSource._clip` UUID，但 2.4 Creator 的导入缓存仍为 `_clip=null`。[旧导入诊断](../agent-foundation/traces/2.4.15-stage8-audio-static-scene-stale-import-headless-web.jsonl)确认预览加载后 Clip 为空、场景依赖数为 0；仅临时替换单个生成 JSON 也未改变预览，修改已按 SHA-256 恢复。因此尚不能把这份源场景称为已被编辑器验证的静态依赖。[2.4 官方 AssetDB 文档](https://docs.cocos.com/creator/2.4/manual/zh/extension/asset-management)要求对外部修改后未重新导入的资源调用 `Editor.assetdb.refresh`。

为隔离引擎释放路径，[内存依赖探针](../agent-foundation/probes/stage8-audio-injected-scene-dependency-2.4.js)先动态加载 Clip，再在当前 Scene 依赖表中登记其 UUID 并对 Clip `addRef()` 一次；之后给临时组件赋值、启动独立 `cc.audioEngine` 循环 ID，执行真实 `helloworld → stage4-empty` 磁盘切换。两条独立[Web 轨迹](../agent-foundation/traces/2.4.15-stage8-audio-injected-scene-dependency-headless-web.jsonl)都在切换时将 Clip 引用数从 1 减到 0，旧组件停播并销毁。`autoReleaseAssets=false` 时 400 ms 后 Clip 仍在缓存，独立 ID 仍播放；`true` 时切换回调之后同帧进入 `AudioClip.destroy`，缓存移除且 `audioEngine.uncache` 令该 ID `getState=-1`。这验证当前 Web 预览的 `Director → releaseManager → AudioClip.destroy/uncache` 分支；依赖登记是探针在内存中构造，**仍需编辑器重新导入源 `.fire` 后复测真实静态序列化路径**。不从本次帧数推断所有平台释放时点。

上述无头 Web 实验仅为观察生命周期而用 Chrome 参数放宽首次用户手势要求；默认浏览器自动播放限制及真实听感未验证。预览是否使用邻接源码构建仍未知，原生、页面隐藏/恢复与慢加载竞态需分别验证。公开播放入口仍以[2.4 音频手册](https://docs.cocos.com/creator/2.4/manual/zh/audio/audio.html)和[AudioSource 手册](https://docs.cocos.com/creator/2.4/manual/zh/components/audiosource.html)为准。
