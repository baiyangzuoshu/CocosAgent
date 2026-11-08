# 第 20 课：节点退出与重新挂载

**目标：** 观察节点从活动场景移除并重新加入时的生命周期。

## 本课增量

从运行中的 Scene 移除 EnemyA，节点子树进入 `onExit`；重新加入后再次进入 `onEnter`。最后显式移除 ActorLogic，才看到组件的 `onExit`。本代组件容器在移除组件时调用该回调。

代码入口：[main.cpp](src/main.cpp)。

## 源码位置

- [CCNode.cpp:653](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L653)、[CCNode.cpp:727](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L727)：`removeChild` 经 `detachChild` 调用子节点 `onExit`。
- [CCNode.cpp:959](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L959)：节点退出并向子节点传播。
- [CCComponentContainer.cpp:106](../../engine/cocos2d-x-2/cocos2dx/support/component/CCComponentContainer.cpp#L106)：移除组件时调用组件 `onExit`。

## 简化

本课只调用 `removeChild(child, false)`，省略转场、动作清理和调度器暂停；输出的运行状态只表示节点的 `isRunning` 标记。示例使用栈对象保证重新挂载前对象仍存活。

真实引擎移除子节点时会释放父节点持有的引用（[ccCArray.cpp:194](../../engine/cocos2d-x-2/cocos2dx/support/data_support/ccCArray.cpp#L194)）；需要重新挂载时，应先确保节点有其他有效持有。`cleanup=false` 本身不保证对象存活。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/sprite_nodes/CCSpriteFrame.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/support/component/CCComponent.cpp src/cocos2dx/support/component/CCComponentContainer.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-2x-s20
/tmp/cocos2d-2x-s20
~~~

输出应显示移除时子树运行标记清零，重新挂载后恢复。
