# 阶段 8 skill 验证状态

候选：[2.4 动画与缓动追踪](cocos2-animation-tween-trace/SKILL.md) · [3.8 动画与缓动追踪](cocos3-animation-tween-trace/SKILL.md) · [2.4 音频生命周期追踪](cocos2-audio-lifecycle-trace/SKILL.md) · [3.8 音频生命周期追踪](cocos3-audio-lifecycle-trace/SKILL.md) · [2.4 2D 粒子追踪](cocos2-particle2d-trace/SKILL.md) · [2.4 3D 粒子追踪](cocos2-particle3d-trace/SKILL.md) · [3.8 粒子追踪](cocos3-particle-trace/SKILL.md)。它们仅针对各自版本，官网公开入口与本地源码符号已核对；动画/缓动、音频并发、两版 3D 粒子的自然帧状态及 2D 粒子的自然帧/同步截图已有各自 Web 局部运行证据。3.8 临时 3D 粒子另有可见画面；2.4 的活动粒子在当前截图中未显现。其他生命周期与平台分支仍是源码级候选。

2.4 的第一轮预览探针已运行，但[环境轨迹](../traces/2.4.15-stage8-preview-state.jsonl)显示 DevTools 页面隐藏且 `cc.game.isPaused()=true`，墙钟定时期间帧数没有前进，得到的缓动值全为 0，**不是缓动行为证据**。后来页面可见且游戏未暂停，DevTools 控制台恢复输入，[2.4 固定时钟轨迹](../traces/2.4.15-stage8-tween-web.jsonl)已取得。旧无效结果仅保留为环境诊断，不能和新轨迹混合。

可重复执行的页面内存脚本：[2.4 固定时钟探针](../probes/stage8-tween-2.4.js)与[3.8 固定时钟探针](../probes/stage8-tween-3.8.js)。它们分别手动推进 Scheduler 和 Director、记录管理器前后值及可完整读取的精简样本、完成、停止与暂停/恢复，最后还原被包装的方法和临时节点。2.4 通过 Node 的全部动作暂停接口，3.8 通过 Tween 实例接口；范围不同，不能将相同读数误作同一 API。两版已在 Web 预览执行等价控制台探针，得到[2.4](../traces/2.4.15-stage8-tween-web.jsonl)与[3.8](../traces/3.8.7-stage8-tween-web.jsonl)轨迹；仓库脚本增加精简输出后的最终文本通过 `node --check`，尚未逐字重跑。固定时钟结果不等于浏览器自然 RAF 的帧率表现。

这些是各自 Creator 编辑器启动的 Web 预览观测；本轮未重新确认示例是否配置为使用相邻目录的自定义引擎，因此不能据此声称相邻引擎源码构建产物已在预览中运行。源码路径结论和预览行为证据应分别保留。

[3.8 现有骨骼组件快照](../probes/stage8-skeletal-3.8.js)只读取场景中的 `SkeletalAnimation`、默认剪辑、播放状态与 baked 帧索引。Web 预览 legacy `cc` 导出类名实际为 `SkeletalAnimationComponent`，探针已加入兼容别名并通过语法检查。等价只读代码的[两次士兵快照](../traces/3.8.7-stage8-skeletal-web.jsonl)显示自然帧推进、状态播放和四个 `BakedSkinningModel` 关联；仓库脚本的最终文本尚未逐字重跑。它不能替代普通 Animation 属性剪辑和事件时序实验。

## 已确认的源码事实

