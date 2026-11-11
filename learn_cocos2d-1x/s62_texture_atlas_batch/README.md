# 第 62 课：1.x SpriteBatchNode 与 TextureAtlas

**本课问题：** 1.x 怎样把同一张纹理的 Sprite quad 放入图集，并只绘制一次？

## 本版渲染路径

CCSpriteBatchNode.addChild() 要求子 Sprite 使用 batch node 的纹理，计算 atlasIndex 后把 quad 插入 TextureAtlas。visit() 更新后代变换，再由 draw() 调用一次 TextureAtlas.drawQuads()。图集顺序承载 Sprite 的绘制顺序。

## 源码位置

- [CCSpriteBatchNode.cpp](../../engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSpriteBatchNode.cpp)：addChild()、atlasIndexForChild()、insertChild() 和 draw()。
- [CCTextureAtlas.cpp](../../engine/cocos2d-x-1/cocos2dx/textures/CCTextureAtlas.cpp)：insertQuad()、drawQuads() 与一次图元提交。

## 独立代码与简化

src/cocos2dx/ 按 SpriteBatchNode 和 TextureAtlas 分层，保留同纹理约束、quad 插入位置和单次图集绘制。示例只处理一层平面子节点；日志替代 OpenGL 和真实 quad 内存。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSpriteBatchNode.cpp src/cocos2dx/textures/CCTextureAtlas.cpp -o /tmp/cocos2d-1x-s62
/tmp/cocos2d-1x-s62
~~~

两个不同 zOrder 的 Sprite 按图集顺序记录，最终 TextureAtlas 一次绘制两个 quad。
