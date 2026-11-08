# 第 13 课：CCSpriteFrame 保存贴图区域

**目标：** 看清 SpriteFrame 如何把一张纹理和图集矩形交给 CCSprite。

## 本课增量

CCSpriteFrame 保存 CCTexture2D 与像素矩形。CCSprite::setDisplayFrame 读取纹理尺寸，把矩形换成四个顶点的 UV；draw 再将纹理和 UV 一起提交。本例取 128×64 图集左侧 64×64 区域。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSpriteFrame.cpp:33-73`：从纹理和矩形创建 SpriteFrame。
- `engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSprite.cpp:285-292,364-378,1034-1047`：初始化 SpriteFrame、更新纹理矩形和应用显示帧。
- `engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSprite.cpp:654-693`：设置纹理坐标并直接绘制四边形。

## 简化

样例用字符串表示解码后的纹理，并打印 OpenGL 调用；省略真实图像解码、引用计数、旋转/裁剪帧和 SpriteBatchNode。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/sprite_nodes/CCSpriteFrame.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-1x-s13
/tmp/cocos2d-1x-s13
~~~

输出中的 Player 使用缓存纹理，UV 的 U 范围为 `0.00–0.50`，再以 `GL_TRIANGLE_STRIP` 绘制。
