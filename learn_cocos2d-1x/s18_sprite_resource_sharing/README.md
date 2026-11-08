# 第 18 课：Sprite 实例与资源共享

**目标：** 创建不同的 Sprite 节点，并观察它们如何复用贴图资源。

## 本课增量

`ActorTree` 每次创建一棵新节点树，并为其中的 Sprite 设置同一份资源。输出分别检查 Sprite 对象身份和共享资源身份。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSprite.cpp:1034-1047`：`setDisplayFrame` 从 SpriteFrame 读取贴图和矩形。
- `engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSprite.cpp:1123-1126`：Sprite 返回当前纹理引用。

1.x 将 SpriteFrame 的矩形数据写入 Sprite，每个 Sprite 独立；底层 `CCTexture2D` 由两者共享。 Cocos2d-x 没有 Creator Prefab 资产；本课继续用构造器搭建树，只对照实例与资源的边界。

## 简化

只保留 Sprite 实例、SpriteFrame/Texture 引用和父子关系；省略帧动画、资源释放及完整场景编辑数据。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/sprite_nodes/CCSpriteFrame.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-1x-s18
/tmp/cocos2d-1x-s18
~~~

运行结果应包含 `independent Sprite nodes: true; shared texture: true`，并绘制两棵独立的 Enemy 节点树。