- 2.4 `Tween.start` 通过 Director 的 ActionManager 调度；AnimationManager 和 ActionManager 由 Scheduler 更新。`CCAnimation.play` 停其他状态，`playAdditive` 保留其他状态。
- 3.8 `Tween.start` 通过 TweenSystem 的 ActionManager 调度；AnimationManager 的系统优先级 200，TweenSystem 为 100。`AnimationComponent.play` 走零时长 `crossFade`。
- 两版普通动画状态事件都使用各自管理器的延迟派发队列。2.4 的 `SkeletonAnimationClip` 可按 Model 的 `precomputeJointMatrix` 走预计算矩阵曲线，采样写节点 `_jointMatrix`，渲染器在提交前组装当前关节矩阵并以 uniform 或本组件贴图上传；3.8 的 `SkeletalAnimation` 可按 `useBakedAnimation` 走预烘焙帧索引 → 共享骨骼贴图/逐帧包围盒 → `BakedSkinningModel` 的路径，Socket 目标另由 CPU 逐帧更新。两种“贴图”用途不同，3.8 贴图池内部引用计数与 Asset 引用计数也不能混同。3.8 示例 `main.scene → soldier.prefab → Take 001.animation` 的源文件接线和 Web 预览播放状态/帧索引已核实；事件回调的精确先后尚需打点。
- 音频源码链已写入两版独立研究笔记：2.4 公开 `AudioSource` 与 `cc.audioEngine` 两条入口，3.8 公开 `AudioSource` 和独立的 `playOneShot`；两版都处理旧 clip 迟到加载。2.4 停用组件调用 `stop`，3.8 普通节点停用调用 `pause`。这些组件事件与动态 Clip 缓存释放已有下述 WebAudio 局部验证；真实可听输出、原生与后台中断仍缺。
- 音频并发源码链进一步定位：2.4 `cc.audioEngine` 按 `nativeUrl` 维护最多 24 个 ID，满时停止该 URL 最早者，组件音频不经此表；3.8 `AudioManager` 将普通与 one-shot 播放器合计，满时先淘汰最早 one-shot，否则淘汰最早普通播放器，限额取平台后端（Web 24、小游戏 10、原生动态查询）。Web 预览已对两版并发策略取得局部轨迹；真实声音/后端 one-shot 淘汰、Native 与释放仍未验证。3.8 `playOneShot` 的异步完成分支没有组件销毁/clip 替换检查，慢加载期间销毁后是否仍发声须单独实验。
- 两套示例各新增两段 3 秒、22.05 kHz、16 位单声道低振幅 WAV（`assets/resources/stage8-tone-a/b.wav`），对应[2.4 Web 探针](../probes/stage8-audio-2.4.js)和[3.8 Web 探针](../probes/stage8-audio-3.8.js)。WAV 已用 Python 标准库读取核对，探针通过 `node --check`；对应 Creator 已生成 `audio-clip` `.meta`，3.8 还标记 `imported=true`。两版现均已取得运行时加载和并发播放的 Web 轨迹；3.8 探针的一次性音效无公开状态句柄，需要可听或后端证据。不要把导入记为行为验证。
- 场景与暂停接线补查：2.4 `AudioClip.destroy` 会 `audioEngine.uncache` 并停止该 Clip 的全局 ID；本次显式 `releaseAsset` 已运行验证。组件本身在禁用/销毁时停播。3.8 组件销毁只重置普通播放器，one-shot 独立登记；`AudioClip.destroy` 另销毁 Clip 自己的播放器，本次 WebAudio one-shot 底层自然结束也已观测。两版动态 Clip 在 `autoReleaseAssets=false/true` 的真实场景切换后都保持缓存；不能推广到静态场景音频依赖。3.8 普通 Web/Native 平台播放器监听 `Game.EVENT_PAUSE/RESUME`，one-shot 类没有这组监听；本地未见 `game.pause` 调 `AudioManager.pause`。后台切换和可听结果未实测。
- 2D 粒子在两版都由组件 `lateUpdate` 推进 Simulator，`stopSystem` 停发射后旧粒子继续存活。2.4 的 3D 类型是 `ParticleSystem3D`，`stop` 清空；3.8 的 3D `ParticleSystem` 另有 `stopEmitting` 和立即清空的 `stop`。3.8 2D `_canRender` 以 `_stopped` 为门槛；本次自然帧下 `stopSystem` 后仍保留 `_renderFlag` 与可见旧粒子，主动脏更新分支未测。3D 粒子自然帧状态与 2D 粒子的自然帧/自动销毁均有下述 Web 轨迹。
- 3D 粒子状态细查：两版非循环系统在 `duration + startDelay` 后停止发射、待旧粒子排空才自动 `stop`；手动 `stop` 都清空。2.4.15 的 `stop` 未清 `_isEmitting`，故发射中手动停止后 `isStopped` 与 `isEmitting` 可能同真；3.8 的 `stop` 会清该标志，`stopEmitting` 单独停发射。前半段已有两版自然帧 Web 轨迹；手动停止已有直接步进轨迹。3.8 RenderCulling 三模式仍是源码/官网结论，离屏运行需另测。两版 3D 类均无 2D `autoRemoveOnFinish`。
- 2D 自动移除源码条件已补：两版模拟器在停发射且粒子数归零后才走 `_finishedSimulation`，`autoRemoveOnFinish` 调 `node.destroy()`，会销毁整节点且实际回收延后。无粒子停止分支可在下一次有效步进触发。3.8 的 `Simulator.step` 在 `renderData=null` 时早退于完结检查，需在运行时检查数据创建链；不能把此条件写成正常情况下必然卡住。零粒子与排空后的自动移除已在两版无头 Web 预览验证；3.8 无 `renderData` 早退仍未运行验证。

