# 第 13 课：CCSpriteFrame 保存贴图区域

**目标：** 看清 2.x 如何从 SpriteFrame 取得纹理和矩形，再更新 Sprite 顶点 UV。

## 本课增量

CCSpriteFrame 关联 CCTexture2D 与像素矩形。CCSprite::setDisplayFrame 更新当前纹理和纹理矩形，draw 把 UV 与顶点属性一起提交。本例取 128×64 图集左侧 64×64 区域。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSpriteFrame.cpp:43-58,82-100`：由纹理与矩形初始化 SpriteFrame。
- `engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSprite.cpp:254-261,315-345,968-982`：初始化 SpriteFrame、更新纹理矩形和显示帧。
- `engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSprite.cpp:548-582`：直接绘制 Sprite 顶点。

## 简化

样例用字符串表示解码后的纹理，并打印 OpenGL 调用；省略真实图像解码、引用计数、旋转/裁剪帧和 TextureAtlas 批处理。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/sprite_nodes/CCSpriteFrame.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/support/component/CCComponent.cpp src/cocos2dx/support/component/CCComponentContainer.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-2x-s13
/tmp/cocos2d-2x-s13
~~~

Player 使用缓存纹理，左半图集区域对应的 U 范围为 `0.00–0.50`。
