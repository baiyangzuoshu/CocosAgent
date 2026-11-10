# 第 39 课（ENG11）：事件分发与输入监听

**目标：** 根据 Cocos2d-x 4.0 本地源码，跟踪输入事件如何选中监听器、触摸如何被认领和吞掉，以及监听器何时暂停或移除。

## 本课范围与证据

本课聚焦 C++ `EventDispatcher`、`EventListener` 和单点触摸回调。结论依据仓库中的 Cocos2d-x 4.0 源码及官方 v4 事件指南；没有构建或运行工程。平台输入适配和移动设备触摸验证不在本课证据范围内。

## 事件从平台到回调

```text
平台输入
  → 对应平台层生成/分发事件
  → EventDispatcher 按事件类型和优先级选监听器
  → Listener 回调
  → 转换坐标并做命中判断（需要时）
  → 更新游戏状态
```

`EventListener::Type` 包含单点触摸、多点触摸、键盘、鼠标、加速度、焦点、游戏控制器和自定义事件等类型。各类型的回调形式不同；本课用 `EventListenerTouchOneByOne` 说明触摸分发，其余类型可从本地头文件继续追踪。

## 监听器优先级

| 注册方式 | 目标与排序 | 生命周期影响 |
| --- | --- | --- |
| `addEventListenerWithSceneGraphPriority(listener, node)` | 监听器绑定到 Node；分发器根据场景树遍历和 `globalZOrder` 计算顺序，目标通常按视觉前后关系参与命中顺序 | 关联 Node 不运行时监听器暂停；Node 进入/退出时恢复/暂停 |
| `addEventListenerWithFixedPriority(listener, priority)` | 使用非零整数；数值较小的优先，负数在场景树监听器前，正数在场景树监听器后 | 不与 Node 关联，也不会随 Node 暂停；需要时通过 `setEnabled(false)` 禁用 |

场景树优先级不等于注册先后。复杂层级、相机和 `globalZOrder` 都可能影响结果；调试时应追踪当前场景的实际目标，而不要仅凭节点添加顺序推断。

## 单点触摸如何认领

`EventListenerTouchOneByOne` 的 `onTouchBegan` 返回 `bool`：

- 返回 `false`：本监听器不认领该触摸，不会收到这次触摸后续的移动、结束和取消回调。
- 返回 `true`：分发器记录认领关系；之后的 `onTouchMoved`、`onTouchEnded` 或 `onTouchCancelled` 才会送给该监听器。
- `setSwallowTouches(true)` 只对已认领的触摸生效：它阻止更低优先级的单点监听器继续处理，并在同时存在多点监听器时从传给多点监听器的触摸集合中移除该触摸。

在调用注册 API 前填好 `onTouchBegan` 等必需回调。`checkAvailable()` 会检查监听器是否可用；同一个 listener 不能重复注册，若要绑定多个 Node，应为每个目标克隆一份 listener。

## 示例：把世界坐标转换到 Node 本地空间

以下片段展示单点触摸认领和本地矩形命中判断，适合放在拥有目标 Node 的类中：

```cpp
auto listener = EventListenerTouchOneByOne::create();
listener->setSwallowTouches(true);

listener->onTouchBegan = [](Touch* touch, Event* event) {
    auto target = static_cast<Node*>(event->getCurrentTarget());
    const Vec2 local = target->convertToNodeSpace(touch->getLocation());
    const Size size = target->getContentSize();
    const Rect localBounds(0.0f, 0.0f, size.width, size.height);

    // 只有点在目标内容矩形内才认领这次触摸。
    return localBounds.containsPoint(local);
};

listener->onTouchEnded = [](Touch* touch, Event* event) {
    // 在这里更新按钮或角色状态。
};

_eventDispatcher->addEventListenerWithSceneGraphPriority(listener, this);
```

`Touch::getLocation()` 给出世界坐标；先转换到目标 Node 的本地坐标，才能与本地内容矩形比较。该矩形假设普通矩形内容区域；自定义绘制、非矩形形状或裁剪区域要使用相应的命中规则。坐标空间细节见[第 36 课](../s36_cocos2d_node_transforms_coordinates/README.md)。

## 暂停、禁用与移除不是一回事

