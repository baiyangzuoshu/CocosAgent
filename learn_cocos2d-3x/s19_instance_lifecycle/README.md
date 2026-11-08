# 第 19 课：组件挂载与场景进入生命周期

**目标：** 区分组件加入节点和节点进入活动场景时的回调。

## 本课增量

ActorTree 构造时挂载 ActorLogic，立即记录 onAdd；把根节点加入活动 Scene 后，Node::onEnter 再通知组件 onEnter。这样能看到 3.x 把“组件已添加”和“节点已进入场景”分开的时机。

## 源码位置

- engine/cocos2d-x-3/cocos/2d/CCComponentContainer.cpp:55-74：add 设置 owner 后调用 onAdd。
- engine/cocos2d-x-3/cocos/2d/CCNode.cpp:961-1001：活动父节点添加子节点时调用 onEnter。
- engine/cocos2d-x-3/cocos/2d/CCNode.cpp:1312-1341：Node::onEnter 通知组件容器并递归子节点。
- engine/cocos2d-x-3/cocos/2d/CCComponentContainer.cpp:134-140：容器派发组件 onEnter。

## 简化

只记录 onAdd 和首次 onEnter，省略转场、退出后重入和完整 Director 帧循环。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSprite.cpp src/cocos/2d/CCSpriteFrame.cpp src/cocos/renderer/CCTrianglesCommand.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-3x-s19
/tmp/cocos2d-3x-s19
~~~

每个实例应先记录 onAdd；加入活动场景后记录 Node::onEnter 和组件 onEnter。
