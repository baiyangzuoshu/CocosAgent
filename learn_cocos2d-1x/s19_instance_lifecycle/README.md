# 第 19 课：场景挂载与节点进入回调

**目标：** 观察节点加入正在运行的 Scene 后，如何收到 onEnter。

## 本课增量

ActorTree 在 Scene 启动后创建，再把根节点加入活动 Scene。两个根节点分别记录一次 Node::onEnter。1.x 没有组件系统，因此本课只观察节点回调。

## 源码位置

- engine/cocos2d-x-1/cocos2dx/CCDirector.cpp:501-508：runWithScene 启动场景。
- engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp:600-621：addChild 在父节点运行时调用子节点 onEnter。
- engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp:932-940：CCNode::onEnter 更新节点运行状态并递归子节点。

## 简化

精简版把 runWithScene 视为立即进入运行状态，并省略平台动画循环、场景切换和转场回调。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/sprite_nodes/CCSpriteFrame.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-1x-s19
/tmp/cocos2d-1x-s19
~~~

输出中应看到 EnemyA、EnemyB 各自的 Node::onEnter。