2D 渲染补查：2.4 `stopSystem` 不清 `RenderFlow.FLAG_RENDER`，自然结束的 `_finishedSimulation` 才关；3.8 `stopSystem` 不主动将 UIRenderer 放入脏列表，`_canRender` 的 `!_stopped` 约束要到 `updateRenderer` 重算时才影响 `_renderFlag`。因此 3.8 旧粒子可能继续绘制一段，也可能因其他脏更新提前隐藏。实验应在停发射后分别记录粒子数、渲染标志和实际画面，并对照一次主动脏更新。停发射后未主动标脏的分支已有两版自然帧与同步截图：旧粒子仍可见，3.8 的 `_canRender=false` 与 `_renderFlag=true` 并存。主动脏更新分支仍是源码推论。

## 下一轮最小实验

1. 两版缓动下一步补 `by`、目标销毁、同 target 多 Tween 的暂停范围，以及自然 RAF 对照；保留 JSONL 原始轨迹。
2. 两版[2.4 普通剪辑/缓动探针](../probes/stage8-clip-tween-2.4.js)与[3.8 普通剪辑/缓动探针](../probes/stage8-clip-tween-3.8.js)已在当前 Web 预览以固定 0.05 秒步长分别运行；[2.4 轨迹](../traces/2.4.15-stage8-clip-tween-headless-web.jsonl)的同属性结果由后执行的剪辑覆盖到 100，[3.8 轨迹](../traces/3.8.7-stage8-clip-tween-headless-web.jsonl)由后执行的 Tween 覆盖到 200。两版 0.1 秒函数事件均在第 2 步触发，剪辑 `stop/finished` 均在第 5 步出现。下一步补自然帧、多个时间轴事件与不同混合权重；3.8 士兵 baked 路径的 Socket/骨骼节点边界仍需验证。不要以 baked 士兵代表普通 Animation 的属性采样。

3.8 预览此前的[入口检查](../traces/3.8.7-stage8-clip-api-web.jsonl)显示 legacy `cc.animation.VectorTrack` 不存在，且当时页面隐藏、游戏暂停。探针随后从预览 SystemJS 的 `cc` 模块取得正式导出，完整固定时钟步进已有上述 Web 轨迹；早期 legacy 全局缺失的入口检查不能代表正式模块 API 缺失。
3. 两版短音频的 Web 加载、并发、组件停用/启用、自然完成、动态 Clip 跨场景与显式释放已记录；3.8 one-shot WebAudio 底层跨场景存续也已记录。下一轮先测静态场景音频依赖、3.8 one-shot 达限淘汰和慢加载期间销毁组件，再按相同分面测原生。不要以本次低音量、放宽手势策略的 Web 状态样本证明声音可听。
4. `stage4-empty` 磁盘场景的两版 `autoReleaseAssets=false/true` 运行分支已完成；动态 Clip 两组均保留，不代表序列化静态音频依赖。手动 `game.pause/resume` 与真实页面隐藏/恢复仍需分开；不要以浏览器后台静音代替引擎事件证据。
5. 2D 粒子的“发射中停止/零粒子停止 × 自动移除开/关”已由[2.4](../probes/stage8-particle2d-2.4.js)、[3.8](../probes/stage8-particle2d-3.8.js)临时探针在各自无头 Web 预览中验证，并同步保存停前/停后截图、`_finishedSimulation`、`destroy` 调用、`onDestroy`、默认/严格 `isValid`、渲染标志。下一步测 3.8 主动脏更新及无 `renderData` 分支、导入粒子资源和原生；不可把本次内存贴图条件外推。
6. 3D 粒子两版分别测非循环自然结束、发射中手动 `stop`；采集 `isPlaying/isStopped/isEmitting/getParticleCount`、节点有效性与画面。3.8 另测 `stopEmitting` 后排空，以及 RenderCulling 的 `Pause/PauseAndCatchup/AlwaysSimulate`；区分模拟时间与墙钟时间。2.4 尤其核验停止后 `isEmitting` 是否残留 true。

