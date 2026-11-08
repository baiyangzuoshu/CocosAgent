# 第 17 课：可复用节点树构造

**目标：** 用同一段构造逻辑创建两棵独立的节点树。

## 本课增量

`ActorTree` 构造器每次都新建 `root → body → marker`，再把两棵树挂到场景。对象地址输出为 `true`，表示根节点和子节点都不是共享对象。

## 源码位置

- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:136`：`Node::create` 创建节点。
- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:904-980`：`addChild` 建立父子关系。

Cocos2d-x 4.x 的 `Node` 也没有 Creator Prefab 资源或通用节点克隆接口。本课展示通过构造器重复组装节点树。

## 简化

只保留节点创建和父子关系；不序列化场景、不复制组件或资源。本课与 Creator 的 Prefab 只在“复用层级结构”这一点上对应。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSprite.cpp src/cocos/2d/CCSpriteFrame.cpp src/cocos/renderer/CCTrianglesCommand.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-4x-s17
/tmp/cocos2d-4x-s17
~~~

运行结果会显示 `independent factory trees: true`，并绘制两棵各含 body、marker 子节点的树。
