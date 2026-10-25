# 3.8.7：节点、组件、场景与预制体

## 范围与证据

本篇研究 `engine/3.8.7engine/cocos/` 的对象模型，并以 `3.8,7NewProject/` 的当前场景预览核对。预览中临时注入内存预制体、组件和节点；[原始事件记录](../agent-foundation/traces/3.8.7-object-scene.jsonl)来自一次 Chrome 图形预览，工程和引擎源码均未修改。工作区的 `node.ts`、`component.ts`、`scene.ts`、`node-activator.ts` 与已安装编辑器中的对应文件 SHA-256 一致。序列化及资源释放的完整机制留到阶段 4，组件每帧调度留到阶段 3。`native/cocos/` 中对应的原生实现尚未在本篇验证。

## 3.8 官网手册校准

| 手册中的开发者行为 | 对应证据及边界 |
| --- | --- |
| [节点和组件](https://docs.cocos.com/creator/3.8/manual/zh/concepts/scene/node-component.html)把节点描述为树形层级和组件的载体；[常用接口](https://docs.cocos.com/creator/3.8/manual/zh/scripting/basic-node-api.html)区分 `active` 与 `activeInHierarchy`。 | 下文的 `Node`、`Component`、`Scene` 是 3.8.7 的实现。脱离场景的克隆即使 `active=true` 也尚未激活，与手册一致。`Scene.addComponent()` 直接抛错是源码中的额外约束，不能仅凭手册的“节点承载组件”推定场景根也能挂脚本。 |
| [预制件](https://docs.cocos.com/creator/3.8/manual/zh/asset/prefab.html)区分预制件资源、实例、嵌套实例和实例自身的覆盖；新增节点/组件、删除组件和属性修改可保存在实例中。 | 示例 `main.scene` 的 `PrefabInstance` 与覆盖记录支持这种结构；直接数 JSON 中的 `cc.Node` 不足以还原展开后的场景。手册描述的编辑器保存、还原和更新操作未由本次内存预制体实验验证。手册中的 Prefab `Persistent` 选项是引擎预留项，不等于跨场景常驻节点。 |
| [创建和销毁节点](https://docs.cocos.com/creator/3.8/manual/zh/scripting/create-destroy.html)明确 `new Node` 不会自行入场，`instantiate(prefab)` 后也需把克隆接入场景；[生命周期回调](https://docs.cocos.com/creator/3.8/manual/zh/scripting/life-cycle-callbacks.html)说明首次激活时 `onLoad`、随后 `onEnable`，反激活时 `onDisable`。 | 本次 Chrome 预览测得脱离场景时无组件回调，接入场景时 `onLoad → onEnable`。多组件的精确执行次序与每帧调度留到阶段 3。 |
| [销毁节点](https://docs.cocos.com/creator/3.8/manual/zh/scripting/create-destroy.html)说明 `destroy()` 在当前帧逻辑更新结束后统一移除，并用有效性检查判断节点。 | 本次源码和打点进一步区分待销毁与已清理：`destroy()` 返回时普通检查仍为真、严格检查为假；延迟销毁后普通检查才为假。手册没有给出这次调用内的严格模式时序。 |
| [加载和切换场景](https://docs.cocos.com/creator/3.8/manual/zh/scripting/scene-managing.html)以 `director.addPersistRootNode` 说明跨场景常驻节点。 | 下文的 `_originalSceneId`、同 UUID 冲突处理与根节点限制由源码支持，未在本阶段做场景切换实验。它们与 Prefab 的预留 `Persistent` 选项无关。 |

手册没有规定 `Prefab.data` 的 JIT 阈值、`PrefabInstance` 的序列化字段、嵌套展开函数或 `NodeActivator` 内部批次；这些是 3.8.7 源码结论。`setParent(..., true)` 保留世界变换的具体路径也仅做源码核对，未纳入本次预览测量。

## 对象地图

```text
CCObject
├─ Node：父子关系、组件列表、活动状态、3D 变换、事件处理器、所在 Scene
│  └─ Scene：场景根、RenderScene、SceneGlobals、预制体展开入口
├─ Component：附着于 Node，维护 enabled 与生命周期状态
└─ Asset
   └─ Prefab：以 data 节点树为模板，提供实例化策略
```

`scene-graph/node.ts:107-113,373-407` 明确 `Node extends CCObject`，在类内保存父子、组件、`_prefab`、`_scene` 和 `_activeInHierarchy`。局部位置/旋转/缩放、层与 UI 状态也在 Node 自身（`:1596-1640`）；事件由 `NodeEventProcessor` 承担（`:403-409`）。`component.ts:54-85,125-158` 的组件另行继承 `CCObject`，通过 `node` 关联节点。`enabledInHierarchy` 同时依赖组件开关和节点活动状态。

直接 `new Node(name)` 由字段初值建立无父节点、`active=true`、`activeInHierarchy=false` 的对象，并在构造函数里准备本地和世界变换数据（`node.ts:373-407,1628-1661`）。组件由 `Node.addComponent` 创建并绑定到节点，开发者不需要手动构造后塞进 `_components`。

`scene.ts:45-101` 的 `Scene extends Node`，拥有 `RenderScene` 与 `SceneGlobals`，把自身作为 `_scene` 根；它的 `addComponent()` 明确抛错（`:117-131`），场景根不是普通脚本组件挂载点。`Scene._load()`（`:173-190`）先展开嵌套预制体、应用目标覆盖、初始化节点树并设置各节点的所属场景；`Scene._activate()`（`:194-205`）再交给 `NodeActivator`，并激活场景级全局渲染数据。

示例 `main.scene` 的 JSON 顶层有 `cc.SceneAsset`、`cc.Scene`、5 个直接序列化的 `cc.Node`，同时记录 3 个 `cc.PrefabInstance`、41 个 `CCPropertyOverrideInfo` 与 16 个 `cc.TargetOverrideInfo`。这些实例分别引用 `islands.prefab`、`soldier.prefab` 与 `grassGoup.prefab` 的 UUID；因此直接计数场景 JSON 中的 `cc.Node` 会漏掉预制体展开后的节点。场景记录与运行时场景树不是简单的一条数组对应关系。

## 从预制体到活动节点

开发者可见操作是 `instantiate(prefab)`、`node.addComponent(MyComponent)`、`node.parent = scene`。源码中的关键跳转如下：

1. `serialization/instantiate.ts:74-148` 检查输入并调用 Prefab 的 `_instantiate()`。`scene-graph/prefab/prefab.ts:89-114,165-218` 的 `data` 是节点模板；AUTO 策略在支持 JIT 时从第三次实例化开始选择编译后的创建函数。`Prefab._instantiate()` 返回节点树，不负责挂到当前场景。
2. 节点克隆的 `_instantiate()` 在 `node.ts:1434-1456` 重置克隆根父节点并执行批量初始化；`_onBatchCreated()` 标记变换脏、更新子节点索引（`:2134-2147`）。场景加载时另有嵌套预制体展开路径：`Scene._load()` 调用 `expandNestedPrefabInstanceNode()`、`applyTargetOverrides()`（`scene.ts:173-183`）；`prefab/utils.ts:46-107,317-450` 依据 `PrefabInfo`、`PrefabInstance`、fileId/TargetInfo，把资产节点和场景覆盖组合起来。运行时实例化一个 Prefab 与从场景文件恢复带覆盖的实例，是相关但不相同的路径。
3. `Node.addComponent()`（`node.ts:1062-1141`）校验类型与必需组件，创建组件并写入 `_components`，发 `COMPONENT_ADDED`；只在节点已活动时立即调用 `NodeActivator.activateComp()`。它对无效类型抛 `TypeError`。在当前代码中，`_requireComponent` 可处理数组，需结合具体组件声明核对依赖。
4. `Node.setParent()`（`node.ts:492-552`）维护两端 children、兄弟索引并发父子变化事件；进入具有场景引用的新父链时更新 `_scene`，`_onHierarchyChanged()`（`:2125-2130`）进一步更新事件处理器和活动层级。传入 `keepWorldTransform=true` 会在变更父节点时重算局部变换（`:492-550,2075-2123`）。直接写内部 `_parent` 会跳过这些维护步骤。
5. `NodeActivator.activateNode()`（`node-activator.ts:158-183`）递归设置 `activeInHierarchy`，收集并依次调用 preload、onLoad、onEnable；`activateComp()`（`:195-233`）确保首次加载标记与启用检查。组件 `onLoad` 只在首次进入活动层级时执行一次，`onEnable` 可重复执行。更细的同帧顺序由下一阶段研究。

场景切换默认销毁旧场景及其子树；常驻节点是显式例外。3.8.7 的公开入口在 `director.addPersistRootNode(node)`（`director.ts:878-905`），`game.addPersistRootNode` 仅保留兼容委托（`game.ts:1129-1133`）。它要求节点位于场景根层级，记录 `_originalSceneId` 并增加资源引用；`Director.runSceneImmediate()`（`director.ts:416-443`）在切换时把节点转接到新场景，并处理新场景里同 UUID 的节点。常驻的是登记过的根节点及其子树，不是任意设置了 `active=true` 的节点。这条路径本阶段由源码确认，未做场景切换运行实验。

## 关闭与销毁

`Node.active` 是本地状态；只有父节点在活动层级时，setter 才触发本节点的递归激活/反激活（`node.ts:187-225`）。关闭活动节点时，`node-activator.ts:288-326` 禁用组件和活动子节点。组件 `enabled` setter 在所属节点活动时通知调度器（`component.ts:129-150`）。

`Node.destroy()`（`node.ts:1367-1374`）先通过 `CCObject.destroy()` 标记延迟销毁，再设 `active=false`，活动组件因此立即 `onDisable`。`core/data/object.ts:173-187,298-323,370-389` 的 `_deferredDestroy()` 在帧内稍后执行真正清理。`Node._onPreDestroyBase()`（`node.ts:1493-1550`）从父层级移除节点，发 `NODE_DESTROYED`，销毁事件处理器，再立即销毁子节点和组件。组件 `_onPreDestroy()`（`component.ts:405-416`）取消调度、调用 `NodeActivator.destroyComp()` 并脱离节点；`destroyComp()` 只对曾完成 `onLoad` 的组件调用 `onDestroy`（`node-activator.ts:238-247`）。

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

严格有效性检查见 `core/data/object.ts:619-658`。这个顺序来自一次浏览器预览；毫秒数与具体帧间隔不是 API 保证。

## 面向游戏开发的判断

- `Node` 同时承担层级、3D 变换和组件容器职责；`Scene` 另连到 `RenderScene` 与场景全局数据。调试“对象在层级里却不显示”需要分别核查活动状态、变换和渲染组件。
- 预制体资产根节点、场景中的预制体实例与运行时克隆要分开判断。场景文件的覆盖信息通过 `PrefabInstance` 等记录，不能通过直接编辑 JSON 数组位置推断最终层级。
- 3.x `setParent(..., true)` 明确提供保留世界变换的选择；进入新父链时还会按条件更新场景引用和事件处理器。使用公开 API，避免直接改内部字段。
- `Scene` 不能直接挂组件；脚本组件应挂在其子节点。排查生命周期未触发时先检查节点是否真正接入活动场景，再检查 `Component.enabled`。
