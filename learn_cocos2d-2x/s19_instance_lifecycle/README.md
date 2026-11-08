# 第 19 课：组件添加与场景挂载回调

**目标：** 区分 2.x 中组件添加回调与节点进入活动场景的时机。

## 本课增量

ActorTree 构造时把 ActorLogic 加入组件容器；2.x 的容器会立即调用组件 onEnter。Scene 启动后再加入 ActorTree 根节点，节点随后收到 Node::onEnter。两个回调名字相似，但触发点不同。

## 源码位置

- engine/cocos2d-x-2/cocos2dx/support/component/CCComponentContainer.cpp:56-75：add 设置 owner 后立即调用组件 onEnter。
- engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:595-616：addChild 在父节点运行时调用子节点 onEnter。
- engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:911-920：CCNode::onEnter 设置运行状态并通知脚本层。
- engine/cocos2d-x-2/cocos2dx/CCDirector.cpp:603-610：runWithScene 启动场景。

## 简化

ActorLogic 在节点进入场景前挂载，以突出 2.x 组件容器的调用时机；省略完整转场和平台帧循环。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/sprite_nodes/CCSpriteFrame.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/support/component/CCComponent.cpp src/cocos2dx/support/component/CCComponentContainer.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-2x-s19
/tmp/cocos2d-2x-s19
~~~

输出先出现 ActorLogic::onEnter (component added)，随后是各节点的 Node::onEnter。
