# 第 17 课：可复用节点树构造

**目标：** 用同一段构造逻辑创建两棵独立的节点树。

## 本课增量

`ActorTree` 构造器每次都新建 `root → body → marker`，再把两棵树挂到场景。对象地址输出为 `true`，表示根节点和子节点都不是共享对象。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp:546`：`CCNode::node` 创建节点。
- `engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp:600-629`：`addChild` 建立父子关系。

Cocos2d-x 1.x 没有 Creator Prefab 资源，也没有通用 `CCNode` 克隆接口。本课用可重复执行的构造器组装节点树。

## 简化

只保留节点创建和父子关系；不序列化场景、不复制组件或资源。本课与 Creator 的 Prefab 只在“复用层级结构”这一点上对应。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/sprite_nodes/CCSpriteFrame.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-1x-s17
/tmp/cocos2d-1x-s17
~~~

运行结果会显示 `independent factory trees: true`，并绘制两棵各含 body、marker 子节点的树。
