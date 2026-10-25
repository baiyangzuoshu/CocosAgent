# 阶段 9 skill 验证状态

候选：[2.4 物理与空间追踪](cocos2-physics-spatial-trace/SKILL.md)和[3.8 物理与空间追踪](cocos3-physics-spatial-trace/SKILL.md)。两份 skill 已按各自官网手册和本地源码建立判别路径；局部 Web 证据覆盖 2.4 普通 2D 碰撞与 Box2D 查询、3.8 TypeScript Box2D 查询及接触监听门槛、两版当前后端的 3D 射线与自然帧 3D Enter 事件。移动刚体同步已在当前两版 Box2D Web 后端取得自然帧轨迹；3D Builtin/其他后端及平台仍待验证，不得标记为阶段整体完成。

已核对的源码入口：2.4 `CCDirector.sharedInit` 挂接简单碰撞、Box2D 和 3D 管理器，`CCCollisionManager.update` 直接调用节点组件，`CCPhysicsManager.update` 步进 Box2D 并在步进后冲刷延迟事件，`Physics3DManager.update` 根据后端推进 World。3.8 `Director.tick` 在组件 lateUpdate 和延迟销毁之后调用系统 `postUpdate`；`PhysicsSystem2D` 与 3D `PhysicsSystem` 各自管理后端、固定步长和事件链。

