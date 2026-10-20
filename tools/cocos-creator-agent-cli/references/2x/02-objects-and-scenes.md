# 2.4.15：节点、组件、场景与预制体

## 范围与证据

本篇研究 `2.4.15engine/` 的 Web 运行时对象模型，并用 `2.4.15NewProject/` 和 Creator 2.4.15 浏览器预览核对。编辑器预览中临时注入了内存中的预制体、组件和节点；[原始事件记录](../agent-foundation/traces/2.4.15-object-scene.jsonl)来自一次实际运行，工程和引擎源码均未修改。工作区的 `CCNode.js`、`base-node.js`、`CCComponent.js`、`node-activator.js` 与已安装编辑器中的对应文件 SHA-256 一致。对象序列化与资源释放的完整机制留到阶段 4，每帧组件调度留到阶段 3。

## 2.4 官网手册校准

| 手册中的开发者行为 | 对应证据及边界 |
| --- | --- |
| [节点和组件](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/node-component.html)以节点承载组件、通过组合提供功能；[常用接口](https://docs.cocos.com/creator/2.4/manual/zh/scripting/basic-node-api.html)区分节点自身的 `active` 与当前场景层级中的 `activeInHierarchy`。 | 下文的 `cc._BaseNode`、`cc.Node`、`cc.Component` 是这一公开对象模型在 2.4.15 源码中的实现。脱离场景的克隆 `active=true`、`activeInHierarchy=false` 与手册一致。 |
| [创建和销毁节点](https://docs.cocos.com/creator/2.4/manual/zh/scripting/create-destroy.html)将 `cc.instantiate(prefab)` 与设置父节点列为两个操作；[预制资源](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/prefab.html)是可复用节点模板。 | 实测克隆、挂组件、入场是三个不同转换。内存预制体只验证运行时路径；手册中的编辑器拖拽、实例属性覆盖、手动/自动同步（默认手动）尚未做编辑器操作验证，不能由此实验推断。 |
| [生命周期回调](https://docs.cocos.com/creator/2.4/manual/zh/scripting/life-cycle-callbacks.html)说明首次激活时 `onLoad`、之后的 `onEnable`、失活时 `onDisable`，并在销毁流程中调用 `onDestroy`。 | 本次 Chrome 预览测得入场时 `onLoad → onEnable`，反激活时 `onDisable`。多组件间的完整调度顺序仍属阶段 3，不由这次单组件实验确定。 |
| [销毁节点](https://docs.cocos.com/creator/2.4/manual/zh/scripting/create-destroy.html)说明 `destroy()` 后节点在当前帧逻辑更新结束时统一移除，可用 `cc.isValid` 判断。 | 源码及探针进一步区分待销毁与已清理：`destroy()` 返回时普通有效性检查仍为真、严格检查为假，延迟销毁后普通检查才为假。手册的概括描述不保证调用当下两种检查结果相同。 |
| [加载和切换场景](https://docs.cocos.com/creator/2.4/manual/zh/scripting/scene-managing.html)给出 `cc.game.addPersistRootNode` 作为场景切换时保留节点的公开入口。 | 下文登记和重接节点的细节来自源码；本阶段没有做跨场景运行实验。常驻节点的资源引用与释放后续仍需阶段 4 验证。 |

手册说明公开用法，未规定 `Prefab.data` 的 JIT 阈值、`PrefabInfo.sync` 内部结构、`NodeActivator` 的批处理或 `isValid` 严格模式的这次具体时序；这些结论分别来自源码和注明环境的打点。

## 对象地图

```text
cc.Object
├─ cc._BaseNode：父子关系、组件列表、active、prefab 元数据
│  └─ cc.Node：2D/3D 变换、渲染标记、事件与 ActionManager 接线
│     └─ cc.Scene：场景根、加载后的批量初始化、整棵树激活
├─ cc.Component：附着于 Node，维护 enabled 与生命周期状态
└─ cc.Asset
   └─ cc.Prefab：以 data 节点树为模板，提供实例化策略
```

`utils/base-node.js:135-156` 保存 `_parent`、`_children`、`_components`、`_active` 与 `_prefab`；`CCNode.js:854-855,1641-1665` 在其上加入变换与渲染相关实现。`CCComponent.js:43-78,149-204` 表明组件独立继承 `cc.Object`，通过 `node` 指向所属节点，`enabled` 是组件自身开关；实际生效还要满足节点的 `activeInHierarchy`。`CCScene.js:35-63` 是特殊 `cc.Node`，不是普通节点集合外的另一个容器。

直接 `new cc.Node(name)` 经 `BaseNode.ctor` 设置名称、运行时 ID 和初始 `activeInHierarchy=false`（`utils/base-node.js:313-325`）；`_active` 默认是 true，但新节点尚未进入活动场景。组件由 `Node.addComponent` 创建并绑定到节点，不需要开发者单独调用组件构造函数。

示例的 `helloworld.fire` 是一组带 `__type__`、对象引用和属性的记录：顶层有 `cc.SceneAsset` 与 `cc.Scene`，包含 5 个 `cc.Node` 和 Camera、Canvas、Label、Sprite 等组件；`HelloWorld.js` 所在脚本组件以脚本类 ID 记录。**场景文件中的对象记录数不等于运行时层级节点数**，不能靠 JSON 数组位置代替父子和组件引用来判断层级。

## 从预制体到活动节点

开发者可见操作是 `cc.instantiate(prefab)`、`node.addComponent(MyComponent)`、`node.parent = scene`。源码中的关键跳转如下：

1. `platform/instantiate.js:56-110` 检查对象有效性；遇到 `cc.Prefab` 调用其 `_instantiate()`。`assets/CCPrefab.js:75-120,167-198` 的 `data` 是根节点，按优化策略选择通用克隆或 JIT 创建；AUTO 从第三次实例化开始选择 JIT（以支持 JIT 为前提）。它创建的是独立节点树，不会自动把根节点放进场景。
2. 节点克隆落在 `utils/base-node.js:1178-1230` 的 `_instantiate()`：重置克隆根的父节点并调用 `_onBatchCreated()`。`CCNode.js:1906-1940` 在批量初始化中准备属性、事件/动作状态、子节点及可同步的子预制体。这里尚未因为 `active: true` 而具有 `activeInHierarchy: true`。
3. `utils/base-node.js:892-956` 的 `addComponent()` 校验类型与依赖，创建组件并写入 `_components`；只有节点已在活动层级时才立即交给 `NodeActivator.activateComp()`。无父节点的克隆不会在此时执行 `onLoad`。
4. `node.parent = scene` 进入 `BaseNode.setParent()`（`:360-407`），更新父子列表并调用层级变化钩子；`CCNode._onHierarchyChanged()`（`CCNode.js:1758-1784`）最终走到 `BaseNode._onHierarchyChanged()`（`utils/base-node.js:1112-1176`），计算新父节点的活动状态并交给 `NodeActivator.activateNode()`。
5. `node-activator.js:160-198,240-270,313-350` 先递归标记 `_activeInHierarchy`，收集整棵树的 `__preload`、`onLoad`、`onEnable`，再按这三个批次执行。组件的 `onLoad` 只在首次激活时执行一次；`onEnable` 可随节点再次启用而重进。更细的组件执行顺序由 `component-scheduler.js` 处理，留在下一阶段展开。

场景本身由 `CCScene._load()` 做批量初始化，再由 `_activate()` 把根交给 `NodeActivator`（`CCScene.js:84-104`）。阶段 1 已验证 `Director.runSceneImmediate()` 调用 `_load()`、设置当前场景并执行 `_activate()`（`CCDirector.js:422-490`）。因此预制体实例化、成为场景子节点、首次激活是三个不同操作。

场景切换默认销毁旧场景及其子树；常驻节点是显式例外。`cc.game.addPersistRootNode(node)`（`CCGame.js:508-532`）要求节点处于场景根层级，必要时把无父节点接到当前场景，并登记 `_persistNode` 与资源引用。`Director.runSceneImmediate()`（`CCDirector.js:431-459`）在销毁旧场景前把这些节点转接到新场景。常驻的是登记过的根节点及其子树，不是任意设置了 `active=true` 的节点。

## 关闭与销毁

`active` 是节点自身状态；`activeInHierarchy` 还取决于父链（`utils/base-node.js:278-310`）。关闭活动节点时，`node-activator.js:204-239` 先把本节点标记为非活动，再禁用组件，递归处理活动子节点。组件 `enabled` 的 setter 只在所属节点活动时调用调度器（`CCComponent.js:160-181`）。

`node.destroy()` 在 `BaseNode.destroy()`（`utils/base-node.js:1084-1088`）先调用 `cc.Object.destroy()` 标记延迟销毁，再把 `active` 设为 false，因此活动组件会立即 `onDisable`。`CCObject.js:194-218,306-315,490-505` 在帧内稍后执行 `_deferredDestroy()`；`CCNode._onPreDestroy()`（`CCNode.js:1690-1737`）委托 `BaseNode._onPreDestroyBase()`（`utils/base-node.js:1237-1280`）立即销毁子节点和组件，并从父列表移除。组件 `_onPreDestroy()`（`CCComponent.js:503-529`）清理定时器/事件，调用 `NodeActivator.destroyComp()`；只有曾完成 `onLoad` 的组件才会执行 `onDestroy`（`node-activator.js:354-370`）。

本次预览探针的实际顺序是：

```text
instantiate：克隆含 1 个子节点，active=true、activeInHierarchy=false、无父节点
addComponent：组件指向克隆节点，尚无生命周期回调
parent=scene：onLoad → onEnable → parent 赋值语句返回
active=false：onDisable → 赋值语句返回
active=true：onEnable → 赋值语句返回
destroy()：onDisable → destroy 返回；普通 isValid=true，严格 isValid=false
延迟销毁：onDestroy；随后普通 isValid=false，场景 children 不再含该节点
```

这是一次浏览器预览观测；毫秒数和具体帧间隔不是 API 保证。严格有效性检查来自 `CCObject.js:551-565`。调试“销毁后仍可访问”时，应区分已标记待销毁和真正执行 `_onPreDestroy()`。

## 面向游戏开发的判断

- 预制体的 `data` 是节点模板；实例化不是入场。把克隆留在场景外可以配置属性，但组件的运行时初始化要等到它进入活动层级。
- 组件 `enabled=true` 不能覆盖父节点失活。排查不执行的脚本时同时查 `node.active`、父链、`activeInHierarchy` 与 `component.enabled`。
- 2.x `setParent` 会调整层级与激活，并连带更新渲染/事件状态；不要通过修改 `_parent` 或 `_children` 绕过它。
- `PrefabInfo` 记录 asset/root/fileId/sync（`utils/prefab-helper.js:28-47`），子预制体同步会在 `_onBatchCreated()` 中进入 `PrefabHelper.syncWithPrefab()`；编辑器内 prefab 的保存与覆盖规则需要结合 Creator 编辑器实现和阶段 4 的序列化研究。