已准备[2.4 临时 3D 粒子状态探针](../probes/stage8-particle3d-2.4.js)和[3.8 临时 3D 粒子状态探针](../probes/stage8-particle3d-3.8.js)。两者在各自预览中创建临时节点和真实组件，暂停自然主循环，直接以 `update(0.05)` 测非循环自然结束与手动停止；3.8 另测 `stopEmitting`。它们本身只记录组件状态和粒子数。另有两版[2.4 自然帧探针](../probes/stage8-particle3d-natural-2.4.js)和[3.8 自然帧探针](../probes/stage8-particle3d-natural-3.8.js)，已在各自 Web 预览记录调度、状态及同步画面；3.8 RenderCulling 仍待验证。

当前机器的两套引擎目录没有可执行的本地 Jest/Gulp 依赖；2.4 示例仍缺少动画、粒子源资源。新增音频 WAV 已有 Creator 导入元数据和 Web 并发播放轨迹。因此候选 skill 可使用已记录的固定时钟缓动、普通剪辑同属性竞争和 3.8 士兵播放状态结论；不能把手动步进结果推广为自然帧或平台音频行为。阶段 8、9 的优先复测顺序见[缺口清单](../stage8-9-gap-audit.md)。

## 2026-10-05 2D 粒子自然帧与同步截图

[2.4 轨迹](../traces/2.4.15-stage8-particle2d-headless-web.jsonl)与[3.8 轨迹](../traces/3.8.7-stage8-particle2d-headless-web.jsonl)均来自对应 Creator 预览服务，使用[可复跑的无头截图入口](../probes/creator-headless-probe.mjs)、临时不透明白色贴图、四组零粒子/发射中 × 自动移除开/关。截图前暂停游戏并由浏览器完成截图后继续，以避免截图延迟跨越粒子寿命。[2.4 停前](../traces/2.4.15-stage8-particle2d-headless-web-before-stop.png)/[停后](../traces/2.4.15-stage8-particle2d-headless-web-after-100ms.png)和[3.8 停前](../traces/3.8.7-stage8-particle2d-headless-web-before-stop.png)/[停后](../traces/3.8.7-stage8-particle2d-headless-web-after-100ms.png)均显示旧粒子仍可见。两版自动移除开启时，在零粒子或旧粒子排空后的完成回调中调用 `node.destroy()`；调用后同帧默认有效性为 true、严格有效性为 false，随后该帧记录 `onDestroy`。关闭自动移除时，`_finishedSimulation` 会在后续每帧反复进入。3.8 四组 `renderData` 均存在；停后 `_canRender=false`，但存活组 `_renderFlag=true` 且截图仍可见。证据仅涵盖本次 Web 条件，相邻源码构建来源尚未确认。

## 2026-10-05 Web 补测与 skill 可用边界

- [2.4 音频](../traces/2.4.15-stage8-audio-web.jsonl)：两段 `AudioClip` 成功由 `resources` 加载。点击启动后，同 URL 的第 25 个 `cc.audioEngine` ID 使最早 ID 停止并脱离管理；混合 A/B URL 的 25 个 ID 在采样时均保持状态 1。可用于**本次 Web、受管 ID、同 URL 限额**的诊断；不能推断 `AudioSource`、真实可听结果、结束回调或 Native。
- [3.8 音频](../traces/3.8.7-stage8-audio-web.jsonl)：`AudioSource.maxAudioChannel=24`；24 个普通播放器之后启动 one-shot，使最早普通播放器状态变为 3、`playing=false`。23 普通 + one-shot 后再补普通，24 个普通播放器均为播放中；本条组件轨迹不直接记录 one-shot，下面的 WebAudio source 打点已补足。
- [2.4 3D 粒子](../traces/2.4.15-stage8-particle3d-web.jsonl)与[3.8 3D 粒子](../traces/3.8.7-stage8-particle3d-web.jsonl)：两版直接步进都出现先停发射、活动粒子排空、再停止。2.4 手动 `stop` 后 `isEmitting` 保持真，3.8 清零；3.8 `stopEmitting` 留存粒子直到排空。2.4 `getParticleCount()` 返回粒子池分配长度，不是活动粒子数：手动步进时为 16，后续自然帧池扩容后为 64。上述手动停止和 `stopEmitting` 结论仅限直接 `update(0.05)`；3.8 RenderCulling 仍待测。

