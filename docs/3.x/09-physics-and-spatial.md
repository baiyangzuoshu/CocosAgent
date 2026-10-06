# 3.8.7 物理与空间：独立源码入口

证据状态：公开能力以官网 3.8 手册为准，内部连接来自本地 `3.8.7engine` 静态阅读。`3.8,7NewProject` 源场景没有物理组件；局部 Web 轨迹来自预览中构造的临时对象。当前预览后端为 2D TypeScript Box2D、3D Bullet，其他配置及原生仍需分别核对。

## 两个物理系统和各自后端

[2D 物理手册](https://docs.cocos.com/creator/3.8/manual/zh/physics-2d/physics-2d.html)区分 Builtin 碰撞检测与 Box2D 刚体/关节功能；[3D 引擎选择页](https://docs.cocos.com/creator/3.8/manual/zh/physics/physics-engine.html)列出 Builtin、Cannon、Bullet、PhysX，并说明默认 Bullet。源码相应拆成 `cocos/physics-2d/` 与 `cocos/physics/`，两者各自有 `framework/physics-selector.ts` 注册后端，不可仅凭 `PhysicsSystem` 一个名字判断 2D/3D。

| 子系统 | 组件与系统 | 后端和接口边界 |
| --- | --- | --- |
| 2D | `RigidBody2D`、`Collider2D`、`PhysicsSystem2D.instance` | `cocos/physics-2d/framework/` 保存公开组件、系统与 `spec/` 协议；`builtin/`、`box2d/`、`box2d-wasm/`、`box2d-jsb/` 实现对应 World/Shape。Builtin 只做碰撞检测；Box2D 路线提供刚体、关节和更完整接触数据。 |
| 3D | `RigidBody`、`Collider`、`PhysicsSystem.instance` | `cocos/physics/framework/` 保存组件、系统、`spec/` 协议；`cocos/`、`cannon/`、`bullet/`、`physx/` 是后端。Builtin 只有触发器语义，不能用于动力学刚体碰撞。 |

后端选择还受编辑器[功能裁剪](https://docs.cocos.com/creator/3.8/manual/zh/physics/physics-engine.html)与打包条件影响；源码目录存在不代表当前示例已经加载该后端。`selector.register` 记录实现，物理系统创建 World；运行诊断应先读取当前系统与后端身份，再追特定实现。

两条选择器的后端模块都在 `Game.EVENT_PRE_SUBSYSTEM_INIT` 注册；`register` 在 World 尚未创建时更新所选 ID 和 wrapper，因此加载了哪些 `exports/physics-*` 模块、注册顺序与项目功能裁剪都影响最终选择。3D `PhysicsSystem` 在 `DirectorEvent.INIT` 尝试构造；若项目设置 `PHYSICS.enabled=false` 则不创建系统。构建配置选择手动加载 Bullet/PhysX 时，先由 `loadWasmModuleBullet/PhysX` 完成异步加载，再调用 `constructAndRegisterManually`。2D `PhysicsSystem2D` 同样在 Director 初始化时注册，但手动加载 Box2D WASM 构建走 `loadWasmModuleBox2D` 后注册。因此“后端源码存在”“选择器登记了 ID”“系统和 World 已可用”是不同状态。

3D `PhysicsSystem.instance` 只返回已有单例，`PHYSICS_*` 标志只反映选择器 ID；两者不能单独证明当前 World 已创建。2D `PhysicsSystem2D.instance` 会懒创建单例，其构造函数随即创建 World；只读探针应先检查 `PHYSICS_NONE`，再访问 `.instance`，并记录 World 类型。不要为了识别后端而调用 `selector.switchTo`：3.8.7 的 2D 实现新建 World 时旧 World 的 `destroy()` 仍是注释中的 TODO；切换会改变实验对象及状态。3D 的 `switchTo` 另有编辑器环境门槛，也不能代替记录实际预览配置。

2D 静态标志列出 Builtin、TypeScript Box2D、Box2D WASM，但 `box2d-jsb/instantiate.ts` 注册的 ID 是 `box2d-jsb`，没有对应 `PHYSICS_BOX2D_JSB` 标志。原生环境下若三个具名标志均为假，也不能直接判定为“无后端”；`PHYSICS_NONE` 只检查 ID 是否为空。内部 `framework/index.ts` 导出 2D `selector` 并挂到 `cclegacy.internal.physics2d`，可用于源码调试，公开游戏脚本仍应依官网 API。

## 帧步进与同步

`cocos/game/director.ts::tick` 依次执行组件 `start/update`、系统 `update`、组件 `lateUpdate`、延迟销毁，再执行各系统 `postUpdate`。2D `PhysicsSystem2D` 以 `SystemPriority.LOW` 注册，其 `postUpdate` 在启用且 `autoSimulation=true` 时发 `BEFORE_PHYSICS`，调用 `syncSceneToPhysics`，按 `_accumulator`、`fixedTimeStep`、`maxSubSteps` 步进 World，冲刷 `_delayEvents`，再 `syncPhysicsToScene`、发 `AFTER_PHYSICS`。Box2D 的接触回调由 `World.step` 同步触发，位置回写在其后，所以源码上事件顺序是 `AFTER_UPDATE → BEFORE_PHYSICS → contact callback → syncPhysicsToScene → AFTER_PHYSICS → BEFORE_DRAW`；回调内读取的节点变换可能尚未反映本物理步结果。上述标记/Begin 的相对顺序已有下段自然帧轨迹；组件 `lateUpdate` 与节点位置回写已由下述移动刚体探针在当前 TypeScript Box2D Web 配置中打点。当前 2D 的循环条件为 `_accumulator > fixedTimeStep`，默认最多 1 子步；等于步长时是否在本帧步进应以运行轨迹确认。

[自然帧探针](../agent-foundation/probes/stage9-natural-frame-2d-3.8.js)已在独立无头 Chrome 打开的当前 Web 预览运行；[轨迹](../agent-foundation/traces/3.8.7-stage9-2d-natural-frame-headless-web.jsonl)显示 TypeScript Box2D Body/Collider 实现均已建立，`maxSubSteps=1`、`fixedTimeStep=0.0166667`。本次第 2 帧顺序为 `BEFORE_UPDATE → AFTER_UPDATE → BEFORE_PHYSICS(2D) → 两侧 Begin → AFTER_PHYSICS(2D) → BEFORE_PHYSICS(3D) → AFTER_PHYSICS(3D)`。探针只在观察期间包装两个系统的 `postUpdate` 以标记事件来源，结束即恢复。两组全局 Physics 标记分别由 2D 与当前 Bullet 3D 系统发出，不是 2D 单系统违反 `maxSubSteps=1`；仅看 Director 事件名不能区分系统。节点保持原地，这份早期轨迹不能证明物理回写前后的位置差；补充的移动刚体轨迹见下段。

[移动刚体探针](../agent-foundation/probes/stage9-moving-sync-2d-3.8.js)的[自然帧轨迹](../agent-foundation/traces/3.8.7-stage9-2d-moving-sync-headless-web.jsonl)在当前 TypeScript Box2D Web 世界创建两个初始重叠 Dynamic 传感器，A 以 10 Box2D 米/秒移动，约等于 320 场景单位/秒。首帧组件 `update/lateUpdate`、`AFTER_UPDATE`、2D `BEFORE_PHYSICS` 及双方 Begin 回调均读到 `nodeX=bodyX=120000`；同帧 2D `AFTER_PHYSICS` 读到 `120005.3359375`，下一帧 `update` 才读到这一回写位置。探针在观察期间临时包装 2D/3D 的 `postUpdate` 来标记全局事件来源，结束即恢复。首帧接触是初始重叠条件，不能据此断言所有接触回调内节点与物理位置都相等；相邻源码构建来源和原生仍未确认。

3D `PhysicsSystem.postUpdate` 也在组件 `lateUpdate` 和延迟销毁之后：每个满足固定步长的子步执行 `syncSceneToPhysics → physicsWorld.step → emitEvents → syncAfterEvents`。其比较为 `_accumulator >= fixedTimeStep`。当系统 `_enable=false`，源码仍会同步 Scene 到 Physics World，但不模拟。两套系统可同帧存在；具体注册顺序和项目配置要从正在运行的工程确认，不应只凭源码中的默认数值断言当前示例行为。

## 事件与查询是后端相关合同

[2D 碰撞回调手册](https://docs.cocos.com/creator/3.8/manual/zh/physics-2d/physics-2d-contact-callback.html)允许在 Collider2D 或 PhysicsSystem2D 上监听 `Contact2DType`；Box2D 路线还要求刚体开启 `EnabledContactListener`，Builtin 有碰撞体即可，但只发 BEGIN/END，且 `contact` 为空。源码 `builtin/builtin-world.ts::_emitCollide` 同时向系统与两侧 Collider 发事件；`box2d/physics-contact.ts` 在对应接触条件下发事件。回调中的接触对象不要跨帧持有。

Builtin 的具体链路是 `Collider2D.onLoad/onEnable → BuiltinShape2D → BuiltinPhysicsWorld.addShape → BuiltinContact.updateState → _emitCollide`。`addShape` 排除同一节点的配对，并要求碰撞矩阵的两个方向均允许；形状更新后先做 AABB、再做几何相交测试。`_emitCollide` 仅传两侧 Collider，源码未传第三个接触对象。仍在接触的形状被禁用或改组时，`removeShape` 直接派发 `END_CONTACT`。与 2.4 普通碰撞的 `Stay` 不同，此后端只有 BEGIN/END。

Box2D 的 `physics-contact.ts::emit` 只向 `enabledContactListener` 为真的刚体对应 Collider 派发；**系统级事件也要至少一侧刚体开启监听**，单独给 `PhysicsSystem2D` 注册回调不足以收到这类事件。已分别核对 `box2d/`、`box2d-wasm/` 和 `box2d-jsb/` 三份 TypeScript 接触包装器，门槛相同；原生底层回调到包装器的运行链仍待打点。修改 Box2D 碰撞体的形状属性后还要沿 `Collider2D.apply()` 检查 fixture 重建；不能把属性写入瞬间当作物理世界已更新。

三个 Box2D 包装器的 `shapes/shape-2d.ts::_init` 在 fixture 建立时只为当时已开启 `enabledContactListener` 的刚体登记接触 fixture；其后 `physics-contact.ts::emit` 再检查当前开关。这个双门槛与 2.4 源码相似：只在 fixture 建立后把刚体属性改为 `true`，不一定补上登记。`RigidBody2D.enabledContactListener` 是普通字段，没有切换时的登记 setter；但 `Collider2D.apply()` 会销毁并重建 shape/fixture，因此源码推导为：先开启监听再 `apply()` 应重新登记。禁用/重启 Collider 也会走 `_destroy/_init` 生命周期，但初始化会延迟到安全步进点。建 fixture 前开启监听及当前 TypeScript Box2D Web 的“仅切字段”和 `apply()` 隔离分支均已有轨迹；Collider 禁用/重启、WASM/JSB/原生仍未测。可复跑的[TypeScript Box2D 对照探针](../agent-foundation/probes/stage9-2d-contact-registration-3.8.js)分别测“只切字段”和“切字段后 apply 重建”，已在当前 Web TypeScript Box2D 预览取得[原始轨迹](../agent-foundation/traces/3.8.7-stage9-2d-listener-apply-headless-web.jsonl)，不能代替 WASM/JSB/原生轨迹。先让新节点经历自然帧并确认 `hasChangedFlags=0`，再暂停、切换监听并使原先分离的两对传感器重叠：仅改字段的 A 仍有 1 个 fixture、登记数为 0，直接步进两次没有该对 Begin；调用 `apply()` 的 A 登记数变为 1，首次步进即产生 A Collider 和系统的 Begin。若新节点的缩放变换标志仍脏，`syncSceneToPhysics` 可能走 `nodeTransformChanged(SCALE) → Collider2D.apply()` 隐式重建 fixture，因此诊断“仅切字段”时必须先排除这种重建。

## 2D 空间查询的返回值与后端限制

[3.8 物理系统手册](https://docs.cocos.com/creator/3.8/manual/zh/physics-2d/physics-2d-system.html)明确把 2D 射线测试限定为 Box2D。`BuiltinPhysicsWorld.raycast` 在本快照直接返回空数组；若项目选 Builtin，射线穿过可见的 Collider2D 也不会命中。`PhysicsSystem2D.raycast` 只是把调用转给当前 World，诊断空结果前应先确认后端，再核对世界坐标、类型与掩码。

同一手册的“点测试”段落把 `testPoint` 描述成返回单个碰撞体，但 **3.8.7 源码和[3.8 API 参考](https://docs.cocos.com/creator/3.8/api/zh/class/PhysicsSystem2D)给出的签名是 `readonly Collider2D[]`**。`PhysicsSystem2D.testPoint` 直接委托 World；本地 Builtin、TypeScript Box2D、Box2D WASM 和 Box2D JSB 的 World 均收集多个 Collider，三个 Box2D 包装器还把多 fixture 命中去重。因此这是一处官网手册文字/示例与 API 参考、当前源码不一致，不能沿手册示例把 3.8 结果当成单对象；当前 TypeScript Box2D Web 预览已核实数组返回，其他后端仍待测。

仓库 `tests/physics2d/scene-query.ts` 也按数组测试 `testPoint` 的 `length` 与首个元素，但该文件跳过 Builtin；测试脚本的存在不是本机已运行证明。当前 `node_modules/.bin` 缺 Jest；阶段 9 已通过 Creator Web 预览取得局部运行轨迹，条件和范围见下文。

上述四个 World 的 `testPoint` 和 `testAABB` 各自复用一个模块级结果数组，每次查询先清空；需要保存列表时应立即复制。此结论覆盖本仓库 3.8.7 的 Builtin、TypeScript Box2D、Box2D WASM 和 Box2D JSB 包装器，但仍需分别确认运行中的实际后端。相交查询与射线结果对象的生命周期也应分开确认。

[3D 物理事件手册](https://docs.cocos.com/creator/3.8/manual/zh/physics/physics-event.html)从 `Collider.on('onTrigger…'/'onCollision…')` 订阅。公开前提需分开记：触发事件需要双方 Collider 且至少一个 `IsTrigger=true`；非 Builtin 还要求至少一侧刚体非静态，Builtin 不受此刚体限制。**该手册的碰撞条件自身有两种写法：**“碰撞事件”注意段落及刚体类型表允许至少一侧非静态（含 Kinematic），后面的“触发事件和碰撞事件区别”却写至少一侧 Dynamic。两处不能合并成一个跨后端规则；当前 Bullet 的 Kinematic 对已按下文实测产生碰撞事件，3.8 Cannon/PhysX 仍需单独验证。静态对静态在两处均不产生碰撞数据。源码链按事件种类分流：`Collider._updateNeedEvent` 维护订阅标志，Builtin 只做几何重叠和 trigger 派发，Bullet 按 `isTrigger` 区分触发/碰撞，Cannon 与 PhysX 由各自后端回调驱动。

**Builtin 的有效 trigger 语义需单独记录：** `Collider.isTrigger` 的本地源码注释明确写明 Builtin 中无论属性真假都按触发器处理；`BuiltinShape.isTrigger` setter 为空实现。`BuiltinSharedBody.intersects` 只在任一 Collider 有 trigger 事件订阅时检查重叠，命中对在 `BuiltinWorld.emitTriggerEvent` 中派发 `onTrigger…`。这解释了为何其形状配对未按可见的 `isTrigger` 布尔值过滤；手册事件页所说“至少一方为 trigger”未说明此 Builtin 特例，阅读时须结合所选后端。实际预览仍需分别订阅并对比 trigger-trigger、trigger-collider、collider-collider，不外推到 Cannon/Bullet/PhysX。

3.8 的 `RigidBody.Type` 使用 `DYNAMIC=1`、`STATIC=2`、`KINEMATIC=4`，公开组件是 `RigidBody` 和 `BoxCollider`。为直接核对 Builtin 事件边界，准备了[临时事件探针](../agent-foundation/probes/stage9-3d-builtin-events-3.8.js)：必须在 3D World 已配置为 `BuiltinWorld` 时运行；它在内存中创建三组无刚体重叠 BoxCollider，双方均订阅 `onTriggerEnter` 与 `onCollisionEnter`，并记录两侧回调数。探针暂时启用 PhysicsSystem，结束时销毁节点并恢复原启用状态。当前 3.8 Web 预览实际为 Bullet，因此此探针尚未运行；不能把 Bullet 结果代替 Builtin 观察。

当前 `BulletWorld` 已执行[自然帧事件探针](../agent-foundation/probes/stage9-3d-events-bullet-3.8.js)，[原始轨迹](../agent-foundation/traces/3.8.7-stage9-3d-events-headless-web.jsonl)记录 24 次 `AFTER_PHYSICS`：静态 trigger 对 Static 在本次没有 Enter；Dynamic trigger 两侧各有 `onTriggerEnter`；Dynamic 对 Static 的普通碰撞两侧各有 `onCollisionEnter`，contact 数为 4；**Kinematic 对 Static、双方 `isTrigger=false`** 也在两侧各有 `onCollisionEnter`，contact 数为 4。刚体类型值为 `KINEMATIC=4`，组/掩码都允许相交，包装器已建立。这一 Bullet Web 结果支持手册事件页“至少一侧非静态”的碰撞条件，与该页稍后的“至少一侧 Dynamic”句子不一致；不能推广到 Cannon、PhysX 或原生。探针结束恢复系统与暂停状态并销毁临时节点；相邻源码构建来源仍未确认。

3D `PhysicsSystem.raycast/raycastClosest` 接世界射线，返回是否命中，结果另存 `raycastResults/raycastClosestResult`；[射线手册](https://docs.cocos.com/creator/3.8/manual/zh/physics/physics-raycast.html)和源码都提示结果对象会复用，需在下一次查询前复制需要的数据。屏幕点先经 Camera 转成世界射线，射线只命中物理 Collider，不能代替渲染模型拾取。

3.8 `Collider.on/off` 会更新 `_needTriggerEvent/_needCollisionEvent`，并通知后端 Shape；因此事件订阅本身参与派发链。以 TypeScript Cannon 为例，`PhysicsSystem.postUpdate` 的每个子步在 `World.step` 后调用 `emitEvents`，后端世界触发底层事件，`cannon-shape.ts::_onTrigger` 或 `cannon-shared-body.ts::onCollided` 再向 Collider 发 `onTrigger…/onCollision…`。Cannon 碰撞事件按共享物理体上的 Shape 遍历派发，事件对象与 contacts 被复用；若要跨回调保存命中数据，复制具体数值。Builtin 世界只产生 `onTrigger…`。Bullet、PhysX 的事件缓冲和约束条件仍应单独追踪，不以 Cannon 路径代替。

3.8.7 的 Bullet 与 PhysX 也分别走后端缓冲：`bullet-world.ts::emitEvents` 按需求收集 contact，再把 Enter/Stay/Exit 派给 Collider；`physx-world.ts` 把原生 contact/trigger 回调存入字典，稍后由 `PhysXCallback.emit…Event` 逐侧检查 `needCollisionEvent/needTriggerEvent` 后派发。这说明 `Collider.on/off` 的事件需求标记会影响后端处理，但不能据此断言两后端同帧事件的精确顺序相同；原生桥与实际构建还需分别验证。

3D Builtin 的 `raycast/raycastClosest` 与 2D Builtin 不同：`cocos/builtin-world.ts` 对每个物理 Shape 做几何射线相交，按 `mask` 过滤，并把命中写入系统结果；此实现没有读取 `queryTrigger`，`hitNormal` 传入零向量。不能因为 2D Builtin 不支持射线就回退到渲染拾取。此处仅说明 3.8.7 TypeScript Builtin 实现，实际后端和平台需确认。

[3.8 几何投射手册](https://docs.cocos.com/creator/3.8/manual/zh/physics/physics-sweep.html)介绍 `sweepBox/Sphere/Capsule` 及各自 Closest 查询，但本快照的后端能力不齐：Builtin 和 Cannon 的六个 World 方法都警告并返回 `false`；Bullet 和 PhysX 有对应实现。若 sweep 返回 `false`，先辨明后端，再判断是否真的没有命中；后端未实现不能当作场景里没有碰撞体。

## 最小验证切口

先在 3.8 示例检查构建/预览实际 2D 与 3D 后端。然后分别创建 Builtin 2D 碰撞对、Box2D 2D 刚体碰撞对，以及所选 3D 后端的 Collider/刚体对；记录系统 `BEFORE/AFTER_PHYSICS`、Collider/系统回调、节点位置与步数。2D 要额外测重叠两个 Collider 时 `testPoint` 的返回形状、结果数组复用、Builtin 射线空结果，以及 Box2D 仅有系统级订阅而刚体监听关闭时是否收不到事件。再以同一相机射线测 3D 物理命中、无 Collider 模型和结果复用。Builtin、Box2D、Cannon/Bullet/PhysX 的行为分别记录，不拿某一后端代表整个 3.8。

2026-10-05 的[只读后端快照](../agent-foundation/traces/stage9-backend-web.jsonl)确认本次 3.8 Web 预览的 2D 选择器为 TypeScript Box2D、3D 为 Bullet，3D `PhysicsSystem` 已存在且启用，World 类为 `BulletWorld`。这只识别当前预览，不能替代其他后端或原生包配置。脚本见[后端身份探针](../agent-foundation/probes/stage9-backend-identity-3.8.js)。

[2D 查询轨迹](../agent-foundation/traces/3.8.7-stage9-2d-query-web.jsonl)用当前 `b2PhysicsWorld`、两个临时 `BoxCollider2D` 和手动 `world.step(0.05)` 得到 `testPointIsArray=true`；首次点查询为 `[b,a]`，随后矩形查询也为 `[b,a]`，再做远点查询后，先前保存的首次数组变为 `[]`。这验证了**当前 TypeScript Box2D 包装器**的数组返回与复用，也解释了为何跨查询保存结果必须复制。探针没有 `RigidBody2D`，接触列表为空不能验证 `enabledContactListener` 门槛；Builtin/WASM/JSB 与自然帧仍待各自实测。

[2D 接触监听轨迹](../agent-foundation/traces/3.8.7-stage9-2d-contact-web.jsonl)补上了两组相互隔离的重叠 Dynamic 传感器：四个刚体和 Shape 实现均已创建。一组两个刚体的 `enabledContactListener` 都为假，在本次手动步进中没有回调；另一组仅 A 为真，A Collider 与系统各收到一次 Begin，禁用 B Collider 后系统收到 End。这个结果与 `physics-contact.ts::emit` 的监听门槛一致，限于当前 TypeScript Box2D Web 与直接 `world.step(0.05)`，不能代表 Builtin/WASM/JSB 或自然 Director 帧。探针见[接触脚本](../agent-foundation/probes/stage9-2d-contact-listener-3.8.js)。

[3D 射线轨迹](../agent-foundation/traces/stage9-3d-ray-web.jsonl)在当前 BulletWorld 中用 2×2×2 临时 `BoxCollider` 测试：正向射线命中该 Collider，距离约 9、法线 `(0,0,-1)`；横向偏移 10 的射线未命中。它只验证本次 Bullet Web 的最小查询，不验证其他后端、trigger/collision 事件或扫掠；[可复跑探针](../agent-foundation/probes/stage9-3d-raycast-3.8.js)。
