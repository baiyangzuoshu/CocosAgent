# 第 20 课：节点退出与重新挂载

**目标：** 观察节点从活动场景移除并重新加入时的生命周期。

## 本课增量

从运行中的 Scene 移除 EnemyA，节点 `onExit` 通知组件 `onExit` 并递归子节点。重新加入同一个对象后，节点和组件再次收到 `onEnter`，组件的 `onAdd` 不重复。

代码入口：[main.cpp](src/main.cpp)。

## 源码位置

- [CCNode.cpp:1003](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp#L1003)、[CCNode.cpp:1085](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp#L1085)：`removeChild` 经 `detachChild` 调用子节点 `onExit`。
- [CCNode.cpp:1359](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp#L1359)：节点退出时通知组件容器并遍历子节点。
- [CCComponentContainer.cpp:142](../../engine/cocos2d-x-4/cocos/2d/CCComponentContainer.cpp#L142)：容器派发组件 `onExit`。

## 简化

本课只调用 `removeChild(child, false)`，省略转场、动作清理和调度器暂停；输出的运行状态只表示节点的 `isRunning` 标记。示例使用栈对象保证重新挂载前对象仍存活。

真实引擎移除子节点时会释放父节点持有的引用（[CCVector.h:439](../../engine/cocos2d-x-4/cocos/base/CCVector.h#L439)）；需要重新挂载时，应先确保节点有其他有效持有。`cleanup=false` 本身不保证对象存活。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSprite.cpp src/cocos/2d/CCSpriteFrame.cpp src/cocos/renderer/CCTrianglesCommand.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-4x-s20
/tmp/cocos2d-4x-s20
~~~

输出应显示移除时子树运行标记清零，重新挂载后恢复。
