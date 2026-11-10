# 第 37 课（ENG09）：Ref、引用计数与 AutoreleasePool

**目标：** 根据本地 Cocos2d-x 4.0 源码追踪对象引用计数、自动释放队列和最终析构，避免把“离开作用域”“移出场景树”和“对象销毁”当作同一件事。

## 本课代码快照

src/main.cpp 是 intrusive reference count 与 autorelease pool 的独立小模型：创建时计数为 1，Parent 持有后增加为 2，pool 清理后降为 1，Parent 移除后降为 0 并析构。它演示引用账本，不是 Cocos2d-x Ref 的实现副本。

源码： [src/main.cpp](src/main.cpp)；课程结构参考 [Creator 第 19 课](../../learn_3.8cocoscreator/s19_instance_lifecycle/README.md)。

在本课目录编译并运行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror src/main.cpp -o /tmp/learn-cpp-s37
/tmp/learn-cpp-s37
~~~

预期观察：按顺序看到 1 → 2 → 1，最终打印 destroy Sprite。再对照本地 Ref、AutoreleasePool 和 Node 的 retain/release。

本次已用 Apple Clang 21 按 C++17 严格警告选项编译并运行该教学示例；这验证的是独立课程代码，不是 Cocos2d-x 引擎运行。

## 本课范围

本课只研究继承 `cocos2d::Ref` 的 C++ 对象，以及 `AutoreleasePool` 如何延迟执行 `release()`。Scene/Node 的父子关系见 ENG07；本课用它作所有权例子，不展开组件回调或 Creator 的延迟销毁机制。源码结论是静态追踪；独立模型已在本机运行，但没有构建或运行 Cocos2d-x 工程。

## Ref 的基本规则

本地 [`Ref`](../../engine/cocos2d-x-4/cocos/base/CCRef.h) 在构造时把 `_referenceCount` 设为 1：

| 操作 | 引用计数变化 | 源码结果 |
| --- | ---: | --- |
| 构造 `Ref` 派生对象 | 初始为 1 | 对象从一个初始引用开始 |
| `retain()` | +1 | 增加一份显式持有 |
| `release()` | -1 | 到 0 时执行 `delete this`，调用派生类析构 |
| `autorelease()` | 调用时不变 | 把对象排入当前池，稍后由池调用一次 `release()` |

`Ref` 是引擎自己的侵入式引用计数基类；普通 C++ 指针变量本身不会自动 retain，也不会在离开 C++ 词法作用域时自动 release。代码里的 `auto node = Node::create()` 只是保存一个指针值。

## create 与父节点的引用账本

`Node::create()` 的源码路径是 `new Node`、`init()`、`autorelease()`。父节点的 `_children` 是 `cocos2d::Vector<Node*>`；`Vector::pushBack()` 会 retain，`erase()` 会 release。以一个由正常运行 Scene 持有的父节点为例：

```cpp
auto child = Node::create();       // 初始 1；当前 AutoreleasePool 记录一次待 release
parent->addChild(child);           // 父节点的 Vector retain：计数变成 2

// 普通 Director::mainLoop 完成 drawScene 后清理当前池：计数变成 1
parent->removeChild(child);        // Vector erase release：无其他引用时计数变成 0
```

| 时点 | 计数 | 谁持有或待释放 |
| --- | ---: | --- |
| `Node::create()` 返回 | 1 | 初始引用；池里排有一次 release |
| `addChild(child)` 完成 | 2 | 初始引用 + 父节点 Vector 的引用 |
| 当前池清理后 | 1 | 父节点 Vector 仍持有 |
| `removeChild(child)` 后 | 0 | 若没有其他持有者，对象析构 |

Director 的场景栈同样通过 `Vector<Scene*>` 持有 Scene。场景树关系、Director 场景栈和 autorelease 队列都是不同的引用来源；具体对象只有在所有持有引用都释放后才会析构。

## AutoreleasePool 如何工作

[`Ref::autorelease()`](../../engine/cocos2d-x-4/cocos/base/CCRef.cpp) 把 `this` 加入 `PoolManager::getCurrentPool()` 并返回对象指针。它不会在调用点增加或减少 `_referenceCount`；池在清理时为每个队列条目调用一次 `release()`。因此 autorelease 是“排队稍后释放一份引用”，不是垃圾回收器，也不负责扫描对象是否还能从别处访问。

`PoolManager` 管理一个池栈。第一次取得 Manager 时会创建引擎的基础池；栈顶是当前池。需要隔离一段临时创建时，可以在栈上建立嵌套池：

