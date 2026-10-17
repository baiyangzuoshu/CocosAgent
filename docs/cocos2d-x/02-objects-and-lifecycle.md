# Cocos2d-x 4.0：Scene、Node、Component 与对象生命周期（源码静态追踪）

## 范围与证据状态

本文依据本地 `cocos2d-x-4/` 的 C++ 源码，追踪 Scene/Node 树建立、Node 入场/离场、Component 挂载/更新/移除，以及 `Ref` 与 autorelease 的所有权边界。Creator 2.4.15 一侧已分别有[对象与场景源码分析](../2.x/02-objects-and-scenes.md)、[跨版本对照](../comparisons/02-objects-and-scenes.md)和浏览器预览轨迹；本轮只复用 2.4.15 证据，没有对 Cocos2d-x 做等价运行实验。

## Scene graph 构造

模板 `HelloWorld::createScene()` 创建 `Scene` 与游戏 Layer，并调用 `addChild` 建立父子关系；`AppDelegate` 之后把 Scene 交给 Director。`Node::addChildHelper()` 检查 child 当前无父节点且不构成环，插入 children、设定 z-order/name 和 parent。如果 parent 已经 running，新增 child 会立即收到 `onEnter()`，场景转场已完成时还会收到 `onEnterTransitionDidFinish()`（`cocos/2d/CCNode.cpp:904-972`）。

`Scene` 是 `Node` 派生类。构造/初始化路径会创建并加入默认 Camera（`cocos/2d/CCScene.cpp:61-63` 等）。这说明 Cocos2d-x Scene 是运行时对象图，而不是 Creator `.fire` 场景文件的同构序列化载体。

## Component 支持

Cocos2d-x 4.0 **也有 Component 系统**：`cocos/2d/CCComponent.h` 定义继承 `Ref` 的 `Component`，持有 owner Node、name、enabled，并公开 `onAdd`、`onEnter`、`onExit`、`onRemove`、`update`。`ComponentContainer::add()` 对组件 `retain()`、设 owner 并调用 `onAdd()`；remove 调用 `onRemove()`、清空 owner 并 `release()`。Node 的 `onEnter/onExit/update` 会委托给容器，`Node::update()` 调用容器更新组件。

一个容易误读的细节：当前 `Component::setEnabled()` 只更新 `_enabled` 字段；`ComponentContainer::visit()` 遍历组件并直接调用 `update()`，没有在该循环里检查 `_enabled`。因此不能只凭属性名推断它等价于 Creator 的 `Component.enabled` 调度门槛；需继续追模板使用方式和版本实现，必要时运行验证。

所以“Creator 有组件、Cocos2d-x 没组件”是错误概括。差异在于这两个组件体系的脚本生命周期、编辑器创建/序列化方式、调度入口和对象内存所有权都不同。Cocos2d-x `Component` 有效实现及 `ComponentContainer` 见 `cocos/2d/CCComponent.{h,cpp}`、`CCComponentContainer.cpp` 和 `CCNode.cpp`。

## 生命周期和释放路径

### Cocos2d-x C++ 栈

- `Ref` 创建时引用计数为 1；`retain()` 增加引用，`release()` 减至 0 时 `delete this`；`autorelease()` 将对象排入当前 autorelease pool。`AutoreleasePool::clear()` 在清理时对排队对象逐个 `release()`。
- `Node::removeFromParent()` 默认委托 `removeFromParentAndCleanup(true)`。运行中的父节点移除 child 时，`detachChild()` 先调用 `onExitTransitionDidStart()`、`onExit()`，再按 `cleanup` 参数调用 `cleanup()`，最后清 parent 并从 children 向量移除。清理会停止 Actions 与 scheduled callbacks，并递归到子节点。
- `removeFromParent`/`cleanup` 表示从场景树脱离与停止关联行为；本身不等于在该调用点立刻析构对象。是否最终析构仍由 C++ 引用计数决定。
- Node 析构时移除 Components、停止 Actions/调度回调，并从 EventDispatcher 移除以 Node 为 target 的监听器；Node `cleanup()` 中的旧事件监听器移除逻辑因历史兼容被注释，不能把 cleanup 和 destructor 混为一谈。
- Node `onEnter/onExit` 与 Creator Component 的 `onLoad/onEnable/onDisable/onDestroy` 不是一对一生命周期。Cocos2d-x Component 有自己的 `onAdd/onEnter/onExit/onRemove/update`，其析构仍受 `Ref` 所有权约束。

