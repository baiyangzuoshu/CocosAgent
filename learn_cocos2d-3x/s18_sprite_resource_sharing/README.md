# 第 18 课：Sprite 实例与资源共享

**目标：** 创建不同的 Sprite 节点，并观察它们如何复用贴图资源。

## 本课增量

`ActorTree` 每次创建一棵新节点树，并为其中的 Sprite 设置同一份资源。输出分别检查 Sprite 对象身份和共享资源身份。

## 源码位置

- `engine/cocos2d-x-3/cocos/2d/CCSprite.cpp:1573-1594`：Sprite 保留 SpriteFrame 引用并同步纹理和矩形。
- `engine/cocos2d-x-3/cocos/2d/CCSprite.cpp:1642-1647`：`getSpriteFrame` 返回该引用。

3.x 中两个 Sprite 节点各自独立，但都保留同一个 SpriteFrame；本课输出对象身份。 Cocos2d-x 没有 Creator Prefab 资产；本课继续用构造器搭建树，只对照实例与资源的边界。

## 简化

只保留 Sprite 实例、SpriteFrame/Texture 引用和父子关系；省略帧动画、资源释放及完整场景编辑数据。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSprite.cpp src/cocos/2d/CCSpriteFrame.cpp src/cocos/renderer/CCTrianglesCommand.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-3x-s18
/tmp/cocos2d-3x-s18
~~~

运行结果应包含 `independent Sprite nodes: true; shared SpriteFrame: true`，并绘制两棵独立的 Enemy 节点树。