```cpp
{
    AutoreleasePool pool("temporary objects");
    auto temporaryNode = Node::create();
    // 临时使用对象；若不另行 retain，离开此池时会收到 release。
} // 析构函数先 clear，再从 PoolManager 栈中 pop
```

引擎普通帧路径也会在 [`Director::mainLoop()`](../../engine/cocos2d-x-4/cocos/base/CCDirector.cpp) 的 `drawScene()` 返回后清理当前池。自定义嵌套池会成为栈顶，因此要保证它在预期边界内析构，不要把某个对象“本帧必定存活到何时”脱离当前池栈来推断。

`AutoreleasePool::clear()` 先把当前队列交换到临时列表，再逐项 `release()`；同一个对象若被加入多次，就会对应多次 release。源码头文件明确要求池对象在 C++ 栈上创建，不要用 `new` 把池本身放到堆上。

## 手动持有与常见错误

如果对象必须活过创建时所在的池，先取得额外引用，并在确定不再使用时配对释放：

```cpp
auto node = Node::create();  // 1，池中已有一次待 release
node->retain();              // 2，额外持有一份

// 当前池清理后：2 -> 1，对象仍由这份额外引用持有
// 完成使用后：
node->release();              // 1 -> 0，最后一份引用释放时析构
```

以下做法会破坏配对关系：

- 对 `Node::create()` 返回值直接 `release()`：池仍会在清理时再次 release。调试构建在对象仍处于池中且计数降到 0 时会触发断言。
- `retain()` 后忘记 `release()`：对象会一直有一份引用，形成泄漏。
- 对同一个对象重复 `autorelease()` 却没有为每次额外排队的 release 准备对应引用：池会按条目数多次调用 `release()`。
- 手动 `delete` 一个 `Ref` 派生对象：绕过引用计数和容器持有关系。应按来源使用 `release()` 或对应容器 API。

`removeChild(child, cleanup)` 中的 `cleanup` 控制行为清理；不论 cleanup 参数为何，父节点最终都会从 `Vector` 移除 child 并释放自己的那份引用。因此 `cleanup = false` 不表示保留父节点引用，也不表示对象一定析构。要分开追踪 cleanup、引用计数和对象生命周期。

## 动手练习

1. 按上表计算 `Node::create()`、`addChild()`、一次帧池清理和 `removeChild()` 后的引用计数，并注明假设没有其他持有者。
2. 比较 `retain()/release()` 与 `autorelease()`：哪种立即改变计数，哪种只把一次 release 排进池？
3. 读 `AutoreleasePool` 构造和析构，画出嵌套池如何 push/pop，以及哪个池会接收新 autorelease 对象。
4. 查看 `Director::_scenesStack` 和 `Node::_children` 的 Vector 操作，找出它们分别在哪些位置增加和释放 Scene/Node 的引用。
5. 解释为什么 `removeFromParent()`、`cleanup()` 和 Node 析构不是同义词。

## 简化说明

- 引用账本只画出示例中的引擎持有关系；脚本绑定、Lua/JavaScript 代理、其他容器和用户手动 retain 都可能增加引用。
- 调试断言受 `COCOS2D_DEBUG` 等构建配置影响；不能依靠断言替代正确的 retain/release 配对。
- 本课从静态实现说明 Cocos2d-x 对象存活规则；模型析构日志已运行观察，但没有验证目标平台上的实际析构回收时点。

## 参考资料

- [本地 Ref 头文件](../../engine/cocos2d-x-4/cocos/base/CCRef.h)
- [本地 Ref 实现](../../engine/cocos2d-x-4/cocos/base/CCRef.cpp)
- [本地 AutoreleasePool 与 PoolManager 头文件](../../engine/cocos2d-x-4/cocos/base/CCAutoreleasePool.h)
- [本地 AutoreleasePool 与 PoolManager 实现](../../engine/cocos2d-x-4/cocos/base/CCAutoreleasePool.cpp)
- [Vector 容器的 retain/release 操作](../../engine/cocos2d-x-4/cocos/base/CCVector.h)
- [Node 创建与父子持有实现](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp)
- [Director 场景栈与帧池清理](../../engine/cocos2d-x-4/cocos/base/CCDirector.cpp)
- [Cocos2d-x Scene/Node/Component 生命周期源码地图](../../docs/cocos2d-x/02-objects-and-lifecycle.md)
- [Scene/Node 生命周期专题 Skill](../../plugins/cocos2d-x-4/skills/cocos2d-x-4-scene-node-lifecycle/SKILL.md)