第二轮源码核对：2.4 简单碰撞按节点组矩阵建立候选接触，持续相交发 `Stay`，移除相交中的 Collider 可直接发 `Exit`；2.4 Box2D `testPoint` 返回单个 Collider 或 `null`。3.8 Builtin 2D 对组矩阵双向检查，接触只有 BEGIN/END，`raycast` 恒返回 `[]`；TypeScript Box2D 的系统级接触事件也受至少一侧刚体 `enabledContactListener` 约束。3.8 Builtin 与 TypeScript Box2D 的 `testPoint/testAABB` 返回复用数组。[3.8 手册的点测试段落](https://docs.cocos.com/creator/3.8/manual/zh/physics-2d/physics-2d-system.html)说返回单个对象，而本快照源码和[3.8 API 参考](https://docs.cocos.com/creator/3.8/api/zh/class/PhysicsSystem2D)是数组；此差异保留在证据记录中，当前 TypeScript Box2D Web 预览已确认数组返回。

2.4 Web 复测发现 `CCPhysicsAABBQueryCallback.ReportFixture` 仅收集 Dynamic 刚体：Static 的 fixture 已创建且 AABB 覆盖目标点，`testPoint=null`、`testAABB=[]`；两个无重力 Dynamic 传感器重叠时 `testPoint` 返回其中一个 Collider、`testAABB` 返回 2 个。普通碰撞的两侧分别收到 Enter/Stay/禁用时 Exit。证据见[轨迹](../traces/2.4.15-stage9-2d-query-web.jsonl)；采用手动 `CollisionManager.update`，不能据此声称自然帧相对时序。Dynamic 非传感器重叠时点查询仍为空，未记录那一刻两个刚体的中心，不能断言原因。

3D 事件源码补查：2.4 手册订阅连字符 `trigger-enter`/`collision-enter`，没有刚体类型矩阵；Cannon 快照同时派发 `onTrigger…`/`onCollision…` 兼容名，Builtin 仅派发连字符 trigger。3.8 手册要求触发事件双方有 Collider 且至少一侧为 trigger；非 Builtin 还要求至少一个非静态刚体。其碰撞段落与类型表允许 Kinematic 参与，后面的总结却要求 Dynamic，本次 Bullet Web 的 Kinematic 对 Static 碰撞实际发 `onCollisionEnter`，支持“非静态”写法；其他后端仍需分别验证。`Collider.on/off` 更新事件需求标记，Cannon 后端复用事件与 contacts。两版 Collider 源码注释都说明 Builtin 始终按 trigger 处理，Builtin Shape 的 `isTrigger` Setter 为空；这是尚待运行验证的本地源码结论，不能推广到其他后端。2.4/3.8 当前实际后端分别为 Cannon/Bullet，现已有下述 3D trigger/collision Web 轨迹。现已准备[2.4](../probes/stage9-3d-builtin-events-2.4.js)和[3.8](../probes/stage9-3d-builtin-events-3.8.js) Builtin 专用探针，要求 World 名为 `BuiltinWorld`；各自对照 collider-collider、trigger-collider、trigger-trigger 并监听双方 trigger 与 collision Enter。探针只构造内存节点，会暂时启用物理管理器/系统，结束时销毁节点并恢复启用状态；它们通过语法检查，尚未实际运行。

当前实际后端另备[2.4 Cannon 事件探针](../probes/stage9-3d-events-cannon-2.4.js)和[3.8 Bullet 事件探针](../probes/stage9-3d-events-bullet-3.8.js)，均用静态 trigger、Dynamic trigger、Dynamic collision、Kinematic collision 四组隔离配对，在自然物理帧记录双方 Enter 与 contact 数量。2.4 同时监听手册和兼容名称，且检查 `RigidBody3D` 后端包装器是否存在；3.8 的 Kinematic collision 专门核对手册内部两种说法。两份脚本已在各自预览服务的独立无头 Chrome 中运行，取得[2.4 Cannon](../traces/2.4.15-stage9-3d-events-headless-web.jsonl)与[3.8 Bullet](../traces/3.8.7-stage9-3d-events-headless-web.jsonl)轨迹。2.4 管理器临时启用后经历 27 次 `AFTER_PHYSICS`，静态/Dynamic trigger 与 Kinematic 对 Static 的非 trigger 盒都发 trigger Enter；Dynamic 对 Static 发 collision Enter，Cannon 同时派发手册连字符和兼容名。3.8 Bullet 经历 24 次 `AFTER_PHYSICS`，静态 trigger 无 Enter，Dynamic trigger 发 trigger Enter，Dynamic/Kinematic 对 Static 的非 trigger 盒都发 collision Enter。2.4 Cannon 的 Kinematic/Static 在 `external/cannon/cannon.js::Narrowphase.getContacts` 被归为 `justTest`；不能把这个后端细节套到 3.8 Bullet。相邻源码构建来源、Builtin 和原生仍未确认。

第三轮后端能力核对：2.4 与 3.8 的 **3D Builtin 都实现射线查询**，分别按查询组矩阵与位掩码过滤；本快照两者都未读取 `queryTrigger`。3.8 3D Builtin 把 `hitNormal` 填零向量。不要与 3.8 **2D** Builtin 的空 `raycast` 混淆。3.8 [几何投射手册](https://docs.cocos.com/creator/3.8/manual/zh/physics/physics-sweep.html)说明 sweep 公共接口，但源码中 Builtin/Cannon 的六个方法警告并返回 `false`，Bullet/PhysX 才有具体实现。Bullet 条件收集接触，PhysX 先缓冲原生回调再发事件；尚无跨后端运行时序证据。

第四轮 3.8 2D 后端核对：`box2d/`、`box2d-wasm/`、`box2d-jsb/` 的 `physics-contact.ts::emit` 均按至少一侧 `enabledContactListener` 决定是否发系统级事件；各自 `physics-world.ts::testPoint/testAABB` 均返回同一个模块级复用数组，并对多个 fixture 命中的同一 Collider 去重。此前只对 TypeScript Box2D 做出的结论现可扩展为本仓库三个 Box2D 包装器的**静态源码结论**，原生桥和实际预览仍待分别验证。

追加核对两版 Box2D 的监听登记时点：2.4 `CCPhysicsCollider` 与 3.8 三套 `shapes/shape-2d.ts` 都只在 fixture 建立时按当时的 `enabledContactListener` 登记，接触回调执行前再次按当前开关过滤。3.8 现有手动 Web 轨迹验证创建前开启监听可收到回调；“创建后才开启”仍无运行证据。2.4 [三组隔离传感器轨迹](../traces/2.4.15-stage9-2d-contact-web.jsonl)则显示始终关闭的 fixture 未登记且无回调，创建前开启的 A 已登记并收到 Begin、后续 End；创建后才开启的 A 属性为真但 fixture 未登记、没有回调。两版结果限于各自暂停游戏后的直接物理步进。

第五轮后端接线核对：2.4 3D 的 Cannon/Builtin `instantiate.ts` 各受构建宏控制，`CCDirector.sharedInit` 还按宏和管理器模块存在性决定是否创建管理器。3.8 的后端模块在 `Game.EVENT_PRE_SUBSYSTEM_INIT` 注册选择器，Director 初始化阶段构造系统和 World；3D 项目设置可关闭系统，Bullet/PhysX 与 2D Box2D WASM 构建可手动异步加载。3.8 2D `.instance` 会懒创建 World，3D `.instance` 仅返回已有单例；`PHYSICS_*` 标志只反映选择器 ID。诊断依次记录后端 ID、系统、World，不用 `selector.switchTo` 做只读识别：本快照 2D 切换没有销毁旧 World。此处全是源码推断，尚未观测示例的实际模块加载次序。

仓库现成的 `engine/3.8.7engine/tests/physics2d/scene-query.ts` 以 `result.length` 和 `result[0]` 使用 `testPoint`，支持“工程测试按数组签名编写”的判断；`physics2d.test.ts` 注册 Builtin、TypeScript Box2D 与 WASM 后端，但 `scene-query.ts` 和 `events.ts` 对 Builtin 明确跳过。尝试从引擎目录运行该聚焦 Jest 测试时，`node_modules/.bin/jest` 不存在（当前依赖目录没有 Jest 可执行文件），因此**没有获得测试通过结果**，也没有安装或修改依赖。

待验证矩阵：

| 版本 | 最小实验 | 必记字段 |
| --- | --- | --- |
| 2.4 简单 2D 碰撞 | 两个普通 Collider 相交、保持、分离；相交时禁用或改组 | CollisionManager 开关、组矩阵、Enter/Stay/Exit、事件发生的同步位置、节点和世界形状坐标 |
| 2.4 Box2D | 已测监听关闭、创建前开启、创建后开启三组传感器；源码显示 Scheduler 阶段接触回调位于组件 `update` 与 `lateUpdate` 之间，节点同步在 `World.Step` 后；自然帧 Begin、移动刚体 `update/lateUpdate` 回写，以及关闭/启用 Collider 重建 fixture 均已在当前 Web 后端测得 | Web 轨迹记录 fixture 登记状态、Begin/End；自然帧仍记 PhysicsManager 开关、frameRate、enabledAccumulator、Step 次数、回调与 `lateUpdate` 顺序及同步位置；注册探针对比只切字段与 Collider 关闭/重启 |
| 2.4 3D | Cannon 预览中 Collider/刚体与射线；连字符事件与兼容名称分别订阅；构建 Builtin 时另测射线 | 后端宏、管理器启用、世界射线、命中对象、两个事件名称的派发、contact 快照和同步位置；Builtin 的查询组与 `queryTrigger` 开关 |
| 3.8 Builtin 2D | 两个 Collider2D 相交、分离；接触中禁用/改组；射线穿过碰撞体；两个碰撞体覆盖一个点 | 后端 ID、组矩阵双向值、系统/组件 BEGIN/END、第三个参数、`raycast` 空数组、`testPoint` 类型/数量、查询数组复用、步数和节点坐标 |
| 3.8 Box2D 2D | 已测监听门槛、查询复用、当前 Web 移动刚体回写，以及 fixture 建立后只开监听与调用 `Collider2D.apply()`；WASM/JSB/原生仍待测 | 后端 ID、PRE/POST 是否出现、系统事件门槛、回调内 contact 副本、`testPoint` 类型/数量、查询数组复用、自然帧回调相对位置同步的顺序、fixture 登记状态 |
| 3.8 3D | 实际所选后端的 Collider/刚体和射线；Builtin 测查询掩码、`queryTrigger` 与法线；Bullet/PhysX 测 sweep | 后端 ID、`onTrigger…`/`onCollision…`、系统事件、事件/contact 与查询结果复用、射线/扫掠命中字段、可见模型与 Collider 区别 |

两套现有示例无物理组件。实验应以对应 Creator 创建可删除的最小对象或仅在预览内存中构造；未确认编辑器功能裁剪、实际后端和自定义引擎接线前，不把某个目录的代码当作预览实测实现。

两份页面内存探针分别是[2.4 点测试与普通碰撞](../probes/stage9-2d-query-contact-2.4.js)和[3.8 点测试与后端接触](../probes/stage9-2d-query-contact-3.8.js)。2.4 探针已根据首次 Static 空结果修订为无重力 Dynamic 传感器，并获得局部 Web 轨迹；3.8 探针已在 TypeScript Box2D Web 预览运行，数组返回及复用得到验证；无刚体的空接触列表不能证明监听门槛。它们均不能验证自然 Director 帧调度。

自然 Director 帧探针[2.4](../probes/stage9-natural-frame-2d-2.4.js)和[3.8](../probes/stage9-natural-frame-2d-3.8.js)已分别在 Web 预览运行并留下[2.4 轨迹](../traces/2.4.15-stage9-2d-natural-frame-headless-web.jsonl)、[3.8 轨迹](../traces/3.8.7-stage9-2d-natural-frame-headless-web.jsonl)。同帧 2.4 的顺序是 `BEFORE_UPDATE → Begin(A/B) → AFTER_UPDATE`；3.8 是 `BEFORE_UPDATE → AFTER_UPDATE → BEFORE_PHYSICS(2D) → Begin(A/B) → AFTER_PHYSICS(2D)`，之后还有当前 Bullet 3D 系统自己发的一对 Physics 标记。3.8 两个系统共用 Director 事件名，本次 `maxSubSteps=1`。节点保持静止，组件 `update/lateUpdate` 与物理回写位置仍未独立打点。

两版监听登记的补充探针分别是[2.4](../probes/stage9-2d-contact-registration-2.4.js)和[3.8](../probes/stage9-2d-contact-registration-3.8.js)。[2.4 当前 Box2D Web 轨迹](../traces/2.4.15-stage9-2d-listener-reenable-headless-web.jsonl)显示只切监听字段的 fixture 登记数为 0、无 Begin，关闭再启用 Collider 的登记数为 1、收到 Begin。[3.8 当前 TypeScript Box2D Web 轨迹](../traces/3.8.7-stage9-2d-listener-apply-headless-web.jsonl)在初始节点变换标志清零后，也显示只切字段无登记/Begin，调用 `Collider2D.apply()` 重建后登记数为 1、Collider 与系统均收到 Begin。两个探针都记录内部登记数量，采用暂停后的直接物理步进；WASM/JSB/原生与自然帧中重建后的时序仍须单独验证。

2026-10-04 更新：两套 Creator 预览可显示。Chrome DevTools 自动输入未能执行，因此在 2.4 工程的临时生成脚本末尾注入探针，仅供本次预览加载；Codex 内置浏览器读取到四轮日志。已按 SHA-256 `a8aa3011ee6698012a1dec9fa73549ebf4bb1c49de34e9488c045001d40b1d2e` 恢复生成脚本，关闭临时预览标签；示例源场景未改。用户随后明确要求转入阶段 10，阶段 9 保留未验证的 3.8、两版 3D、自然帧时序和 Box2D 接触监听项目，按需续做。

2026-10-05 补测：两版各运行[只读后端身份探针](../probes/stage9-backend-identity-2.4.js)，其中 3.8 对应[独立脚本](../probes/stage9-backend-identity-3.8.js)；[轨迹](../traces/stage9-backend-web.jsonl)记录 2.4 `CannonWorld` 存在但管理器关闭，3.8 的 TypeScript Box2D 与启用的 `BulletWorld`。3.8 [2D 查询探针](../probes/stage9-2d-query-contact-3.8.js)在当前 Box2D Web 预览得到[数组复用轨迹](../traces/3.8.7-stage9-2d-query-web.jsonl)。此前无刚体的空接触列表不能证明监听门槛。两版临时生成脚本已分别恢复 SHA-256 `a8aa3011ee6698012a1dec9fa73549ebf4bb1c49de34e9488c045001d40b1d2e`、`0e020cdb942e96e3269303eafc34a77dbe10aec3fba3e27d6da64a92bbc84d41`。

同日追加：[2.4 Cannon 射线探针](../probes/stage9-3d-raycast-2.4.js)与[3.8 Bullet 射线探针](../probes/stage9-3d-raycast-3.8.js)对同尺寸临时 Box Collider 取得[命中/未命中轨迹](../traces/stage9-3d-ray-web.jsonl)。两版正向射线命中距离约 9，偏移射线不命中；2.4 的 3D 管理器仅在探针期间启用。3.8 [接触监听探针](../probes/stage9-2d-contact-listener-3.8.js)在暂停游戏后直接步进 TypeScript Box2D：关闭监听的隔离刚体对未发事件，另一对仅 A 刚体开启监听便得到 A Collider 与系统的 Begin，禁用 B 后系统收到 End，详见[轨迹](../traces/3.8.7-stage9-2d-contact-web.jsonl)。这些记录不证明 2D 自然 Director 帧回调顺序或其他后端；当前 3D 事件另有上文的自然帧轨迹。预览引擎是否来自邻接源码构建也未确认。

2026-10-05 自然帧源码追踪：2.4 Director 普通循环将 Scheduler 放在组件 `update` 与 `lateUpdate` 之间；`CCPhysicsManager.update` 内先执行 Box2D `World.Step`（接触回调在此同步发生），后冲刷延迟操作并 `_syncNode`。3.8 则在 `AFTER_UPDATE` 与延迟销毁之后进入 PhysicsSystem `postUpdate`，接触回调在 `syncPhysicsToScene` 之前，并由 Director `BEFORE_PHYSICS/AFTER_PHYSICS` 包围。3.8 当前 TypeScript Box2D 另有[监听切换与 `apply()` 隔离轨迹](../traces/3.8.7-stage9-2d-listener-apply-headless-web.jsonl)：节点变换标志清零后，只切字段不登记且无 Begin，`apply()` 重建后登记并派发 Collider/系统 Begin。两版已有上述静止传感器的自然帧标记与 Begin 顺序轨迹；另有[2.4 移动刚体轨迹](../traces/2.4.15-stage9-2d-moving-sync-headless-web.jsonl)与[3.8 移动刚体轨迹](../traces/3.8.7-stage9-2d-moving-sync-headless-web.jsonl)。初始重叠的移动传感器在 2.4 首帧 `update/Begin` 读旧位置、同帧 `lateUpdate` 读回写位置；3.8 首帧 `update/lateUpdate/Begin` 读旧位置、2D `AFTER_PHYSICS` 才读回写位置，下一帧 `update` 读到它。初始重叠的 Begin 尚不能代表所有后来发生的碰撞。临时改写的 2.4 生成脚本已恢复并核对 SHA-256 `a8aa3011ee6698012a1dec9fa73549ebf4bb1c49de34e9488c045001d40b1d2e`；此前 Chrome DevTools 控制台输入及刷新注入未成功，因此那轮尝试没有记成运行结果；后续独立无头 Chrome 轨迹已另行落盘。
