# 第 38 课（ENG10）：Component 与组件生命周期

**目标：** 根据本地 Cocos2d-x 4.0 源码，追踪 Component 从创建、挂到 Node、进入与更新，到移除和释放的路径。

## 本课范围

本课只描述本地 C++ `Component`、`ComponentContainer` 与 `Node` 的接线。Cocos2d-x 4.0 有 Component 系统；它不是 Creator 2.4.15 的编辑器序列化或 JavaScript 组件调度实现。本课为静态源码分析，未构建或运行工程。

## Component 由 Node 的容器管理

[`Component`](../../engine/cocos2d-x-4/cocos/2d/CCComponent.h) 继承 `Ref`，保存名称、owner Node 和 `_enabled` 标记。Node 第一次添加组件时，惰性创建自己的 `ComponentContainer`；容器用组件名称作为 key 保存组件指针。

```cpp
auto component = Component::create(); // 初始化并排入当前 AutoreleasePool
component->setName("meter");
node->addComponent(component);

Component* found = node->getComponent("meter");
```

调用 `addComponent()` 前先设置名称：默认名称为空，同一个 Node 上的名称不能重复。容器遇到重复 key 会触发断言并拒绝添加。需要自定义行为时，派生 `Component` 并覆写 `onAdd()`、`onEnter()`、`update()`、`onExit()` 或 `onRemove()`；这些基类方法在原生 C++ 路径中不执行自定义逻辑，启用脚本绑定时则可能转发脚本事件。

## 生命周期路径

| 阶段 | 本地调用路径 | 关键状态 |
| --- | --- | --- |
| 创建 | `Component::create()` 执行 `new`、`init()`、`autorelease()` | 初始引用计数为 1，当前池排入一次待 `release` |
| 挂载 | `Node::addComponent()` → `ComponentContainer::add()` | 容器 retain 组件、设置 owner，再调用 `onAdd()` |
| Node 进入 | `Node::onEnter()` → `ComponentContainer::onEnter()` | 对当时已在容器中的组件调用 `onEnter()` |
| 每帧更新 | `Node::addComponent()` 安排 Node 的 `update`；`Node::update(dt)` 调用容器 `visit(dt)` | 容器逐个调用组件 `update(dt)` |
| Node 退出 | `Node::onExit()` → `ComponentContainer::onExit()` | 对容器中的组件调用 `onExit()` |
| 移除 | `ComponentContainer::remove()` | 先从 map 移除，再调用 `onRemove()`、清 owner、release 容器引用 |
| Node 析构 | `Node::~Node()` 调用 `removeAllComponents()` | 剩余组件收到 `onRemove()` 并释放容器持有的引用 |

挂载顺序是 `retain → setOwner → onAdd`，所以 `onAdd()` 中可以通过 `getOwner()` 取得 Node。`setOwner()` 只保存 Node 指针，不额外 retain owner。移除顺序是 `erase map → onRemove → setOwner(nullptr) → release`，因此 `onRemove()` 期间 owner 仍有效。

## Node 驱动组件更新

`Node::addComponent()` 会调用 `scheduleUpdate()`。Node 进入运行状态时恢复其 Scheduler target；Node 退出时暂停 target。每帧 Scheduler 调用 Node 的 `update(dt)`，Node 再把 delta 交给 `ComponentContainer::visit(dt)`。组件不是由每个组件单独向 Scheduler 注册更新。

容器的 `_componentMap` 是 `std::unordered_map`。源码按 map 迭代调用组件回调，没有保证同一 Node 上多个组件之间的稳定顺序；不要用组件添加先后推断它们的 update/onEnter 次序。

## `enabled` 标记要按具体类核对

基类 `Component::setEnabled()` 只写入 `_enabled`。通用 `ComponentContainer::visit()`、`onEnter()` 和 `onExit()` 都没有检查 `isEnabled()`，因此这个基类标记本身不会让通用容器跳过这些调用。