- 场景图优先级 listener 随关联 Node 的运行状态暂停和恢复；在分发时，dispatcher 只调用已注册、启用且未暂停的 listener。
- 固定优先级 listener 没有关联 Node，不随 Node 的 `onEnter/onExit` 暂停；若要临时停止响应，显式调用 `setEnabled(false)`。
- `removeEventListener(listener)` 移除单个 listener；`removeEventListenersForTarget(node)` 移除该 Node 上注册的 listener（默认不递归）。若在回调分发过程中移除，源码会先标记未注册，再延迟完成容器清理，以避免遍历中破坏监听器列表。
- 本地 `Node::~Node()` 会移除注册在该 Node 上的监听器。此版本的 `Node::cleanup()` 刻意没有移除监听器的调用，因此不能把 `cleanup()` 当成监听器已解除的证据。若对象将被复用或 listener 不再需要，应按实际生命周期显式移除。
- 固定优先级 listener 不由 Node 持有生命周期关联；若其回调捕获了对象指针，必须在对象失效前移除 listener 或禁用并妥善管理它。

```cpp
_eventDispatcher->removeEventListener(listener);
```

调用移除后，不要再通过未额外持有的裸指针访问 listener；引用计数和 autorelease 的关系见[第 37 课](../s37_cocos2d_ref_autorelease_pool/README.md)。

## 动手练习

1. 在本地 `dispatchTouchEvent()` 中标出单点监听器与多点监听器的处理顺序，并观察吞掉的触摸如何影响后续监听器。
2. 注册两个 scene graph listener 和两个固定优先级 listener，分别推演负数、零（场景图）和正数优先级的分发位置；零不能作为 fixed priority。
3. 让 `onTouchBegan` 对命中和未命中分别返回 `true`/`false`，写出各自会收到哪些后续回调。
4. 对比关联 Node 的 `onEnter/onExit`、`cleanup()` 和析构路径；指出哪一步只暂停、哪一步真正移除 listener。
5. 追踪一次 listener 在触摸回调中移除时，`isRegistered()` 与延迟清理列表如何配合。

## 简化说明

- 源码证据限定仓库中的 Cocos2d-x 4.0 快照；平台输入事件的创建和注入需要按具体平台适配层继续验证。
- 示例只展示普通矩形区域的单点触摸；没有处理多点手势、相机、裁剪、自定义形状或 UI 控件内部的额外事件逻辑。
- 官方指南帮助理解公开 API；实际调用顺序和本课生命周期结论以本地源码为准。

## 参考资料

- [本地 EventDispatcher 头文件](../../engine/cocos2d-x-4/cocos/base/CCEventDispatcher.h)
- [本地 EventDispatcher 实现](../../engine/cocos2d-x-4/cocos/base/CCEventDispatcher.cpp)
- [本地 EventListener 头文件](../../engine/cocos2d-x-4/cocos/base/CCEventListener.h)
- [本地单点/多点触摸 listener 头文件](../../engine/cocos2d-x-4/cocos/base/CCEventListenerTouch.h)
- [Touch 坐标接口](../../engine/cocos2d-x-4/cocos/base/CCTouch.h)
- [Node 坐标转换、暂停和析构实现](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp)
- [第 36 课：变换与坐标关系](../s36_cocos2d_node_transforms_coordinates/README.md)
- [第 37 课：Ref、引用计数与 AutoreleasePool](../s37_cocos2d_ref_autorelease_pool/README.md)
- [Cocos2d-x v4：注册事件](https://docs.cocos2d-x.org/cocos2d-x/v4/en/event_dispatcher/registering.html)
- [Cocos2d-x v4：事件 listener 类型](https://docs.cocos2d-x.org/cocos2d-x/v4/en/event_dispatcher/types.html)
- [Cocos2d-x v4：事件优先级](https://docs.cocos2d-x.org/cocos2d-x/v4/en/event_dispatcher/priority.html)
- [Cocos2d-x v4：触摸事件](https://docs.cocos2d-x.org/cocos2d-x/v4/en/event_dispatcher/touch.html)
- [输入事件专题 Skill](../../plugins/cocos2d-x-4/skills/cocos2d-x-4-input-events/SKILL.md)