## 2026-10-06 3D 粒子自然帧与同步截图

- [2.4 轨迹](../traces/2.4.15-stage8-particle3d-natural-headless-web.jsonl)：Director 正常调用临时 `ParticleSystem3D.update`，发射结束后活动数从最多 40 排空，节点仍有效；同期 `getParticleCount()` 为已分配池长度 64。探针把粒子放在主相机前 5 单位，以 0.7 秒发射避免首帧编译造成的大 `dt` 跳过发射。同步[活动期](../traces/2.4.15-stage8-particle3d-natural-headless-web-active.png)与[排空后](../traces/2.4.15-stage8-particle3d-natural-headless-web-drained.png)截图未显示粒子差异。**当前只确认模拟，不确认 2.4 3D 可见性。**
- [3.8 轨迹](../traces/3.8.7-stage8-particle3d-natural-headless-web.jsonl)：临时 CPU 粒子、RenderCulling 关闭时，Director 调用组件 `update`，活动粒子和模型挂接同时出现；排空同帧 `afterUpdate` 模型仍挂接，`AFTER_DRAW` 已脱离。同步[活动期](../traces/3.8.7-stage8-particle3d-natural-headless-web-active.png)截图可见紫红色粒子，[排空后](../traces/3.8.7-stage8-particle3d-natural-headless-web-drained.png)消失。截图暂停使下一帧 `dt` 增大，帧数不用于比较持续时间；GPU、RenderCulling、导入资产、Native 和引擎来源仍待验证。

## 2026-10-06 音频组件、场景与 Clip 释放

复跑入口为[独立音频无头运行器](../probes/creator-audio-headless-probe.mjs)，它只为生命周期实验放宽 Chrome 的首次用户手势限制；不用于验证默认浏览器策略或听感。两版各有组件[2.4](../probes/stage8-audio-lifecycle-2.4.js)/[3.8](../probes/stage8-audio-lifecycle-3.8.js)和磁盘场景[2.4](../probes/stage8-audio-scene-2.4.js)/[3.8](../probes/stage8-audio-scene-3.8.js)临时探针。探针只改预览内存中的节点与旧 Scene 开关，不改源场景。每个 `autoReleaseAssets` 分支使用独立页面；JSONL 元数据保存版本、场景、探针及运行器 SHA-256。

