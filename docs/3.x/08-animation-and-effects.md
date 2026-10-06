# 3.8.7 动画与表现：源码图与首轮 Web 验证

公开行为以官网 [3.8 动画系统](https://docs.cocos.com/creator/3.8/manual/zh/animation/index.html)、[缓动系统](https://docs.cocos.com/creator/3.8/manual/zh/tween/index.html)、[缓动接口](https://docs.cocos.com/creator/3.8/manual/zh/tween/tween-interface.html)、[AudioSource 组件](https://docs.cocos.com/creator/3.8/manual/zh/audio-system/audiosource.html)、[粒子系统](https://docs.cocos.com/creator/3.8/manual/zh/particle-system/index.html)和[程序式动画（实验性）](https://docs.cocos.com/creator/3.8/manual/zh/animation/marionette/procedural-animation/index.html)为基线。以下内部连接来自本地 `3.8.7engine` 静态阅读。程序式动画须保留官网的“实验性”限定，不能作为普通剪辑动画的默认路径。

## 四条独立链

| 行为 | 公开入口与源码 | 本轮确认的内部连接 |
| --- | --- | --- |
| 剪辑动画 | `Animation`、`AnimationClip`、`AnimationState`；`cocos/animation/animation-component.ts`、`animation-clip.ts`、`animation-state.ts`、`animation-manager.ts`、`cross-fade.ts` | `Animation.start` 在 `playOnLoad` 且尚未播放时以零过渡时间切换到默认剪辑；`play` 也走 `crossFade(name, 0)`。`AnimationManager.update` 依次推进过渡和活动状态、应用混合缓冲、更新 socket，最后派发延迟事件。 |
| 缓动 | `tween`；`cocos/tween/tween.ts`、`tween-action.ts`、`tween-system.ts`、`cocos/tween/actions/action-manager.ts` | `Tween.start` 将链转为最终动作，设置速度/起点/暂停标志，再加入 TweenSystem 的 ActionManager；`stop` 先停止动作再移除。动作管理器是该系统内部机制，不能把 2.4 的 `cc.Action` 公开用法照搬过来。 |
| 音频 | `AudioSource`、`AudioClip`、`playOneShot`；`cocos/audio/audio-source.ts`、`audio-clip.ts`、`audio-manager.ts`、`pal/audio/web/`、`pal/audio/native/` | `clip` 赋值触发 `_syncPlayer`，通过 `AudioPlayer.load` 异步创建平台播放器；异步完成时检查当前 clip，过时播放器会被销毁。普通节点 `onDisable` 暂停，常驻节点例外；`onDestroy` 停止并清空 clip。 |
| 粒子 | `ParticleSystem` / `ParticleSystem2D`；`cocos/particle/particle-system.ts`、`cocos/particle-2d/particle-system-2d.ts` | 3D 组件 `onEnable` 注册 `BEFORE_COMMIT` 回调，按 `playOnAwake` 播放并启用 processor；`onDisable` 移除回调、停用 processor。2D 组件在 `lateUpdate` 推进 Simulator，再由 UI Batcher 提交渲染。 |

## 帧更新位置

`cocos/game/director.ts::tick` 在组件 `start/update` 后依系统优先级调用 `System.update`，之后才运行组件 `lateUpdate`。`AnimationManager` 在 `DirectorEvent.INIT` 以 `SystemPriority.HIGH=200` 注册；`TweenSystem` 以 `MEDIUM=100` 注册，`System.sortByPriority` 按高到低排序。因此本快照的系统调用位置是动画先于缓动。**这只是调用链结论**：同一属性并发写入时可能涉及混合缓冲、具体属性 setter 和节点变换缓存，最终可见值还需逐帧探针确认。

`AnimationComponent.onDisable` 暂停 CrossFade，`onDestroy` 停止并销毁状态；`AnimationState` 的事件经 AnimationManager 延迟队列派发。需要分别记录 `play`、交叉淡入淡出、采样、`LASTFRAME`、`FINISHED` 和组件回调时序。

`AnimationState.initialize` 从 Clip 设置时长、速度、循环与采样率，并创建 `clip.createEvaluator`；若存在全局/传入的混合缓冲，则经 `PoseOutput` 写入姿态。事件和嵌入式播放器各有独立 evaluator。`AnimationState` 采样后判断完成并排入事件队列，`AnimationManager.update` 则在所有状态更新后应用混合缓冲，再派发队列。排查“状态在播放但节点不动”时，应依次检查 Clip 轨道绑定、目标层级、PoseOutput 权重和最终混合应用；不能套用 2.4 的逐曲线直接写值路径。

`LegacyNodeBlendState.apply` 对有权重的 `position` 调用 `node.setRTS` 应用混合结果；`TweenAction.update` 则对工作目标执行 `workerTarget[name] = prop.current`。在本探针的普通 Node 目标上，Tween 写 `position` 会进入 Node 的 `position` setter，再调用 `setPosition`。因此同属性实验应分别读 AnimationManager 的混合应用后值和 TweenSystem 更新后值；已验证的系统顺序提示同帧两者都写入时，较晚的 Tween 可能覆盖剪辑姿态，但本次固定时钟下的实际数值、起步时机和完成帧已由下述普通剪辑探针验证；自然帧和其他混合权重仍须另测。

## 3.8 的骨骼动画及示例接线

[3.8 骨骼动画手册](https://docs.cocos.com/creator/3.8/manual/zh/animation/skeletal-animation.html)把 `SkeletalAnimation.useBakedAnimation` 明确为预烘焙与实时计算两条路径的开关：预烘焙数据存于共享动画贴图，蒙皮在 GPU 取样；实时计算会更新场景骨骼节点树，支持节点级控制与混合。预烘焙模式下挂在骨骼子节点的外部物体不能直接随骨骼变换，需要 Socket。这个区别直接影响 agent 对“骨骼节点不动但模型在动”的诊断。

本地 `skeletal-animation.ts` 继承普通 `Animation`：`onLoad` 搜索以当前节点为 `skinningRoot` 的 `SkinnedMeshRenderer` 并登记为用户；`doPlayOrCrossFade` 在预烘焙模式下停止前一个 baked state、播放新 state，实时模式则交给父类 CrossFade。`SkeletalAnimationState.initialize` 在预烘焙模式跳过普通曲线 evaluator，取得预采样帧和动画信息；播放时让关联的蒙皮渲染器上传 clip。`_sampleCurvesBaked` 每帧写动画帧索引，并单独更新 Socket 目标，而非逐骨骼节点写姿态。实时路径重新使用普通状态曲线求值。这与上文的普通 `AnimationState` 轨迹不能混为一谈。

示例中 `assets/scene/main.scene` 通过 `cfc53c4e-7956-482b-aebc-3fb1dcd36eef` 引用 `assets/model/helloWorld/soldier.prefab`；该 Prefab 的 `cc.SkeletalAnimation` 绑定 `soldier.FBX.meta` 的 `Take 001.animation` 子资源（UUID 后缀 `@73b7f`），并设置 `playOnLoad=true`、`_useBakedAnimation=true`。Web 预览中的士兵状态与渲染器关联已由下文快照验证，剪辑事件仍未打点。单独的 `grass/grass.prefab` 将 `playOnLoad` 设为 false，但场景引用的是 `grass/grassGoup.prefab`（UUID `5e4d48c4-0e34-45af-a268-89485197e8bc`），其多个草地骨骼组件设为 true；Web 预览读取到草地组件正在播放，与场景实际引用一致。诊断时不能拿未实例化的资源默认值替代场景中实际 Prefab 的值。

`cocos/tween/tween.ts::Tween.pause/resume` 直接修改该 Tween 最终 Action 的暂停标志，属于实例级控制；`stop` 则先停止 Action 再从 TweenSystem 的 ActionManager 移除。两条链不要混成“暂停节点上所有动作”。单条 Tween 的暂停/恢复已有下文 Web 固定时钟轨迹；同 target 多 Tween 的暂停范围仍需实测。

### 预烘焙状态如何到达蒙皮画面

官网的[骨骼动画系统说明](https://docs.cocos.com/creator/3.8/manual/zh/animation/skeletal-animation.html)指出：预烘焙模式由组件维护播放进度，`SkinnedMeshRenderer` 持有 `BakedSkinningModel`，后者用预烘焙包围盒裁剪并在 GPU 从骨骼贴图取当前帧。源码把这条路径细化为以下连接；预览已确认状态帧和渲染器类型，GPU 取样细节仍以手册与源码为证据：

1. `SkeletalAnimationState.initialize` 从 `SkelAnimDataHub` 取得剪辑预采样帧数，按骨骼根节点 UUID 从 `JointAnimationInfo.getData` 取得共享的 `IAnimInfo`。`onPlay` 切换该信息的当前剪辑，并让所有关联的 `SkinnedMeshRenderer.uploadAnimation(clip)` 上传剪辑。
2. `SkinnedMeshRenderer` 要求 `skinningRoot` 是渲染节点的祖先，且该根节点有启用的 `SkeletalAnimation`，才与动画组件关联。`setUseBakedAnimation` 在 `BakedSkinningModel` 与实时 `SkinningModel` 间切换；已有模型会被销毁并重建。这也解释官网所说高频切换模式会重建底层渲染数据。
3. `BakedSkinningModel.uploadAnimation` 从 `JointTexturePool.getSequencePoseTexture` 取得按骨架与剪辑缓存的贴图和逐帧包围盒。首次生成时，池遍历剪辑帧与关节，把变换和 bind pose 合成后写入骨骼贴图数据；渲染模型绑定贴图、贴图位置/关节数和动画帧 uniform。`SkeletalAnimationState._sampleCurvesBaked` 将时间量化为 `info.data[0]` 帧索引并标记 dirty；`BakedSkinningModel.updateUBOs` 在可见渲染更新中把该值写入 uniform，instancing 则写实例属性。`updateTransform` 用对应帧预烘焙包围盒更新世界包围盒。
4. Socket 是单独的 CPU 路径：状态为每个 Socket 预备各帧变换，帧索引变化时对 Socket 目标调用 `setRTS`。因此排查挂载物不跟随时，应同时看 `useBakedAnimation`、Socket 路径和目标，而不能只检查骨骼子节点的变换。

`JointTexturePool.releaseHandle` 先递减贴图引用；只有引用为零且资产已标记待删才真正释放分配。剪辑或 Skeleton 资产释放会标记并从缓存映射移除旧 handle。此处是贴图池内部生命周期，不能直接等同于资源系统的 `Asset.decRef`，真实场景切换后的释放点仍需单独打点。

`AudioSource._syncPlayer` 异步加载平台播放器时，将加载前的 `play/pause/stop/seek` 操作存入 `_operationsBeforeLoading`；播放器就绪后 `_syncStates` 同步循环、音量并依序重放操作。更换 Clip 时旧请求的结果会被销毁，避免迟到的播放器替换当前 Clip。队列的实际回调时序及音频解锁限制仍需 Web/Native 打点。

## 音频入口、异步加载与平台释放

[3.8 官方 AudioSource 页](https://docs.cocos.com/creator/3.8/manual/zh/audio-system/audiosource.html)说明 3.x 移除了 2.x 的公开 `audioEngine` API，场景音频用 `AudioSource`，短音效可用 `AudioSource.playOneShot`；一次性音效不能通过该组件再暂停、停止或监听结束。组件普通播放可以监听节点上的 `AudioSource.EventType.STARTED/ENDED`；Web 首播受用户交互策略限制。

`AudioSource.play` 在播放器未加载时排队；就绪后注册结束/中断监听并调用平台播放器。其 `STARTED` 事件位于 `player.play()` Promise 成功分支，播放失败则从 `audioManager` 移除；`ENDED` 从播放器结束回调发出。`playOneShot` 另加载一次性播放器，并把它加入音频管理器，结束时移除；不能把它的内部 `onEnd` 当成公开的 `AudioSource.ENDED`。这些 Promise/事件的实际时序仍需 Web 与原生独立验证。

`cocos/audio/audio-manager.ts::discardOnePlayingIfNeeded` 在普通播放器与一次性音效的**合计**记录数达到 `AudioPlayer.maxAudioChannel` 时，先从一次性音效中按 `playTime` 停掉最早者；没有一次性音效时才停最早的普通播放器。`AudioSource.play` 与 `playOneShot` 都在启动前调用它。这是 3.8 的管理器策略，不是按剪辑 URL 分组；单次 `playOneShot` 加载成功后的播放器由管理器记录，组件的 `stop/onDestroy` 只控制其普通播放器。`AudioSource.maxAudioChannel` 公开读取后端值：本地 Web 后端为 24，小游戏后端为 10，原生后端查询 `jsb.AudioEngine.getMaxAudioInstance()`，所以不能把 24 写成跨平台固定值。公开的一次性音效控制限制见[3.8 AudioSource 手册](https://docs.cocos.com/creator/3.8/manual/zh/audio-system/audiosource.html)，淘汰顺序和各后端数值是源码结论，实际可听中断仍需打点。

`playOneShot` 的异步 `loadOneShotAudio(...).then(...)` 分支不检查组件是否已销毁或 clip 是否已改变，而普通 `_syncPlayer` 会检查旧 clip 并销毁迟到播放器。下文受控延迟 WebAudio 请求的轨迹已验证节点销毁后的迟到启动；Native、DOM Audio 和不同加载失败条件仍需分别验证。

3.8 示例也已加入独立的 `assets/resources/stage8-tone-a.wav` 与 `stage8-tone-b.wav`，参数同上；Creator 已生成 `audio-clip` `.meta`，且记录 `imported=true`。[3.8 音频探针](../agent-foundation/probes/stage8-audio-3.8.js)从正式 `cc` 模块加载两个 `AudioClip`，准备 24 个临时普通 `AudioSource` 与一个一次性音效组件；按钮点击后先测满额普通播放再加 one-shot，再测 23 个普通播放加 one-shot 后补第 24 个普通播放。它记录普通组件状态与事件；one-shot 无公开状态句柄，下面另以 WebAudio 后端打点确认淘汰。其 `System.import('cc')`、运行时加载与并发已有 Web 局部轨迹；真实可听结果仍未测。格式入口见[3.8 音频资源手册](https://docs.cocos.com/creator/3.8/manual/zh/asset/audio.html)。

跨场景要区分三个对象：旧场景销毁会让普通 `AudioSource.onDestroy` 执行 `stop(); clip=null`，从而重置组件的播放器；`AudioClip.destroy` 销毁的是剪辑自己持有的 `_player`；已启动的 `playOneShot` 只在 `AudioManager` 和平台一次性播放器中登记，组件销毁路径没有它的句柄。源码因此给出“一次性音效可能越过发起它的节点或场景寿命”的条件性预测，但仍受通道淘汰、平台行为及 Clip 自动释放影响，必须实测。官网[资源释放手册](https://docs.cocos.com/creator/3.8/manual/zh/asset/release-manager.html)要求按引用关系判断 Clip 是否释放。游戏暂停则是另一条链：`game.pause()` 发 `Game.EVENT_PAUSE`，Web/原生普通平台播放器各自注册中断回调；Web/原生 `OneShotAudio` 类没有这组监听。`AudioManager.pause()` 的源码会停止 one-shot，但在本地引擎中未找到由 `game.pause()` 调用它的路径。不要据此断言后台仍可听，浏览器或操作系统也可能自行暂停音频。

`pal/audio/web/player.ts::AudioPlayer.load` 按导入资源的加载模式及 `AudioContextAgent.support` 选择 DOM Audio 或 Web Audio。`AudioClip.destroy` 会销毁其内部播放器；`AudioSource` 自己也管理一个播放器，两者不要混同。原生 `pal/audio/native/player.ts::AudioPlayer.destroy` 取消游戏暂停/恢复监听、减少该 URL 的播放器计数，在计数降至零时调用原生 `audioEngine.uncache(url)`。这是后端缓存释放路径的源码证据，不代表调用 `AudioSource.stop` 就立即触发 `uncache`；真实释放点仍需打点。原生 `loadNative` 的 Windows 分支在预加载回调前先 resolve URL，其余分支等待 `audioEngine.preload` 回调判定成败；这也需要按平台区分。

3D `ParticleSystem.stopEmitting` 只关闭发射并标记下次播放需重启；`update` 仍推进已有粒子，数量归零后调用 `stop`。直接 `stop` 会调用 `clear` 并把播放、暂停、发射标志归零。`beforeRender` 经 `DirectorEvent.BEFORE_COMMIT` 接入渲染提交。这些源码分支应以粒子数和可见效果分别验证。

[3.8 主模块手册](https://docs.cocos.com/creator/3.8/manual/zh/particle-system/main-module.html)把 `RenderCulling` 与 `DataCulling` 分开，并定义 `Pause`、`Pause and Catchup`、`Always Simulate` 三种剔除模式。源码 `cocos/particle/particle-system.ts::_emit` 在非循环系统超过 `duration + startDelay` 时关闭发射；`update` 等粒子排空才 `stop()`。`stopEmitting()` 只置 `_isEmitting=false`、`_needToRestart=true`，不清空现存粒子；下一次 `play()` 会先 `reset()` 计时、发射计数和 Burst 状态，再重新发射，`reset()` 本身也不清旧粒子。手动 `stop()` 则调用 `clear()` 并置 `isEmitting=false`；其中 `clear()` 实际清空处理器粒子仍要求组件 `enabledInHierarchy`。3D 组件没有 2D 的 `autoRemoveOnFinish` 属性，自动停止不等于销毁节点。

排空的墙钟时长还取决于剔除：未开启 `renderCulling` 时正常推进；开启后，发射器在相机可见范围外且模式为 `Pause` 时，`update` 提前返回，时间、粒子寿命与“归零后 stop”均不推进；`PauseAndCatchup` 在早退前只增加 `_time`，旧粒子不逐帧模拟；`AlwaysSimulate` 继续模拟但将模型从场景渲染链摘下。可见后恢复的效果应依官网模式定义并以实际粒子数/画面验证。`beforeRender` 还会按粒子数挂接或移除模型，`_isPlaying=false` 时不更新渲染数据。以上为本地 3.8.7 源码路径，CPU/GPU 渲染器与实际帧顺序尚未测量。

[3.8 3D 粒子状态探针](../agent-foundation/probes/stage8-particle3d-3.8.js)在现有预览中临时创建组件，以直接 `update(0.05)` 分别记录非循环自然结束、手动 `stop` 和 `stopEmitting` 后排空。[自然帧探针](../agent-foundation/probes/stage8-particle3d-natural-3.8.js)另由 Director 调度组件 `update` 和 `BEFORE_COMMIT` 渲染更新，并同步截取画面。两者均关闭 RenderCulling；三种剔除模式另测。

## 3.8 的 2D 粒子是独立链

[3.8 官方 2D 粒子组件页](https://docs.cocos.com/creator/3.8/manual/zh/particle-system/2d-particle/2d-particle.html)明确称其为 `ParticleSystem2D`，可以加载 plist 与图片，`PlayOnLoad` 控制自动发射，`AutoRemoveOnFinish` 控制播放结束后销毁节点。本地 `particle-system-2d.ts::lateUpdate` 调用 `Simulator.step(dt)`；模拟器在 `active` 时发射粒子，即使关闭发射仍继续更新已有粒子，清空后进入 `_finishedSimulation`。`stopSystem` 只设 `_stopped` 并调用 simulator.stop；`resetSystem` 重启模拟并标记渲染数据更新。`_render` 通过 UI Batcher 的 `commitComp` 提交粒子网格，和 3D 的 `BEFORE_COMMIT` 路径不同。

因此 3.8 同时存在两种“停止”语义：2D `ParticleSystem2D.stopSystem` 对应停发射、模拟器等待旧粒子消亡；3D `ParticleSystem.stopEmitting` 有相近目的，`ParticleSystem.stop` 则会清空。**2D 可见性另有疑点**：`ParticleSystem2D._canRender` 要求 `!_stopped`，而 `stopSystem` 立即设 `_stopped=true`；`UIRenderer.updateRenderer` 用 `_canRender` 设置渲染开关。这提示停发射后旧粒子虽继续模拟，却可能不再绘制。官网/API 对 `stopSystem` 的“旧粒子继续运行”不能直接解释为“旧粒子仍可见”；本次内存贴图 Web 预览已同时记录粒子数、`_renderFlag` 与同步画面，结果见下段；主动使渲染器变脏的分支仍待测。API 名相似并不足以判断组件类型，须先查节点上挂的是哪一类。

沿渲染器脏列表继续追踪后，这个疑点更精确：`stopSystem` **本身不调用** `_markForUpdateRenderData`，所以先前的 `_renderFlag` 可能暂时保持 true；`Simulator.step` 仍更新现存粒子的 `renderData`，粒子耗尽后 `_finishedSimulation` 才重置、停发射并标记渲染器为脏。`UIRendererManager.updateAllDirtyRenderers` 只处理脏列表，届时 `UIRenderer.updateRenderer` 才重新调用 `_canRender` 并写 `_renderFlag`。若停发射期间发生其他渲染数据变更，`_stopped` 可能让旧粒子提前不可见；若没有，旧粒子可能维持绘制直到自然结束。第一条“未主动变脏时仍可见”已由下段的同步截图与 `_renderFlag` 轨迹确认；主动脏更新后是否提前隐藏仍待单测。

`autoRemoveOnFinish` 的对象也是**整个节点**。`Simulator.stop` 将 `active/readyToPlay` 置 false；`step` 在粒子数归零且二者都为 false 时设 `finished` 并调用 `_finishedSimulation`。组件执行 `resetSystem → stopSystem → _markForUpdateRenderData`，再在开关开启时调用 `node.destroy()`。因此无粒子时手动停止也可能触发节点销毁；`duration=-1` 的持续发射要先停发射。3.8 还有一条实现边界：`particle-simulator-2d.ts::step` 若 `renderData` 为 null，会在粒子清空与完结判断前直接返回；遇到“已停发射却不自动移除”，须同时检查 `_flushAssembler/createData` 是否建立了渲染数据。此为条件性源码路径，不能未经运行验证就归因于资源缺失。[3.8 2D 粒子手册](https://docs.cocos.com/creator/3.8/manual/zh/particle-system/2d-particle/2d-particle.html)定义自动移除为销毁节点；[生命周期手册](https://docs.cocos.com/creator/3.8/manual/zh/scripting/life-cycle-callbacks.html)说明销毁回调在帧末回收，本次内存贴图 Web 预览的回调与节点有效性时序见下段；原生和导入资源仍需打点。

[3.8 临时 2D 粒子探针](../agent-foundation/probes/stage8-particle2d-3.8.js)在独立无头 Chrome 打开的 Creator 预览中，于示例 3D 场景的内存里创建 UI Canvas、相机、白色不透明 SpriteFrame 和四组“零粒子/发射中 × 自动移除开/关”粒子，不保存场景改动。[自然帧轨迹](../agent-foundation/traces/3.8.7-stage8-particle2d-headless-web.jsonl)中四组 `renderData` 均已建立；发射中两组在停前及停后约 100 ms 各有 2 粒。停发射立刻让 `_canRender()=false`，但此时及 100 ms 后的 `_renderFlag` 仍为 true；[停前](../agent-foundation/traces/3.8.7-stage8-particle2d-headless-web-before-stop.png)与[停后同步截图](../agent-foundation/traces/3.8.7-stage8-particle2d-headless-web-after-100ms.png)均能看到白色粒子。这证实本条件下渲染标志未立即重算，不能把 `_canRender` 的返回值单独当成当帧画面。粒子归零或零粒子停止后，自动移除开关为 true 的节点调用 `destroy()`；同帧默认 `isValid=true`、严格 `isValid(node,true)=false`，随后 `onDestroy`。开关为 false 的两组在后续帧反复进入 `_finishedSimulation`，因为内部重置使 `finished` 再次变 false。主动触发 UIRenderer 脏更新时的旧粒子可见性、未建 `renderData` 分支、导入贴图与原生仍未运行验证；相邻源码构建是否启用也未确认。

## 3.8 专属：Marionette 与程序式姿态

[官网程序式动画章节](https://docs.cocos.com/creator/3.8/manual/zh/animation/marionette/procedural-animation/index.html)将**程序式动画功能**标为实验性、默认关闭，核心是姿态图；这不表示整个 Marionette 动画控制器都默认关闭。本地 `cocos/animation/marionette/animation-controller.ts::AnimationController.__preload` 从动画图/变体建立 `AnimationGraphEval`，组件 `update(deltaTime)` 调用图实例更新。`graph-eval.ts::update` 先更新根姿态节点、求出最终 Pose，再经 `PoseLayoutMaintainer.apply` 写回。姿态图节点基类与 IK、混合、复制变换等具体节点位于 `pose-graph/`。这条路径属于**组件 update 阶段**，与前述 AnimationManager 系统更新位置不同；同一骨骼或节点再被普通 Clip 驱动时，最终值必须单独测。示例当前未配置动画图，不能把源文件存在解释为程序式动画已启用。

## 可用示例与待验证

### 普通属性剪辑：官网用法与源码准备

[3.8 程序化编辑剪辑](https://docs.cocos.com/creator/3.8/manual/zh/animation/use-animation-curve.html)给出 `AnimationClip`、`animation.VectorTrack`、`TrackPath` 和通道曲线的正式入口；[添加动画事件](https://docs.cocos.com/creator/3.8/manual/zh/animation/animation-event.html)说明时间轴事件会寻找动画根节点组件上的同名方法。本地 `animation-component.ts::clips` setter 会为新剪辑创建状态并以当前节点初始化；`AnimationManager.update` 先推进 CrossFade/状态，再 `blendStateBuffer.apply()`，最后派发延迟事件。与 2.4 `curveData.props` 的直接采样路径不同，3.8 同属性竞争要把混合缓冲应用点单独观察。

已准备[3.8 普通剪辑与同属性缓动探针](../agent-foundation/probes/stage8-clip-tween-3.8.js)：页面内临时 Node 上让 VectorTrack 驱动 `position.x: 0→100`，先单播，再与目标位置 `x=200` 的 Tween 同播，固定步进采集两个系统前后读数、组件播放事件和 0.1 秒时间轴函数事件。源码 `EventEvaluator.sample` 首次采样可直接触发当前帧事件，后续跨越的事件帧进入管理器延迟队列；本次只跨越一个 0.1 秒事件键，不能据此判定两条路径的完整差别。Web 预览的 legacy `cc.animation.VectorTrack` 不可用，探针经 SystemJS 的 `cc` 模块取得正式导出，已在当前 Web 预览以手动 `Director.tick(0.05)` 每相位 8 步运行。[逐步轨迹](../agent-foundation/traces/3.8.7-stage8-clip-tween-headless-web.jsonl)显示单播剪辑 `position.x=0→100`；同属性同播时第 1 个非零步 AnimationManager 写至 20，随后 TweenSystem 写至 40，最终样本为 200。两相位均在第 2 步收到时间轴函数事件，当时位置为 40；第 5 步剪辑 `stop/finished` 状态事件读 100，而该步完成后 Tween 写到 200。结论限于本次固定时钟和临时剪辑。

Web 预览的[士兵快照](../agent-foundation/traces/3.8.7-stage8-skeletal-web.jsonl)记录自然帧从 4019 到 4733，`Take 001` 状态保持播放、baked 帧索引从 22 到 28；四个关联渲染器（士兵、盾牌、剑及另一盾牌）均为 `BakedSkinningModel`，已上传该剪辑。快照与画面可证实组件播放状态、帧推进和渲染器接线，尚未测 Socket、骨骼节点变换、循环/结束事件或 GPU 实际采样。该 Web 预览的 legacy `cc` 全局导出名是 `SkeletalAnimationComponent`，所以 DevTools 快照探针兼容这一名称；脚本层的正式公开入口仍以手册和 `cc` 模块为准。

[Web 缓动轨迹](../agent-foundation/traces/3.8.7-stage8-tween-web.jsonl)在页面可见、游戏未暂停时启动，临时暂停自然循环并手动调用 `Director.tick(0.05)` 20 次。前两步 `AnimationManager` 总先于 `TweenSystem`；第一次步进只建立起点，第二次后普通对象与 Node 都为 20。第 1 步后暂停 Node Tween，第 2、3 步节点保持 20；第 3 步后恢复节点并停止另一对象 Tween，后者停在约 30。对象和节点完成回调分别在第 5、7 步触发，最终都为 100。这证明单条 Tween 在本次固定 `dt` 条件下的暂停/恢复和停止行为；`by`、销毁与自然 RAF 仍待测；同属性动画竞争另有上段独立轨迹。

示例新增的独立音频 WAV 已有 Creator 生成的 `.meta`、Web 并发及生命周期轨迹；3D 粒子已用临时组件取得状态轨迹，2D 粒子资源仍未准备。普通 Node 属性剪辑的固定时钟状态与事件已由上段记录；下一步补自然帧、更多事件键与不同混合权重，避免以 baked 士兵代表普通 Animation；音频原生与慢加载分支需另测。所有实验都应记录 Creator 3.8.7、平台、参数、状态和轨迹。

本篇仍是阶段 8 进行中的索引；普通剪辑的自然帧与多事件键、音频原生/后台中断及慢加载的其他后端、3D 粒子的剔除/GPU/导入资产分支尚未验证。音频 Web 跨场景与 Clip 释放、one-shot 延迟加载竞态、2D 内存贴图及 3D 临时 CPU 粒子的自然帧画面已有局部证据。

### 2026-10-05 Web 补测

[音频轨迹](../agent-foundation/traces/3.8.7-stage8-audio-web.jsonl)来自 Creator 3.8.7 示例预览、页面可见且游戏未暂停时的用户点击。A/B `AudioClip` 已由 `resources.load` 返回，普通 `AudioSource` 预载后并发播放。后端报告上限 24；先启动 24 个普通播放器再插入 one-shot，0 号普通播放器从 `[state=1,playing=true]` 变为 `[3,false]`，其余 23 个保持播放。另一轮启动 23 个普通播放器与一个 one-shot，再启动第 24 个普通播放器，24 个普通组件在采样时均为 `[1,true]`。这与源码“优先淘汰 one-shot”相符，但 one-shot 没有公开状态句柄，**本轨迹没有直接证明它被淘汰或是否可听**；需平台播放器层打点。

[3D 粒子手动步进轨迹](../agent-foundation/traces/3.8.7-stage8-particle3d-web.jsonl)用临时 `ParticleSystem`、CPU 模式、关闭 RenderCulling，按 0.05 秒直接调用 `update`。非循环时先停止发射，再从 6 个活动粒子排空至 0 后自动停止；发射中手动 `stop` 立即使活动数为 0 并清 `isEmitting`。`stopEmitting` 保留已有粒子直到排空，`_needToRestart=true`；停发射后第 7 个直接步进归零。预览生成脚本已还原至 SHA-256 `0e020cdb942e96e3269303eafc34a77dbe10aec3fba3e27d6da64a92bbc84d41`。

[自然 Director 帧轨迹](../agent-foundation/traces/3.8.7-stage8-particle3d-natural-headless-web.jsonl)在临时 CPU/default 粒子、`renderCulling=false` 下记录了组件 `update` 和 `AFTER_DRAW`：活动粒子出现并挂接渲染模型，非循环时停发射后排空；排空的 `afterUpdate` 尚见模型挂接，同帧 `AFTER_DRAW` 已脱离场景。同步[活动期截图](../agent-foundation/traces/3.8.7-stage8-particle3d-natural-headless-web-active.png)可见紫红色粒子，[排空后截图](../agent-foundation/traces/3.8.7-stage8-particle3d-natural-headless-web-drained.png)已无该粒子。截图期间暂停导致下一帧 `dt` 增大，本次只能确认状态先后与前后画面，不能把帧数当成稳定时长。引擎来源、导入粒子资产、GPU、RenderCulling 与原生仍需独立验证。

### 2026-10-06 Web 音频生命周期

[组件自然结束/停用/销毁轨迹](../agent-foundation/traces/3.8.7-stage8-audio-lifecycle-headless-web.jsonl)使用临时 `AudioSource` 与 3 秒 WebAudio Clip。`play()` 后节点收到 `STARTED`；约 3 秒后收到 `ENDED`，**该回调内读取的 `state` 仍为 PLAYING**，稍后采样才为 INIT，不能把 `ENDED` 回调时读到的状态当成最终状态。节点反激活执行 `onDisable → pause`，状态为 PAUSED，重新激活且 `playOnAwake=false` 时仍暂停。播放中 `destroy()` 同样先经 `onDisable` 暂停，帧末 `onDestroy → stop; clip=null`，之后内部播放器引用清空。没有组件 `ENDED` 事件被当作手动 stop 的替代证据。

两次独立磁盘场景切换把旧 Scene 的 `autoReleaseAssets` 在运行时分别设为 [false](../agent-foundation/traces/3.8.7-stage8-audio-scene-keep-headless-web.jsonl) 与 [true](../agent-foundation/traces/3.8.7-stage8-audio-scene-release-headless-web.jsonl)。`main → stage4-empty` 时临时组件先暂停后销毁；`resources.load` 动态得到的 Clip 初始 `refCount=0`，两组切换回调及 400 ms 后都仍缓存且有效。随后显式 `assetManager.releaseAsset(clip)` 才移出缓存，`AudioClip.destroy` 回调出现；400 ms 采样时 Clip 已失效。它不是源场景序列化的静态依赖，不能据此推断静态音频会随 `autoReleaseAssets` 以相同方式保留。

[one-shot 后端轨迹](../agent-foundation/traces/3.8.7-stage8-audio-oneshot-backend-headless-web.jsonl)另在 WebAudio 的 `AudioBufferSourceNode` 层临时记录 `start/stop/ended`。一次性音效开始后切换磁盘场景，源节点已失效，再显式释放 Clip：该底层 source 没有收到 `stop` 调用，约 3 秒处收到自然 `ended`。这验证本次 WebAudio one-shot 的**底层播放节点**可越过组件、场景和 Clip 对象生命周期；不等于已经听到声音，也不证明 DOM Audio、原生或慢加载期间销毁组件时的行为。[3.8 手册](https://docs.cocos.com/creator/3.8/manual/zh/audio-system/audiosource.html)规定 `playOneShot` 不能由组件暂停/停止或监听完成，本次底层打点只用于诊断。

### 2026-10-06 WebAudio one-shot 淘汰与迟到播放

[通道淘汰探针](../agent-foundation/probes/stage8-audio-oneshot-eviction-3.8.js)在独立无头预览中启动 23 个普通播放器和 1 个 one-shot。对应[后端轨迹](../agent-foundation/traces/3.8.7-stage8-audio-oneshot-eviction-headless-web.jsonl)先有 24 次 `AudioBufferSourceNode.start`、没有 `stop`；补第 24 个普通播放器时，one-shot 对应 source 24 先收到 `stop()`，普通 source 25 随后 `start()`，100 ms 后 24 个普通组件均为播放中。后面的普通 source 停止是探针清理。结合源码 `AudioManager.discardOnePlayingIfNeeded`，本次 WebAudio 满额时确实优先淘汰 one-shot；不是公开 one-shot 状态事件，也不证明真实听感或其他平台。

[慢加载探针](../agent-foundation/probes/stage8-audio-oneshot-slow-load-3.8.js)给 Clip 的 URL 临时加查询参数以避开音频缓冲缓存，只延迟该次 one-shot XHR 的 `send()`；源节点销毁后再放行。一次复跑中无头 RAF 未推进，探针使用内部 `_destroyImmediate()` 排空**该临时节点**的延迟销毁，确保请求放行前节点严格失效。对应[轨迹](../agent-foundation/traces/3.8.7-stage8-audio-oneshot-slow-load-headless-web.jsonl)记录 `xhr:send-delayed → after-source-destroy(sourceNodeValid=false) → xhr:send-released → backend:start(sourceNodeValid=false)`，之后短时内未见该 source 的 `stop`。这是本次 WebAudio 成功加载路径的迟到启动证据；不表示默认自动播放可用，也不覆盖请求失败、DOM Audio 或 Native。

### 2026-10-06 静态场景音频依赖

[3.8 资源释放手册](https://docs.cocos.com/creator/3.8/manual/zh/asset/release-manager.html)规定场景的“自动释放资源”作用于该场景的依赖，并说明动态引用需自行管理。`stage8-audio-static.scene` 中的 `AudioSource._clip` 序列化为 `stage8-tone-a.wav` 的 UUID；这与前述 `resources.load` 动态 Clip 构成不同实验。`release-manager.ts::_autoRelease` 在切换场景时遍历旧 Scene 的依赖，对每项调用 `decRef(oldScene.autoReleaseAssets)`，再移除旧 Scene 的依赖记录。

[静态场景探针](../agent-foundation/probes/stage8-audio-static-scene-3.8.js)的两次独立[无头 Web 轨迹](../agent-foundation/traces/3.8.7-stage8-audio-static-scene-headless-web.jsonl)均确认 Clip 位于旧 Scene 的依赖表，加载后 `refCount=1`，切换前普通 `AudioSource` 处于播放中。切换到磁盘 `stage4-empty` 的回调中，源组件已失效且不播放，Clip 引用数降为 0。`autoReleaseAssets=false` 时，400 ms 后 Clip 仍有效且在缓存中；`true` 时，切换后下一帧进入 `AudioClip.destroy`，Clip 失效并移出缓存。这是本次编辑器 Web 预览的状态/对象生命周期证据，不证明真实声音中断、默认手势策略、其他平台或相邻源码构建来源。

上述无头 Web 实验为隔离生命周期而用 Chrome 参数放宽首次用户手势要求；默认浏览器自动播放限制和真实听感未测。编辑器预览的引擎来源未确认；页面隐藏/恢复、真实平台中断和原生需分别记录。