具体子类可以覆盖自己的启用语义。例如本地 `Physics3DComponent::setEnabled()` 调用基类后，会按状态把 Physics3D 对象加入或移出物理世界。遇到具体组件时，应继续读该子类的 `setEnabled()` 和更新路径；不能只根据 `enabled` 属性名推断所有 Component 的共同调度规则。

## 运行中的 Node 上动态增删

`ComponentContainer::add()` 的实现只做容器登记、retain、设置 owner 和 `onAdd()`；它不判断 owner 是否已经 running，也不补调 `onEnter()`。因此在 Node 已经运行后添加组件时，不能仅凭容器代码假定新组件立即收到 `onEnter()`。

同样，`ComponentContainer::remove()` 只调用 `onRemove()`，不会先补调 `onExit()`。Node 正常退出时才会通过 `ComponentContainer::onExit()` 通知当时仍在容器中的组件。动态挂载/移除的回调设计要按这段本地实现处理；本课没有运行验证具体目标的回调日志。

## 组件所有权与对象释放

`ComponentContainer::add()` 对组件调用 `retain()`，移除或 `Node` 析构时调用 `release()`。`Component::create()` 返回 autorelease 对象，所以添加后通常由容器持有；当前 AutoreleasePool 清理时先释放工厂创建时排入池的那份引用。若应用还有额外引用，容器移除后对象仍可能存活。引用计数细节见[第 37 课](../s37_cocos2d_ref_autorelease_pool/README.md)。

`removeComponent()` 和 `removeAllComponents()` 的容器引用释放不会自动证明析构已经发生。`onRemove()` 是组件离开 owner 容器的回调；C++ 析构仍取决于 `Ref` 的最后一次 `release()`。

## 动手练习

1. 在 `ComponentContainer::add()` 标出 retain、owner 赋值和 `onAdd()` 的顺序。
2. 从 `Node::addComponent()` 一路追到 Scheduler、`Node::update()` 和 `ComponentContainer::visit()`，画出每帧更新路径。
3. 比较 Node 正常 `onEnter/onExit` 与运行中动态 `add/remove` 的回调差异。
4. 在通用容器中查找 `isEnabled()` 条件；再读 `Physics3DComponent::setEnabled()`，说明 base 标记和具体子类行为的差别。
5. 推演组件先 `create()` 再 `addComponent()`、AutoreleasePool 清理、最后 `removeComponent()` 后的引用计数；写明“没有额外持有者”的假设。

## 简化说明

- 本课限定默认 C++ `ComponentContainer`；脚本绑定、物理组件、自定义子类可能添加额外行为。
- 组件 map 的遍历次序不稳定，动态挂载回调和析构时序需要在具体版本/构建配置下观察。
- 静态源码只能说明当前快照中的调用点和持有关系，不代表目标平台已构建或运行验收。

## 参考资料

- [本地 Component 头文件](../../engine/cocos2d-x-4/cocos/2d/CCComponent.h)
- [本地 Component 实现](../../engine/cocos2d-x-4/cocos/2d/CCComponent.cpp)
- [本地 ComponentContainer 头文件](../../engine/cocos2d-x-4/cocos/2d/CCComponentContainer.h)
- [本地 ComponentContainer 实现](../../engine/cocos2d-x-4/cocos/2d/CCComponentContainer.cpp)
- [Node 的 Component 接口、生命周期与 update](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp)
- [Physics3DComponent 的 enabled 实现](../../engine/cocos2d-x-4/cocos/physics3d/CCPhysics3DComponent.cpp)
- [第 37 课：Ref、引用计数与 AutoreleasePool](../s37_cocos2d_ref_autorelease_pool/README.md)
- [Cocos2d-x Scene/Node/Component 生命周期源码地图](../../docs/cocos2d-x/02-objects-and-lifecycle.md)
- [Scene/Node 生命周期专题 Skill](../../plugins/cocos2d-x-4/skills/cocos2d-x-4-scene-node-lifecycle/SKILL.md)