关键源码：`cocos/base/CCRef.cpp:46-160`、`CCAutoreleasePool.cpp:59-78`、`cocos/2d/CCNode.cpp:150-228,920-972,986-1114,1271-1392`、`cocos/2d/CCComponent.h:46-90`、`CCComponentContainer.cpp:55-148`。

### Creator 2.4.15 JS 栈

Creator `cc.Object.destroy()` 先加 `ToDestroy` 标志并加入延迟销毁队列；帧内稍后 `_deferredDestroy()` 执行 `_destroyImmediate()`。Node/Component 的 `_onPreDestroy()` 负责清理子节点、Actions、调度和事件，再由 node activator 执行组件 `onDestroy`。其组件生命周期包括 `onLoad/start/onEnable/update/lateUpdate/onDisable/onDestroy`，`destroy()` 调用时可能尚未立即完成对象销毁。

这套 Creator 行为已有 2.4 Chrome 预览的创建、入场、停用、destroy/有效性检查轨迹。具体顺序以[2.x 对象研究](../2.x/02-objects-and-scenes.md)及[对照记录](../comparisons/02-objects-and-scenes.md)为准。

## 两边差异的实际影响

| 操作意图 | Cocos2d-x 4.0 | Creator 2.4.15 | 排查/移植时的风险 |
| --- | --- | --- | --- |
| 把行为挂到对象 | Node 的 ComponentContainer 保持 `Ref` 所有权、owner 关系，调用 `onAdd`；也可通过 Node 子类承载行为。 | `Node.addComponent()` 将 `cc.Component` 接入 Creator 激活/调度系统，组件配置可由 `.fire`/Prefab 序列化恢复。 | 同为“组件”不表示生命周期回调、序列化或运行调度等价。 |
| 把对象放入/移出场景 | `addChild` 在父节点运行中可触发 `onEnter`；remove 时可按 cleanup 参数先 `onExit` 后停止行为，再断开父关系。 | Creator Node/Component 的 `active`、`activeInHierarchy`、父子激活和销毁队列控制生命周期；编辑器保存的场景数据也参与初始化。 | “移出树”不必然等于“删除对象”；两边都要验证 Actions、listeners、timers 与重新挂回行为。 |
| 销毁对象 | `release()` 到 0 才析构；autorelease pool 提供延迟 release；Node 先从父节点移除不会自动证明释放。 | `destroy()` 标记延迟销毁并随后统一清理；`cc.isValid` 状态随销毁阶段变化。 | 不可把 Creator `destroy()` 机械替换成 C++ `release()`，也不可把 `removeFromParent()` 当成 delete。 |

## 待补验证

1. 用 Cocos2d-x `cpp-tests` 或隔离 C++ 模板记录 Node/Component 创建、add/remove、场景切换、cleanup、autorelease pool clear 与析构事件顺序。
2. 在 Creator 2.4.15 复用相同的行为目标与组件/节点层级；单独记录编辑器预览及 Native 目标，不混为同一次运行结果。
3. 验证 cleanup=false、组件 disable、组件 remove、parent remove、节点释放、Lua binding/GC 宏组合下的行为。
4. 检查 `CC_ENABLE_SCRIPT_BINDING`、`CC_ENABLE_GC_FOR_NATIVE_OBJECTS` 等编译宏对 Native/C++ 与脚本桥接对象所有权的影响。

目前没有运行测试或构建 Cocos2d-x 样例；以上流程是源码结论和后续试验清单，不是跨栈运行验收。
