# 相同行为对照：实例化预制体、挂载组件并销毁节点

先阅读 [2.x 独立分析](../2.x/02-objects-and-scenes.md) 和 [3.x 独立分析](../3.x/02-objects-and-scenes.md)。本篇对照同一段开发行为在两代源码中的入口、状态变化和差异；两次浏览器预览的[2.x](../agent-foundation/traces/2.4.15-object-scene.jsonl)与[3.x](../agent-foundation/traces/3.8.7-object-scene.jsonl)记录提供运行证据。

## 官网行为基线与适用范围

两版[节点和组件（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/node-component.html)、[节点和组件（3.8）](https://docs.cocos.com/creator/3.8/manual/zh/concepts/scene/node-component.html)手册都以节点承载组件和层级组织内容；[创建节点（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/scripting/create-destroy.html)、[创建节点（3.8）](https://docs.cocos.com/creator/3.8/manual/zh/scripting/create-destroy.html)均把实例化与接入场景分开。两版[节点接口（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/scripting/basic-node-api.html)、[节点接口（3.8）](https://docs.cocos.com/creator/3.8/manual/zh/scripting/basic-node-api.html)也明确区分 `active` 与 `activeInHierarchy`。这些公开行为与两次浏览器预览一致；下表的类继承、内部字段和批处理顺序仍是具体源码结论。

预制体的编辑器规则需要按版本分开读：[2.4 预制资源](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/prefab.html)有手动/自动同步，默认手动；[3.8 预制件](https://docs.cocos.com/creator/3.8/manual/zh/asset/prefab.html)说明实例覆盖、嵌套实例及新增/删除组件等编辑操作。两次内存预制体实验验证的是运行时克隆与激活，不验证上述编辑器保存、还原或同步流程。

```text
创建 Prefab(data=Node树) → instantiate → addComponent → parent=当前 Scene
                                                   → active=false → active=true → destroy
```

| 观察点 | 2.4.15 | 3.8.7 |
| --- | --- | --- |
| 节点结构 | `cc._BaseNode` 管理层级、组件、活动与 prefab 信息；`cc.Node` 扩充变换、事件和渲染状态（`utils/base-node.js:135-156`、`CCNode.js:854-855,1641-1665`）。 | `Node` 直接继承 `CCObject`，类内同时包含层级、组件、3D 变换、事件处理器与 `_scene` 引用（`node.ts:107-113,373-409,1596-1640`）。 |
| 场景根 | `cc.Scene extends cc.Node`，通过 `_load()` 与 `_activate()` 批量初始化和激活（`CCScene.js:35-104`）。 | `Scene extends Node`，另有 `RenderScene`、`SceneGlobals` 与嵌套预制体展开；明确拒绝在 Scene 上直接 `addComponent()`（`scene.ts:45-131,173-205`）。 |
| 预制体资产 | `cc.Prefab.data` 是根节点；AUTO/JIT 优化从第三次实例化可生效，子 prefab 的 `sync` 由批量初始化处理（`CCPrefab.js:75-198`、`CCNode.js:1906-1940`）。 | `Prefab.data` 同样是根节点，也有 AUTO/JIT 策略；场景实例的 `PrefabInstance` 明确记录挂载节点/组件、属性覆盖和删除组件（`prefab.ts:75-199`、`prefab-info.ts:149-249`）。 |
| `addComponent` | 创建组件后写入 `_components`；节点已活动才立刻激活组件。必需组件入口是一个 `_requireComponent`（`utils/base-node.js:892-956`）。 | 相同的活动条件，同时发 `COMPONENT_ADDED`；无效类型抛 `TypeError`，`_requireComponent` 路径可接受数组（`node.ts:1062-1141`）。 |
| 改父节点 | `setParent(value)` 维护父子、渲染与事件状态，再根据新父链调整激活（`utils/base-node.js:360-407,1112-1176`）。 | `setParent(value, keepWorldTransform)` 还维护兄弟索引、进入新父链时按条件更新 Scene 引用及事件处理器，并可重算局部变换以保留世界变换（`node.ts:492-552,2075-2130`）。 |
| `removeFromParent` 用法 | 手册要求需要保留事件与 action 时显式传 `false`；不传时 `cleanup=true`（`utils/base-node.js:668-689`）。 | 手册与源码均使用无参数 `removeFromParent()`，内部通过 `removeChild` 更新父关系（`node.ts:786-813`）。 |
| 场景切换中的常驻根 | `game.addPersistRootNode` 登记场景根子节点；切换场景时重接到新场景（`CCGame.js:508-532`、`CCDirector.js:431-459`）。 | `director.addPersistRootNode` 是当前入口，`game` 同名方法是兼容委托；另记录 `_originalSceneId` 并处理目标场景中同 UUID 节点（`director.ts:416-443,878-923`）。 |
| 销毁 | `cc.Object.destroy()` 标记待销毁；节点立即失活，随后 deferred destroy 清理子树和组件（`CCObject.js:194-218,306-315`、`utils/base-node.js:1084-1088,1232-1280`）。 | `CCObject.destroy()` 也先标记；节点立即失活，随后 deferred destroy 清理子树和组件，额外发 `NODE_DESTROYED` 并销毁节点事件处理器（`object.ts:173-187,298-323`、`node.ts:1367-1374,1493-1550`）。 |

## 两次预览共同测得的行为

两边运行时探针都观测到同一顺序：克隆初始 `active=true` 但 `activeInHierarchy=false`；脱离场景时 `addComponent` 不触发生命周期；设 `parent=scene` 同步触发 `onLoad → onEnable`；关闭、重新打开节点分别触发 `onDisable`、`onEnable`；调用 `destroy()` 同步触发 `onDisable`，稍后的延迟销毁执行 `onDestroy`。`destroy()` 返回后普通 `isValid()` 暂时仍为真，严格模式立即为假，延迟销毁后普通模式也为假。

这解释了一个实际排查顺序：**先看对象是否在活动场景树中，再看组件自身是否 enabled，最后看是否已经进入待销毁状态。** 只看到 `node.active=true`、组件存在或 `isValid()` 暂时为真，都不足以证明它会继续执行回调。

两版[生命周期手册（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/scripting/life-cycle-callbacks.html)、[生命周期手册（3.8）](https://docs.cocos.com/creator/3.8/manual/zh/scripting/life-cycle-callbacks.html)说明 `onLoad`、`onEnable`、`onDisable`、`onDestroy` 的触发条件；[销毁节点（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/scripting/create-destroy.html)与[销毁节点（3.8）](https://docs.cocos.com/creator/3.8/manual/zh/scripting/create-destroy.html)以“当前帧稍后移除”描述销毁。普通与严格 `isValid` 在调用当下的差别是本次源码与探针进一步确认的细节，不应读成手册保证的每个平台精确时序。

## 不应直接等同的部分

- 3.x 示例 `main.scene` 直接序列化的 `cc.Node` 数量少，但有 3 个预制体实例和大量覆盖记录；2.x 的 `helloworld.fire` 直接保存节点与组件记录。比较场景复杂度时应以展开后的运行时树为准，不能比较 JSON 顶层条目数。
- 3.x Scene 与渲染层 `RenderScene`、`SceneGlobals` 直接关联；2.x 本阶段的 `cc.Scene` 主要是 Node 的特殊根。两代的“Scene”不是相同的内部职责集合。
- 2.x 的 `PrefabInfo.sync` 与 3.x 的 `PrefabInstance`/覆盖记录表达方式不同。修改 prefab 实例或场景文件时，应按各自编辑器生成的结构维护引用；阶段 4 再深入序列化与资源身份。

本阶段的实例化、激活与销毁验证发生在两套编辑器浏览器预览；常驻根跨场景行为由源码追踪支持，本轮没有单独运行实验。两版[场景加载手册（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/scripting/scene-managing.html)、[场景加载手册（3.8）](https://docs.cocos.com/creator/3.8/manual/zh/scripting/scene-managing.html)分别给出 `game.addPersistRootNode`、`director.addPersistRootNode` 的公开入口。原生对象桥接、完整 prefab 编辑器工作流与组件每帧执行次序分别留给阶段 10、4、3。