- [2.4 组件轨迹](../traces/2.4.15-stage8-audio-lifecycle-headless-web.jsonl)：3 秒 Clip 自然结束发 `audio.ended`，状态 STOPPED；停用立即 `stop` 且重新启用不自播；节点销毁先停组件音频，独立 `audioEngine` ID 仍 PLAYING。[场景 false](../traces/2.4.15-stage8-audio-scene-keep-headless-web.jsonl)/[true](../traces/2.4.15-stage8-audio-scene-release-headless-web.jsonl) 两组均在 `helloworld → stage4-empty` 后保留动态 Clip 缓存和全局 ID；显式 `releaseAsset` 触发 `AudioClip.destroy → uncache`，ID 变为 `getState=-1`。
- [3.8 组件轨迹](../traces/3.8.7-stage8-audio-lifecycle-headless-web.jsonl)：节点 `STARTED` 与约 3 秒后的 `ENDED` 已记录；`ENDED` 回调里 `state=PLAYING`，稍后为 INIT。停用暂停，重新启用且 `playOnAwake=false` 时不恢复；销毁先暂停再 `onDestroy → stop; clip=null`。[场景 false](../traces/3.8.7-stage8-audio-scene-keep-headless-web.jsonl)/[true](../traces/3.8.7-stage8-audio-scene-release-headless-web.jsonl) 两组切换后均保留动态 Clip 缓存，显式释放后才移除。
- [3.8 one-shot WebAudio 底层轨迹](../traces/3.8.7-stage8-audio-oneshot-backend-headless-web.jsonl)：`AudioBufferSourceNode` 已启动；源节点随 `main → stage4-empty` 失效、Clip 显式释放后，底层 source 未见 `stop` 调用，约 3 秒收到 `ended`。这是临时 WebAudio backend 打点，不是公开 one-shot 结束事件或可听证据。
- [3.8 one-shot 满额淘汰](../traces/3.8.7-stage8-audio-oneshot-eviction-headless-web.jsonl)：23 个普通 source + 1 个 one-shot 后补普通，WebAudio 先对 one-shot source 24 调 `stop()` 再启动普通 source 25；清理前 24 个普通组件均为播放中。[探针](../probes/stage8-audio-oneshot-eviction-3.8.js)以底层调用识别 one-shot，不能代替其他后端或听感。
- [3.8 one-shot 异步迟到](../traces/3.8.7-stage8-audio-oneshot-slow-load-headless-web.jsonl)：[探针](../probes/stage8-audio-oneshot-slow-load-3.8.js)延迟一次 WebAudio XHR，待临时源节点严格销毁后放行；随后记录到底层 `start()`，短时未见 `stop()`。无头 RAF 停滞时探针用内部 `_destroyImmediate()` 排空该临时节点。此结果覆盖成功请求的 WebAudio 分支。

3.8 的[静态场景探针](../probes/stage8-audio-static-scene-3.8.js)另用序列化 `AudioSource._clip` 对比两个独立分支。[Web 轨迹](../traces/3.8.7-stage8-audio-static-scene-headless-web.jsonl)确认加载后 Clip 位于 Scene 依赖表且 `refCount=1`；切换磁盘场景后引用数为 0，`autoReleaseAssets=true` 于下一帧销毁并移出缓存，`false` 在 400 ms 后仍缓存。两分支切换前普通音源都处于播放中，切换回调里组件均已失效且停止。2.4 的同等静态场景探针尚待 AssetDB 重新导入后运行；当前源 `.fire` 的 Clip UUID 与旧导入缓存 `_clip=null` 不一致。[旧导入诊断轨迹](../traces/2.4.15-stage8-audio-static-scene-stale-import-headless-web.jsonl)记录：仅临时替换单个生成 JSON 后，两次新浏览器预览仍显示 Clip 为空、Scene 依赖数为 0；生成 JSON 已按原 SHA-256 恢复。这不能当作 2.4 释放规则，也不证明编辑器具体使用了哪一层缓存。[2.4 官方资源管理文档](https://docs.cocos.com/creator/2.4/manual/zh/extension/asset-management)明确规定直接修改 `assets` 文件导致导入数据不一致时使用 `Editor.assetdb.refresh`。

2.4 现有另一条[内存构造依赖探针](../probes/stage8-audio-injected-scene-dependency-2.4.js)：动态加载 Clip 后，把 UUID 放入旧 Scene 的 `dependUtil` 记录并调用一次 `addRef()`，随后创建组件和受管音频 ID，执行真实磁盘场景切换。[两分支 Web 轨迹](../traces/2.4.15-stage8-audio-injected-scene-dependency-headless-web.jsonl)确认引用数 1→0；false 分支 400 ms 后仍缓存且 ID 播放，true 分支在切换回调之后同帧 `AudioClip.destroy → uncache`，Clip 移出缓存、ID 变为 `getState=-1`。探针的依赖登记不是编辑器静态导入，因此这只验证给定依赖表时的引擎释放分支。2.4 正式 `.fire` 导入、默认浏览器手势与声音输出仍未验证。

剩余边界：2.4 静态场景音频依赖的自动释放、默认浏览器手势与后台中断、2.4/3.8 原生、DOM Audio、其他慢加载结果和真正的声音输出仍须按平台分别验证。不得把动态 `resources.load` Clip 的结果推广为所有场景依赖。

预览来自各自 Creator 编辑器；仍未证明它们加载了相邻源码目录的自定义引擎。所有临时生成脚本已还原并按 SHA-256 核对。新结论已写入对应版本专属音频/粒子 skill，完整缺口见[清单](../stage8-9-gap-audit.md)。
