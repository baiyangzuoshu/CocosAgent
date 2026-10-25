# 2.4.15 物理与空间：独立源码入口

证据状态：官网 2.4 手册已核对公开用法；下述内部调用链来自本地 `engine/2.4.15engine` 静态源码阅读。`2.4.15NewProject` 源场景没有物理或碰撞组件；局部 Web 轨迹来自预览中构造的临时对象，覆盖手动 2D 碰撞/查询和 Cannon 3D 射线。

## 先分三条系统

官网[物理与碰撞系统](https://docs.cocos.com/creator/2.4/manual/zh/physics/index.html)把 2D 简单碰撞和 Box2D 物理分开；[3D 物理](https://docs.cocos.com/creator/2.4/manual/zh/physics-3d/physics-manager.html)另成一条链。排查游戏行为先确认节点组件与管理器，不能只问“物理是否开启”。

| 开发者用法 | 公开入口 | 本地源码入口与职责 |
| --- | --- | --- |
| 2D 简单碰撞检测 | `cc.BoxCollider/CircleCollider/PolygonCollider`、`cc.director.getCollisionManager()`；[手册](https://docs.cocos.com/creator/2.4/manual/zh/physics/collision/collision-manager.html) | `cocos2d/core/collider/CCCollisionManager.js` 更新碰撞体世界形状、检查候选接触，按 `onCollisionEnter/Stay/Exit(other, self)` 调用两侧节点脚本；不构建 Box2D 世界，也不负责刚体受力。管理器默认关闭。 |
| 2D 刚体与物理碰撞 | `cc.RigidBody`、`cc.PhysicsBoxCollider` 等、`cc.director.getPhysicsManager()`；[管理器](https://docs.cocos.com/creator/2.4/manual/zh/physics/physics/physics-manager.html)、[回调](https://docs.cocos.com/creator/2.4/manual/zh/physics/physics/contact-callback.html) | `cocos2d/core/physics/CCPhysicsManager.js` 在启用时创建 Box2D World，推进 `World.Step`；`CCPhysicsContact.js` 按刚体 `enabledContactListener` 把 `onBeginContact/onEndContact/onPreSolve/onPostSolve(contact, self, other)` 发给节点脚本。 |
| 3D 刚体、触发器与射线 | `cc.director.getPhysics3DManager()`、3D `RigidBody/Collider`；[引擎选择](https://docs.cocos.com/creator/2.4/manual/zh/physics-3d/physics-select.html) | `cocos2d/core/3d/physics/framework/physics-manager.ts` 调所选 `physicsWorld`；`cannon/` 与 `cocos/` 分别实现 Cannon 和 Builtin。3D 管理器默认关闭，且仅在构建包含对应物理模块时由 Director 创建。 |

`CCDirector.sharedInit` 分别创建存在的 `CollisionManager`、`PhysicsManager`、`Physics3DManager`，交给 Scheduler 以 `PRIORITY_SYSTEM` 调度。组件 `update` 与系统更新的本帧相对位置由 Director 主循环和 Scheduler 决定；多个同优先级管理器的具体回调次序仍应按实际运行轨迹核验，不能从这张表推断所有事件先后。

## 2D 的两种接触不共享回调合同

简单碰撞的 `CCCollisionManager.update` 先更新 `_colliders`，再依 `_contacts` 的 `updateState` 收集结果，最后 `_doCollide` 遍历双方节点 `_components`，调用组件上同名函数。分组过滤从 `cc.game.collisionMatrix` 和节点 `groupIndex` 读取。它没有 Box2D 接触数据，脚本拿到的 `self.world.aabb/points` 属于碰撞系统维护的世界形状。

注册链是 `CCCollider.onEnable → CCCollisionManager.addCollider`：管理器为符合分组条件、且不在同一节点上的已有 Collider 建立候选 `CCContact`。每次更新先刷新形状的世界坐标，再以 AABB 和具体几何相交测试确认状态变化；持续相交的后续更新产生 `Stay`。`onDisable → removeCollider` 会对仍在接触的配对直接发 `Exit`。节点 `GROUP_CHANGED` 也走移除再添加，因此改组时可能先触发 `Exit`；回调发生在脚本哪一步，仍要通过预览打点。

Box2D 路线从 `CCPhysicsManager.update` 进入 `world.Step`，接触监听器到 `CCPhysicsContact.emit`；只有对应刚体开启 `enabledContactListener` 才向该侧节点脚本发回调。`CCPhysicsCollider.__init` 在创建每个 fixture 时读取该字段并登记监听 fixture；`__destroy` 会撤销登记。`enabledContactListener` 本身改值不会重登已有 fixture；当前 Web Box2D 的隔离运行对照见下段：让 Collider 重建后会按当前属性重新登记。手册提醒接触数据由物理引擎缓存，需在回调内使用或复制，不要长期保留原对象。`PhysicsManager` 还把部分操作放进 `_delayEvents`，在 `Step` 后冲刷，再调用 `_syncNode`。

在 2.4 可通过禁用再启用 `PhysicsBoxCollider` 触发生命周期 `onDisable → __destroy` 和 `onEnable → __init`。[隔离探针](../agent-foundation/probes/stage9-2d-contact-registration-2.4.js)的[当前 Box2D Web 轨迹](../agent-foundation/traces/2.4.15-stage9-2d-listener-reenable-headless-web.jsonl)比较两对初始重叠 Dynamic 传感器：创建 fixture 时监听均关闭；随后只改 A 的字段，该 fixture 登记数仍为 0，直接 `PhysicsManager.update(0.05)` 两次没有 Begin；另一对 A 先改字段再关闭/启用 Collider，重建后的登记数为 1，收到该侧 Begin。探针在游戏暂停时手动步进，不能据此推断自然帧回调时序或原生表现。

**源码时序与自然帧局部确认：** `CCDirector.mainLoop` 在 `EVENT_BEFORE_UPDATE` 之后执行组件 `start/update`，接着调用 Scheduler，再执行组件 `lateUpdate` 与 `EVENT_AFTER_UPDATE`。`PhysicsManager` 在 Scheduler 中以系统优先级更新；因此 Box2D 的接触回调位于普通组件 `update` 之后、`lateUpdate` 之前。`world.Step` 内回调先发生，随后管理器冲刷延迟操作并 `_syncNode`，所以回调读取节点位置时，可能仍是本步物理解算前的值；同步后的变换应在后续 `lateUpdate` 或 `EVENT_AFTER_UPDATE` 观察。2D `PhysicsManager` 没有发出 Director 的 `EVENT_BEFORE_PHYSICS/AFTER_PHYSICS`；其私有管理器事件 `before-step` 不是 Director 事件。组件 `update/lateUpdate` 与物理回写的相对位置已由下述移动刚体探针在当前 Box2D Web 配置中打点。

[自然帧探针](../agent-foundation/probes/stage9-natural-frame-2d-2.4.js)已在独立无头 Chrome 打开的当前 Web 预览运行；[轨迹](../agent-foundation/traces/2.4.15-stage9-2d-natural-frame-headless-web.jsonl)显示 Box2D 管理器由原先关闭临时开启，两个 Dynamic 传感器的 Body 已创建，本次第 3 帧先发 `BEFORE_UPDATE`，再向两侧发 Begin，最后发 `AFTER_UPDATE`，500 ms 观察窗口累计到第 26 帧。它直接验证回调在这两个 Director 标记之间；未给组件 `update/lateUpdate` 单独打点。两节点保持原地且无重力，这份早期轨迹不能验证求解后的节点位置同步时刻；补充的移动刚体轨迹见下段。

[移动刚体探针](../agent-foundation/probes/stage9-moving-sync-2d-2.4.js)的[自然帧轨迹](../agent-foundation/traces/2.4.15-stage9-2d-moving-sync-headless-web.jsonl)在临时启用的当前 Box2D Web 世界创建两个初始重叠 Dynamic 传感器，A 以 320 场景单位/秒移动。接触首帧中，A 的组件 `update` 和双方 Begin 回调读到 `nodeX=bodyX=120000`；同帧 `lateUpdate` 与 `AFTER_UPDATE` 读到 `120005.333…`。连续后续帧重复 `update` 读上一物理步位置、`lateUpdate` 读本步回写位置的顺序。该首帧的接触发生于初始重叠条件，不能据此断言所有接触回调内节点与物理位置都相等；相邻源码构建来源和原生仍未确认。

本快照 `PhysicsManager.enabledAccumulator=false` 是默认值：每次管理器 `update` 用 `1 / cc.game.config.frameRate` 执行一次 `World.Step`，不是直接使用传入的 `dt`。开启累积器才用 `FIXED_TIME_STEP` 循环步进，并把累积时间限制在 `MAX_ACCUMULATOR`。诊断模拟速度时要记录帧率设置、累积器开关、实际 `dt` 与步数。

## 3D 后端、同步与查询

[2.4 官网引擎选择页](https://docs.cocos.com/creator/2.4/manual/zh/physics-3d/physics-select.html)说明编辑器预览使用 Cannon，构建可选 Cannon/Builtin；Builtin 只有碰撞检测及 trigger 事件，刚体受力和物理材质无效。`Physics3DManager.update` 在启用后发 `EVENT_BEFORE_PHYSICS`，按 Builtin/固定步长/累积器分支调用 World，再发 `EVENT_AFTER_PHYSICS`。Cannon World 的 `step` 内部执行 `syncSceneToPhysics → CANNON.World.step → syncPhysicsToScene → emitEvents`；Builtin 的具体接触和同步应按其世界实现单独诊断。

本快照的后端接线由构建宏决定：`cocos2d/core/3d/physics/cannon/instantiate.ts` 仅在 `CC_PHYSICS_CANNON` 时把 Cannon 的 Shape、RigidBody 和 World 构造器交给 `framework/physics-selector.ts::instantiate`；`cocos/instantiate.ts` 仅在 `CC_PHYSICS_BUILTIN` 时注册 Builtin 构造器，并把 RigidBody 置为 `null`。`CCDirector.sharedInit` 还要求 `cc.Physics3DManager` 存在、且至少一个宏为真，才创建并调度管理器。诊断时要先记录构建宏、管理器是否存在与启用、实际 World；源码里同时有两个后端目录不表示预览可运行时任意切换。

[2.4 官网 3D 物理事件](https://docs.cocos.com/creator/2.4/manual/zh/physics-3d/physics-event.html)要求在 `Collider3D.on` 监听 `trigger-enter/stay/exit` 或 `collision-enter/stay/exit`，该专题没有列出触发/碰撞对的刚体类型矩阵。源码方面，本地 Cannon `cannon-world.ts::emitEvents` 调底层 `emitTriggeredEvents/emitCollisionEvents`，再由 `cannon-shape.ts` 和 `cannon-shared-body.ts` 送到 Collider。这个 2.4.15 Cannon 实现每次还额外派发一遍 `onTrigger…/onCollision…` 兼容名称；但 2.4 Builtin 世界只派发连字符形式的 trigger 名称。

**Builtin 的 `isTrigger` 有专属语义：** 2.4 `Collider3D.isTrigger` 的源码注释写明使用 Builtin 时始终按 trigger 处理；`BuiltinShape.isTrigger` setter 为空。`BuiltinSharedBody.intersects` 收集相交 shape 对，`BuiltinWorld.emitColliderEvent` 对这些 pair 统一发 `trigger-*`。本地源码由此不区分属性真假，也不产 collision 事件；对应 Creator 预览仍需实测。不要把 3.8 官网的刚体类型矩阵倒推到 2.4。跨后端代码应以 2.4 手册的连字符名称为准，不能因 Cannon 兼容分支就把 3.8 名称当成 2.4 统一合同。Cannon 复用事件对象和 contacts 容器，回调后保留接触数据时应复制需要的值。

[2.4 的 3D 刚体手册](https://docs.cocos.com/creator/2.4/manual/zh/physics-3d/physics-rigidbody.html)公开组件 `cc.RigidBody3D` 的 `Mass` 与 `Is Kinematic` 属性，盒碰撞体为 `cc.BoxCollider3D`。`ERigidBodyType` 虽在 `physics-enum.ts` 定义了 `DYNAMIC=1`、`STATIC=2`、`KINEMATIC=4`，但 `RigidBody3D` 组件没有 3.8 的 `type` 属性；在本地 Cannon 实现中，`mass=0` 映射 Static，非零质量结合 `isKinematic` 映射 Dynamic/Kinematic。为检查 Builtin 上述源码行为，准备了[临时事件探针](../agent-foundation/probes/stage9-3d-builtin-events-2.4.js)：它要求当前 World 已是 `BuiltinWorld`，暂时启用管理器，在互不重叠的坐标区创建三组无刚体 BoxCollider3D，订阅 `trigger-enter` 与 `collision-enter`，记录每侧 Enter 次数，最后清理节点并恢复启用状态。脚本语法已检查，但当前没有 Builtin 预览轨迹；不应把探针预期或 Cannon 轨迹当作观测结果。

当前 Web 预览的 `CannonWorld` 已执行[自然帧事件探针](../agent-foundation/probes/stage9-3d-events-cannon-2.4.js)，[原始轨迹](../agent-foundation/traces/2.4.15-stage9-3d-events-headless-web.jsonl)记录 27 次 `AFTER_PHYSICS`：静态 trigger、Dynamic trigger 和 **Kinematic 对 Static 的非 trigger 配对**均向两侧发 `trigger-enter` 与兼容 `onTriggerEnter`；Dynamic 对 Static 的非 trigger 配对向两侧发 `collision-enter` 与兼容 `onCollisionEnter`，contact 数为 4。手册连字符名与兼容名在本次 Cannon Web 均有回调，但应用应优先使用官网名称。探针确认该 Kinematic 组 `mass=10`、`isKinematic=true`，底层 Cannon Body 类型为 4。Kinematic 配对的分类不是由 Collider 的 `isTrigger` 解释：本地 `external/cannon/cannon.js::Narrowphase.getContacts` 把 Kinematic/Static 与 Kinematic/Kinematic 设为 `justTest`，把重叠写入 `triggerDic`，后经 `emitTriggeredEvents` 发 trigger。2.4 3D 管理器原先关闭，探针仅在运行期间启用并恢复；相邻源码构建来源未确认，Builtin 和原生不由此轨迹证明。

`Physics3DManager.raycast/raycastClosest` 接收世界射线，将结果放进复用的 `raycastResults`/`raycastClosestResult`，下一次查询可能覆盖它们。另有[官网几何交集 API](https://docs.cocos.com/creator/2.4/manual/zh/3d/intersect.html)从节点/渲染模型做检测；它不是物理世界射线查询。2D Box2D 的 `PhysicsManager.rayCast(p1,p2,type)` 又使用两点定义线段和 `RayCastType`，不要与 3D 射线签名混用。

2.4 的 3D Builtin **仍实现 `raycast/raycastClosest`**，不是“Builtin 无射线”。`cocos/builtin-world.ts` 对每个 Builtin Shape 调 `cc.geomUtils.intersect.resolve(worldRay, worldShape)`，按 `cc.game.collisionMatrix` 中查询组到目标节点组的配置过滤；虽从管理器接收 `queryTrigger`，此实现没有读取它。这个后端只处理离散相交和触发事件，射线命中不意味着会施加刚体碰撞响应。与之相对，3.8 的 **2D** Builtin 才是 `raycast` 直接返回空数组，跨维度不能共用“Builtin 无射线”的判断。

2D Box2D 的[点测试与矩形测试手册](https://docs.cocos.com/creator/2.4/manual/zh/physics/physics/physics-manager.html)对应 `CCPhysicsManager.testPoint` 和 `testAABB`：前者通过 AABB 查询取一个 fixture，返回单个 `PhysicsCollider` 或 `null`；后者返回数组。`rayCast` 也返回结果数组，起终点都是世界坐标。本快照 `CCPhysicsAABBQueryCallback.ReportFixture` 只收集 `BodyType.Dynamic`，因此这两个查询都不会返回 Static/Kinematic 刚体上的 fixture；这一条件需和手册的公开描述并列记录。单个点测试结果属于 **2.4 的签名**，不能直接用来解释 3.8 的 `PhysicsSystem2D.testPoint`。

[2.4 Web 轨迹](../agent-foundation/traces/2.4.15-stage9-2d-query-web.jsonl)已验证：两个 Static fixture 就绪且位于查询矩形内时，`testAABB=[]`、`testPoint=null`；改为 Dynamic 后，矩形查询有 2 个结果；再设为无重力传感器后，点查询返回其中一个 Collider。仅改为 Dynamic 而仍让两个实体碰撞时，点查询仍为 `null`；未记录那次查询瞬间的两刚体位置，不能断定具体分离路径。普通碰撞的两个节点分别收到 Enter、Stay、禁用触发的 Exit；该实验手动调用 `CollisionManager.update`，不证明自然帧内的回调时序。

Box2D 接触监听在本快照有两道检查：`CCPhysicsCollider` 创建 fixture 时，仅当其 RigidBody 的 `enabledContactListener` 已为真才调用 `PhysicsManager._registerContactFixture`；`CCPhysicsContactListner.BeginContact` 仅转发至少一个 fixture 已登记的接触；`CCPhysicsContact.emit` 再只向当前仍开启监听的一侧节点脚本派发。[2.4 Web 轨迹](../agent-foundation/traces/2.4.15-stage9-2d-contact-web.jsonl)验证了这个顺序：两个监听关闭的传感器对无回调；创建前开启 A 监听时，A 收到 Begin，禁用 B Collider 后 A 收到 End；创建后才开启的 A 虽然属性为真，其 fixture 仍未登记，也没有收到回调。探针暂停游戏并直接调用 `PhysicsManager.update(0.05)`，结论限于此手动步进的 Box2D Web 预览；自然帧顺序和原生仍待验证。可复跑[探针](../agent-foundation/probes/stage9-2d-contact-listener-2.4.js)。

## 最小验证切口

后续仍需补 2.4 Box2D `enabledContactListener=false/true` 接触回调、自然 Director 帧中事件与节点同步、3D Cannon 触发/刚体碰撞及射线复用。已经验证的简单碰撞手动更新与 2D 查询结果以现有 Web 轨迹为限。

2026-10-05 的[只读后端快照](../agent-foundation/traces/stage9-backend-web.jsonl)进一步确认本次 2.4 Web 预览的 `CC_PHYSICS_CANNON=true`、`CC_PHYSICS_BUILTIN=true`，`Physics3DManager` 存在且其 `physicsWorld.constructor.name=CannonWorld`，但 `manager.enabled=false`。两个构建标志同时为真不代表两个 World 同时活跃；该只读快照没有启用 3D 管理器或测试回调。探针见[后端身份脚本](../agent-foundation/probes/stage9-backend-identity-2.4.js)。

后续[最小射线实验](../agent-foundation/traces/stage9-3d-ray-web.jsonl)在同一预览中暂时启用 `Physics3DManager`，创建 2×2×2 的临时 `BoxCollider3D`，从 z=-10 沿 +z 发射射线，在距离 9、世界点 `(20000,20000,-1)` 命中该 Collider；横向偏移 10 的射线未命中。探针的 `finally` 恢复先前的 `enabled=false` 并销毁临时节点，生成脚本也恢复原 SHA-256。此证据只覆盖本次 Cannon Web 的最小射线，不证明事件、Builtin 后端或自然帧同步；[可复跑探针](../agent-foundation/probes/stage9-3d-raycast-2.4.js)。
